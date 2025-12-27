
import struct
import math

def to_float(v):
    return struct.unpack('f', struct.pack('I', v & 0xFFFFFFFF))[0]

def from_float(f):
    return struct.unpack('I', struct.pack('f', f))[0]

def exec_flw(sim, inst):
    rd, imm, rs1 = inst['args']
    addr = (sim.x[rs1] + imm) & 0xFFFFFFFF
    val = sim.memory.read(addr, 4) 
    sim.write_freg(rd, val)
    sim.update_pipe(rd=rd, rs1=rs1, imm=imm, alu_out=addr, mem_out=val, mem_read=True, mem_to_reg='mem')
    sim.pc += 4

def exec_fsw(sim, inst):
    rs2, imm, rs1 = inst['args']
    addr = (sim.x[rs1] + imm) & 0xFFFFFFFF
    val = sim.f[rs2] 
    sim.memory.write(addr, val, 4)
    sim.reservation = None
    sim.update_pipe(rs1=rs1, rs2=rs2, imm=imm, alu_out=addr, mem_write=True)
    sim.pc += 4

def exec_f_arith(sim, inst):
    rd, rs1, rs2 = inst['args']
    v1_bits = sim.f[rs1]
    v2_bits = sim.f[rs2]
    
    f1 = to_float(v1_bits)
    f2 = to_float(v2_bits)
    op = inst['op']
    res_f = 0.0
    res_bits = 0
    
    if op == 'fadd.s': res_f = f1 + f2
    elif op == 'fsub.s': res_f = f1 - f2
    elif op == 'fmul.s': res_f = f1 * f2
    elif op == 'fdiv.s': res_f = f1 / f2 if f2 != 0 else float('inf') 
    elif op == 'fsgnj.s':
        s = v2_bits & 0x80000000
        res_bits = (v1_bits & 0x7FFFFFFF) | s
        sim.write_freg(rd, res_bits)
        sim.update_pipe(rd=rd, rs1=rs1, rs2=rs2, alu_out=res_bits)
        sim.pc += 4
        return
    elif op == 'fsgnjn.s':
        s = ~(v2_bits) & 0x80000000
        res_bits = (v1_bits & 0x7FFFFFFF) | s
        sim.write_freg(rd, res_bits)
        sim.update_pipe(rd=rd, rs1=rs1, rs2=rs2, alu_out=res_bits)
        sim.pc += 4
        return
    elif op == 'fsgnjx.s':
        s = (v1_bits ^ v2_bits) & 0x80000000
        res_bits = (v1_bits & 0x7FFFFFFF) | s
        sim.write_freg(rd, res_bits)
        sim.update_pipe(rd=rd, rs1=rs1, rs2=rs2, alu_out=res_bits)
        sim.pc += 4
        return
    elif op == 'fmin.s': res_f = min(f1, f2)
    elif op == 'fmax.s': res_f = max(f1, f2)
    # else logic?

    res_bits = from_float(res_f)
    sim.write_freg(rd, res_bits)
    sim.update_pipe(rd=rd, rs1=rs1, rs2=rs2, alu_out=res_bits)
    sim.pc += 4

def exec_f_conv(sim, inst):
    rd, rs1 = inst['args'][:2] 
    op = inst['op']
    
    if op == 'fcvt.w.s': # F -> X
        f1 = to_float(sim.f[rs1])
        res = int(f1) & 0xFFFFFFFF
        sim.write_reg(rd, res)
        sim.update_pipe(rd=rd, rs1=rs1, alu_out=res)
    elif op == 'fcvt.wu.s': # F -> X unsigned
        f1 = to_float(sim.f[rs1])
        res = int(f1) & 0xFFFFFFFF
        sim.write_reg(rd, res)
        sim.update_pipe(rd=rd, rs1=rs1, alu_out=res)
    elif op == 'fcvt.s.w': # X -> F
        v1 = struct.unpack('i', struct.pack('I', sim.x[rs1]))[0]
        res_bits = from_float(float(v1))
        sim.write_freg(rd, res_bits)
        sim.update_pipe(rd=rd, rs1=rs1, alu_out=res_bits)
    elif op == 'fcvt.s.wu': # X (unsigned) -> F
        v1 = sim.x[rs1]
        res_bits = from_float(float(v1))
        sim.write_freg(rd, res_bits)
        sim.update_pipe(rd=rd, rs1=rs1, alu_out=res_bits)
    elif op == 'fmv.x.w': # F -> X bits
        res = sim.f[rs1]
        sim.write_reg(rd, res)
        sim.update_pipe(rd=rd, rs1=rs1, alu_out=res)
    elif op == 'fmv.w.x': # X -> F bits
        res = sim.x[rs1]
        sim.write_freg(rd, res)
        sim.update_pipe(rd=rd, rs1=rs1, alu_out=res)
    
    sim.pc += 4

def exec_f_cmp(sim, inst):
    rd, rs1, rs2 = inst['args']
    f1 = to_float(sim.f[rs1])
    f2 = to_float(sim.f[rs2])
    op = inst['op']
    res = 0
    
    if op == 'feq.s': res = 1 if f1 == f2 else 0
    elif op == 'flt.s': res = 1 if f1 < f2 else 0
    elif op == 'fle.s': res = 1 if f1 <= f2 else 0
    
    sim.write_reg(rd, res)
    sim.update_pipe(rd=rd, rs1=rs1, rs2=rs2, alu_out=res)
    sim.pc += 4

def exec_sqrt(sim, inst):
    rd, rs1 = inst['args'][:2]
    f1 = to_float(sim.f[rs1])
    res_f = math.sqrt(f1) if f1 >= 0 else float('nan')
    res_bits = from_float(res_f)
    sim.write_freg(rd, res_bits)
    sim.update_pipe(rd=rd, rs1=rs1, alu_out=res_bits)
    sim.pc += 4
