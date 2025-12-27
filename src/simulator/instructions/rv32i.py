
import struct

def exec_r_type(sim, inst):
    rd, rs1, rs2 = inst['args']
    v1 = sim.x[rs1]
    v2 = sim.x[rs2]
    op = inst['op']
    res = 0
    
    if op == 'add': res = v1 + v2
    elif op == 'sub': res = v1 - v2
    elif op == 'and': res = v1 & v2
    elif op == 'or': res = v1 | v2
    elif op == 'xor': res = v1 ^ v2
    elif op == 'sll': res = v1 << (v2 & 0x1F)
    elif op == 'srl': res = (v1 & 0xFFFFFFFF) >> (v2 & 0x1F)
    elif op == 'sra': 
        val_s = struct.unpack('i', struct.pack('I', v1 & 0xFFFFFFFF))[0]
        res = val_s >> (v2 & 0x1F)
    elif op == 'slt': res = 1 if (struct.unpack('i', struct.pack('I', v1 & 0xFFFFFFFF))[0] < struct.unpack('i', struct.pack('I', v2 & 0xFFFFFFFF))[0]) else 0
    elif op == 'sltu': res = 1 if (v1 & 0xFFFFFFFF) < (v2 & 0xFFFFFFFF) else 0

    sim.write_reg(rd, res)
    sim.update_pipe(rd=rd, rs1=rs1, rs2=rs2, alu_out=res, alu_src_b='reg')
    sim.pc += 4

def exec_i_type(sim, inst):
    rd, rs1, imm = inst['args']
    v1 = sim.x[rs1]
    op = inst['op']
    res = 0
    
    if op == 'addi': res = v1 + imm
    elif op == 'andi': res = v1 & imm
    elif op == 'ori': res = v1 | imm
    elif op == 'xori': res = v1 ^ imm
    elif op == 'slli': res = v1 << (imm & 0x1F)
    elif op == 'srli': res = (v1 & 0xFFFFFFFF) >> (imm & 0x1F)
    elif op == 'srai':
        val_s = struct.unpack('i', struct.pack('I', v1 & 0xFFFFFFFF))[0]
        res = val_s >> (imm & 0x1F)
    elif op == 'slti': res = 1 if (struct.unpack('i', struct.pack('I', v1 & 0xFFFFFFFF))[0] < imm) else 0
    elif op == 'sltiu': res = 1 if (v1 & 0xFFFFFFFF) < (imm & 0xFFFFFFFF) else 0

    sim.write_reg(rd, res)
    sim.update_pipe(rd=rd, rs1=rs1, imm=imm, alu_out=res, alu_src_b='imm')
    sim.pc += 4

def exec_load(sim, inst):
    rd, imm, rs1 = inst['args']
    addr = (sim.x[rs1] + imm) & 0xFFFFFFFF
    op = inst['op']
    
    signed = op in ['lb', 'lh', 'lw']
    size = 4 if 'w' in op else (2 if 'h' in op else 1)
    
    val = sim.memory.read(addr, size, signed)
    sim.write_reg(rd, val)
    sim.update_pipe(rd=rd, rs1=rs1, imm=imm, alu_out=addr, mem_out=val, mem_read=True, mem_to_reg='mem', alu_src_b='imm')
    sim.pc += 4

def exec_store(sim, inst):
    rs2, imm, rs1 = inst['args']
    addr = (sim.x[rs1] + imm) & 0xFFFFFFFF
    val = sim.x[rs2]
    size = 4 if 'w' in inst['op'] else (2 if 'h' in inst['op'] else 1)
    
    sim.memory.write(addr, val, size)
    sim.reservation = None
    
    sim.update_pipe(rs1=rs1, rs2=rs2, imm=imm, alu_out=addr, mem_write=True, alu_src_b='imm')
    sim.pc += 4

def exec_branch(sim, inst):
    rs1, rs2, imm = inst['args']
    v1 = sim.x[rs1]
    v2 = sim.x[rs2]
    op = inst['op']
    take = False
    
    s1 = struct.unpack('i', struct.pack('I', v1 & 0xFFFFFFFF))[0]
    s2 = struct.unpack('i', struct.pack('I', v2 & 0xFFFFFFFF))[0]
    
    if op == 'beq': take = (v1 == v2)
    elif op == 'bne': take = (v1 != v2)
    elif op == 'blt': take = (s1 < s2)
    elif op == 'bge': take = (s1 >= s2)
    elif op == 'bltu': take = (v1 < v2)
    elif op == 'bgeu': take = (v1 >= v2)

    sim.update_pipe(rs1=rs1, rs2=rs2, imm=imm, branch=True, branch_taken=take)
    if take:
        sim.pc += imm
    else:
        sim.pc += 4

def exec_jal(sim, inst):
    rd, imm = inst['args']
    next_inst = sim.pc + 4
    sim.write_reg(rd, next_inst)
    sim.update_pipe(rd=rd, imm=imm, jump=True, branch_taken=True)
    sim.pc += imm # jal offset is from current PC

def exec_jalr(sim, inst):
    rd, rs1, imm = inst['args']
    next_inst = sim.pc + 4
    target = (sim.x[rs1] + imm) & ~1
    sim.write_reg(rd, next_inst)
    sim.update_pipe(rd=rd, rs1=rs1, imm=imm, jump=True, branch_taken=True)
    sim.pc = target

def exec_lui(sim, inst):
    rd, imm = inst['args']
    val = (imm << 12) & 0xFFFFFFFF
    sim.write_reg(rd, val)
    sim.update_pipe(rd=rd, imm=imm, alu_out=val, alu_src_a='x', alu_src_b='imm')
    sim.pc += 4

def exec_auipc(sim, inst):
    rd, imm = inst['args']
    val = (sim.pc + imm) & 0xFFFFFFFF
    sim.write_reg(rd, val)
    sim.update_pipe(rd=rd, imm=imm, alu_out=val, alu_src_a='pc', alu_src_b='imm')
    sim.pc += 4
    
def exec_ecall(sim, inst):
    syscall = sim.x[17]
    if syscall == 93: # exit
        sim.pc = 0xFFFFFFFF # Trap to end
    elif syscall == 1: # print char
        print(chr(sim.x[10] & 0xFF), end='')
        sim.pc += 4
    else:
        sim.pc += 4
