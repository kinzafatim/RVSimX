
import re
import struct
from .memory import Memory
from .csr import CSRFile
from .instructions import get_executors

class RISCVSimulator:
    def __init__(self):
        self.reset()
        # Dispatch table
        self.executors = get_executors()

    def reset(self):
        self.x = [0] * 32
        self.f = [0] * 32 # Float registers (integers representing bits)
        self.pc = 0
        self.memory = Memory()
        self.csrs = CSRFile()
        self.program = {} # Address -> Inst
        self.labels = {}
        self.pipeline_state = self.empty_pipeline_state()
        self.reservation = None
        self.current_inst = None

    def empty_pipeline_state(self):
        return {
            'pc': 0, 'inst': 0,
            'rs1': 0, 'rs2': 0, 'rd': 0, 'imm': 0,
            'alu_out': 0, 'mem_out': 0,
            'reg_write': False, 'mem_write': False, 'mem_read': False,
            'branch_taken': False,
            'alu_src_a': 'reg', 'alu_src_b': 'reg', 'mem_to_reg': 'alu',
            'branch': False, 'jump': False
        }

    def assemble(self, code):
        self.program = {}
        self.labels = {}
        lines = code.split('\n')
        errors = []
        
        # Pass 1: Labels and Lines
        current = 0
        clean = [] # (addr, line_content, original_line_index_1_based)
        
        # We need to map labels first.
        # But to map labels we need to know addresses.
        # To know addresses we need to know instruction lengths.
        # So we iterate valid lines.
        
        for i, line in enumerate(lines):
            raw = line
            line = line.split('#')[0].strip()
            if not line: continue
            
            if line.endswith(':'):
                self.labels[line[:-1]] = current
            else:
                # Guess length
                parts = line.replace(',', ' ').split()
                try: 
                    op = parts[0].lower()
                    length = 2 if op.startswith('c.') else 4
                except:
                    length = 4 # Default to 4 if parse fail, will fail in Pass 2
                
                clean.append((current, line, i + 1))
                current += length
        
        # Pass 2: Parse
        for addr, line, line_num in clean:
            try:
                inst = self.parse_line(line, addr)
                self.program[addr] = inst
            except Exception as e:
                errors.append({'line': line_num, 'message': str(e)})
                
        if errors:
            return False, errors
            
        return True, "Assembled successfully"

    def parse_line(self, line, addr):
        parts = line.replace(',', ' ').split()
        if not parts: raise Exception("Empty line")
        op = parts[0].lower()
        args = parts[1:]

        # Stripping atomic suffixes for standard atomic ops if needed, 
        # but our executors map 'lr.w', 'sc.w' etc directly.
        # However, for 'amoadd.w.aq' we might need stripping.
        # The executors in rv32a.py key on 'amoadd.w' etc.
        # So we should strip .aq, .rl, .aqrl.
        
        original_op = op
        for suffix in ['.aqrl', '.aq', '.rl']:
            if op.endswith(suffix) and op not in ['lr.w', 'sc.w']: # lr.w is exact match usually, but lr.w.aq is possible? Yes.
                 # Actually standard is lr.w.aq. 
                 # My executors use 'lr.w'.
                 # So I should strip from ANY atomic op.
                 op = op[:-len(suffix)]
                 break
        
        # Re-check if valid op
        if op not in self.executors and original_op not in self.executors:
             # Try stripping from atomic again if missed?
             pass

        inst = {
            'address': addr,
            'source': line,
            'op': op,
            'args': [],
            'machine_code': 0, # Placeholder
            'length': 2 if op.startswith('c.') else 4
        }
        
        def get_reg(s):
            if s in ['zero', 'x0']: return 0
            if s.startswith('x'): return int(s[1:])
            abis = ['zero','ra','sp','gp','tp','t0','t1','t2','s0','s1','a0','a1','a2',
                    'a3','a4','a5','a6','a7','s2','s3','s4','s5','s6','s7','s8','s9',
                    's10','s11','t3','t4','t5','t6']
            if s in abis: return abis.index(s)
            
            if s.startswith('f'):
                try: return int(s[1:])
                except: pass
            
            f_abis = ['ft0','ft1','ft2','ft3','ft4','ft5','ft6','ft7','fs0','fs1','fa0','fa1',
                      'fa2','fa3','fa4','fa5','fa6','fa7','fs2','fs3','fs4','fs5','fs6','fs7',
                      'fs8','fs9','fs10','fs11','ft8','ft9','ft10','ft11']
            if s in f_abis: return f_abis.index(s)
            
            if s == 'fp': return 8
            raise Exception(f"Invalid register: {s}")

        def get_imm(s):
            if s in self.labels: return self.labels[s] - addr
            try: return int(s, 0)
            except: raise Exception(f"Invalid immediate: {s}")

        parsed_args = []
        for a in args:
            if '(' in a:
                # offset(base)
                off_str, base_str = a.replace(')', '').split('(')
                parsed_args.append(get_imm(off_str))
                parsed_args.append(get_reg(base_str))
            else:
                if a in self.labels: parsed_args.append(get_imm(a))
                elif (a[0].isdigit() or a[0] == '-' or a.startswith('0x')): parsed_args.append(get_imm(a))
                else: parsed_args.append(get_reg(a))
        
        inst['args'] = parsed_args
        
        # Fix JAL args
        # jal label -> [imm] -> [1, imm]
        if op == 'jal' and len(parsed_args) == 1:
            inst['args'] = [1, parsed_args[0]]
            
        return inst

    def step(self):
        inst = self.program.get(self.pc)
        if not inst: return

        self.current_inst = inst
        self.pipeline_state = self.empty_pipeline_state()
        self.pipeline_state['pc'] = self.pc
        self.pipeline_state['inst'] = inst['machine_code']
        
        handler = self.executors.get(inst['op'], self.exec_unknown)
        handler(self, inst) 
        
        self.x[0] = 0 

    def run(self):
        counter = 0
        while self.program.get(self.pc) and counter < 5000:
            self.step()
            counter += 1

    def get_state(self):
        flat_mem = {}
        for base, page in self.memory.pages.items():
            for i, b in enumerate(page):
                if b != 0: flat_mem[base + i] = b

        return {
            'registers': self.x,
            'f_registers': self.f,
            'pc': self.pc,
            'memory': flat_mem,
            'pipeline': self.pipeline_state
        }
    
    def write_reg(self, rd, val):
        if rd != 0:
            self.x[rd] = val & 0xFFFFFFFF
            # Do NOT update PC here. Executors handle it.
            
    def write_freg(self, rd, val):
        self.f[rd] = val 
        
    def exec_unknown(self, sim, inst):
        print(f"Unknown instruction: {inst['op']}")
        self.pc += inst.get('length', 4)

