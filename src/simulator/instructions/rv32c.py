
def exec_c_type(sim, inst):
    op = inst['op']
    args = inst['args']
    
    # helper
    def sext(v, bits):
        shift = 32 - bits
        if v & (1 << (bits - 1)):
            return v - (1 << bits)
        return v
        
    if op == 'c.nop':
        sim.pc += 2
        pass 
        
    elif op == 'c.addi':
        rd, imm = args
        v1 = sim.x[rd]
        res = (v1 + imm) & 0xFFFFFFFF
        sim.write_reg(rd, res)
        sim.update_pipe(rd=rd, rs1=rd, imm=imm, alu_out=res)
        sim.pc += 2
        
    elif op == 'c.mv':
        rd, rs2 = args
        val = sim.x[rs2]
        sim.write_reg(rd, val)
        sim.update_pipe(rd=rd, rs1=0, rs2=rs2, alu_out=val)
        sim.pc += 2
        
    elif op == 'c.add':
        rd, rs2 = args
        v1 = sim.x[rd]
        v2 = sim.x[rs2]
        res = (v1 + v2) & 0xFFFFFFFF
        sim.write_reg(rd, res)
        sim.update_pipe(rd=rd, rs1=rd, rs2=rs2, alu_out=res)
        sim.pc += 2
        
    elif op == 'c.sub':
        rd, rs2 = args
        v1 = sim.x[rd]
        v2 = sim.x[rs2]
        res = (v1 - v2) & 0xFFFFFFFF
        sim.write_reg(rd, res)
        sim.update_pipe(rd=rd, rs1=rd, rs2=rs2, alu_out=res)
        sim.pc += 2
        
    elif op == 'c.and':
        rd, rs2 = args
        v1 = sim.x[rd]
        v2 = sim.x[rs2]
        res = v1 & v2
        sim.write_reg(rd, res)
        sim.update_pipe(rd=rd, rs1=rd, rs2=rs2, alu_out=res)
        sim.pc += 2
        
    elif op == 'c.or':
        rd, rs2 = args
        v1 = sim.x[rd]
        v2 = sim.x[rs2]
        res = v1 | v2
        sim.write_reg(rd, res)
        sim.update_pipe(rd=rd, rs1=rd, rs2=rs2, alu_out=res)
        sim.pc += 2
        
    elif op == 'c.xor':
        rd, rs2 = args
        v1 = sim.x[rd]
        v2 = sim.x[rs2]
        res = v1 ^ v2
        sim.write_reg(rd, res)
        sim.update_pipe(rd=rd, rs1=rd, rs2=rs2, alu_out=res)
        sim.pc += 2

    elif op == 'c.li':
        rd, imm = args
        sim.write_reg(rd, imm)
        sim.update_pipe(rd=rd, imm=imm, alu_out=imm)
        sim.pc += 2
        
    elif op == 'c.lui':
        rd, imm = args
        val = (imm << 12) & 0xFFFFFFFF
        sim.write_reg(rd, val)
        sim.update_pipe(rd=rd, imm=imm, alu_out=val)
        sim.pc += 2
        
    elif op == 'c.srli':
        rd, shamt = args
        v1 = sim.x[rd]
        res = (v1 & 0xFFFFFFFF) >> shamt
        sim.write_reg(rd, res)
        sim.update_pipe(rd=rd, rs1=rd, imm=shamt, alu_out=res)
        sim.pc += 2
        
    elif op == 'c.srai':
        rd, shamt = args
        v1 = sim.x[rd]
        import struct
        val_s = struct.unpack('i', struct.pack('I', v1 & 0xFFFFFFFF))[0]
        res = val_s >> shamt
        sim.write_reg(rd, res)
        sim.update_pipe(rd=rd, rs1=rd, imm=shamt, alu_out=res)
        sim.pc += 2
        
    elif op == 'c.andi':
        rd, imm = args
        v1 = sim.x[rd]
        res = v1 & imm
        sim.write_reg(rd, res)
        sim.update_pipe(rd=rd, rs1=rd, imm=imm, alu_out=res)
        sim.pc += 2
        
    elif op == 'c.j':
        imm = args[0]
        sim.pc += imm # jump
        sim.update_pipe(imm=imm, jump=True, branch_taken=True)
        return 
        
    elif op == 'c.jal':
        imm = args[0]
        next_inst = sim.pc + 2
        sim.write_reg(1, next_inst) 
        sim.pc = (sim.pc + imm) & 0xFFFFFFFF # jump from current PC?
        # Warning: if sim.pc was not updated blindly, this is correct.
        sim.update_pipe(rd=1, imm=imm, jump=True, branch_taken=True)
        return
        
    elif op == 'c.jr':
        rs1 = args[0]
        target = sim.x[rs1]
        sim.pc = target & ~1
        sim.update_pipe(rs1=rs1, jump=True, branch_taken=True)
        return
        
    elif op == 'c.jalr':
        rs1 = args[0]
        next_inst = sim.pc + 2
        target = sim.x[rs1]
        sim.write_reg(1, next_inst)
        sim.pc = target & ~1
        sim.update_pipe(rd=1, rs1=rs1, jump=True, branch_taken=True)
        return
        
    elif op == 'c.lwsp':
        rd, imm = args
        addr = (sim.x[2] + imm) & 0xFFFFFFFF 
        val = sim.memory.read(addr, 4)
        sim.write_reg(rd, val)
        sim.update_pipe(rd=rd, rs1=2, imm=imm, alu_out=addr, mem_out=val, mem_read=True)
        sim.pc += 2
        
    elif op == 'c.swsp':
        rs2, imm = args
        addr = (sim.x[2] + imm) & 0xFFFFFFFF
        val = sim.x[rs2]
        sim.memory.write(addr, val, 4)
        sim.update_pipe(rs1=2, rs2=rs2, imm=imm, alu_out=addr, mem_write=True)
        sim.pc += 2 

    elif op == 'c.beqz':
        rs1, imm = args
        v1 = sim.x[rs1]
        take = (v1 == 0)
        sim.update_pipe(rs1=rs1, imm=imm, branch=True, branch_taken=take)
        if take: sim.pc += imm
        else: sim.pc += 2
        return

    elif op == 'c.bnez':
        rs1, imm = args
        v1 = sim.x[rs1]
        take = (v1 != 0)
        sim.update_pipe(rs1=rs1, imm=imm, branch=True, branch_taken=take)
        if take: sim.pc += imm
        else: sim.pc += 2
        return
