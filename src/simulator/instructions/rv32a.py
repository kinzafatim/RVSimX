
import struct

def exec_lr(sim, inst):
    rd, rs1 = inst['args']
    addr = sim.x[rs1]
    val = sim.memory.read(addr, 4, signed=True)
    sim.reservation = addr
    sim.write_reg(rd, val)
    sim.update_pipe(rd=rd, rs1=rs1, alu_out=addr, mem_out=val, mem_read=True)
    sim.pc += 4

def exec_sc(sim, inst):
    rd, rs1, rs2 = inst['args']
    addr = sim.x[rs1]
    
    if sim.reservation == addr:
        sim.memory.write(addr, sim.x[rs2], 4)
        sim.write_reg(rd, 0) # Success
    else:
        sim.write_reg(rd, 1) # Failure
        
    sim.reservation = None 
    sim.update_pipe(rd=rd, rs1=rs1, rs2=rs2, alu_out=addr, mem_write=True)
    sim.pc += 4

def exec_atomic(sim, inst):
    rd, rs1, rs2 = inst['args']
    addr = sim.x[rs1]
    op = inst['op']
    
    v_mem = sim.memory.read(addr, 4, signed=True)
    v_reg = sim.x[rs2]
    res = 0
    
    def as_signed(n): return struct.unpack('i', struct.pack('I', n & 0xFFFFFFFF))[0]
    def as_unsigned(n): return n & 0xFFFFFFFF
    
    vm_s = as_signed(v_mem)
    vr_s = as_signed(v_reg)
    vm_u = as_unsigned(v_mem)
    vr_u = as_unsigned(v_reg)

    if 'swap' in op: res = v_reg
    elif 'add' in op: res = v_mem + v_reg
    elif 'xor' in op: res = v_mem ^ v_reg
    elif 'and' in op: res = v_mem & v_reg
    elif 'or' in op: res = v_mem | v_reg
    elif 'min' in op and 'u' not in op: res = min(vm_s, vr_s)
    elif 'max' in op and 'u' not in op: res = max(vm_s, vr_s)
    elif 'minu' in op: res = min(vm_u, vr_u)
    elif 'maxu' in op: res = max(vm_u, vr_u)
    
    sim.memory.write(addr, res, 4)
    sim.write_reg(rd, v_mem)
    sim.reservation = None
    sim.update_pipe(rd=rd, rs1=rs1, rs2=rs2, alu_out=addr, mem_out=v_mem, mem_write=True, mem_read=True)
    sim.pc += 4
