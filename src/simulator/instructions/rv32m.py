
import struct

def exec_m_type(sim, inst):
    rd, rs1, rs2 = inst['args']
    v1 = sim.x[rs1]
    v2 = sim.x[rs2]
    op = inst['op']
    res = 0

    # Helpers
    def to_signed(n): return struct.unpack('i', struct.pack('I', n & 0xFFFFFFFF))[0]
    def to_unsigned(n): return n & 0xFFFFFFFF
    
    s1 = to_signed(v1)
    s2 = to_signed(v2)
    u1 = to_unsigned(v1)
    u2 = to_unsigned(v2)
    
    if op == 'mul':
        res = (s1 * s2) & 0xFFFFFFFF
    elif op == 'mulh':
        full = s1 * s2
        res = (full >> 32) & 0xFFFFFFFF
    elif op == 'mulhsu':
        full = s1 * u2
        res = (full >> 32) & 0xFFFFFFFF
    elif op == 'mulhu':
        full = u1 * u2
        res = (full >> 32) & 0xFFFFFFFF
    elif op == 'div':
        if s2 == 0:
            res = -1 & 0xFFFFFFFF
        elif s1 == -2147483648 and s2 == -1:
            res = -2147483648 & 0xFFFFFFFF
        else:
            res = int(s1 / s2) & 0xFFFFFFFF
    elif op == 'divu':
        if u2 == 0:
            res = 0xFFFFFFFF
        else:
            res = (u1 // u2) & 0xFFFFFFFF
    elif op == 'rem':
        if s2 == 0:
            res = s1 & 0xFFFFFFFF
        elif s1 == -2147483648 and s2 == -1:
            res = 0
        else:
            quot = int(s1 / s2)
            res = (s1 - s2 * quot) & 0xFFFFFFFF
    elif op == 'remu':
        if u2 == 0:
            res = u1 & 0xFFFFFFFF
        else:
            res = (u1 % u2) & 0xFFFFFFFF

    sim.write_reg(rd, res)
    sim.update_pipe(rd=rd, rs1=rs1, rs2=rs2, alu_out=res, alu_src_b='reg')
    sim.pc += 4
