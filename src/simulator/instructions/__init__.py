
from .rv32i import *
from .rv32m import *
from .rv32a import *
from .rv32f import *
from .rv32c import *

def get_executors():
    execs = {}
    
    # I Extension
    items_i = {
        'add': exec_r_type, 'sub': exec_r_type, 'sll': exec_r_type,
        'slt': exec_r_type, 'sltu': exec_r_type, 'xor': exec_r_type,
        'srl': exec_r_type, 'sra': exec_r_type, 'or': exec_r_type,
        'and': exec_r_type,
        'addi': exec_i_type, 'slti': exec_i_type, 'sltiu': exec_i_type,
        'xori': exec_i_type, 'ori': exec_i_type, 'andi': exec_i_type,
        'slli': exec_i_type, 'srli': exec_i_type, 'srai': exec_i_type,
        'lb': exec_load, 'lh': exec_load, 'lw': exec_load,
        'lbu': exec_load, 'lhu': exec_load,
        'sb': exec_store, 'sh': exec_store, 'sw': exec_store,
        'beq': exec_branch, 'bne': exec_branch, 'blt': exec_branch,
        'bge': exec_branch, 'bltu': exec_branch, 'bgeu': exec_branch,
        'jal': exec_jal, 'jalr': exec_jalr,
        'lui': exec_lui, 'auipc': exec_auipc,
        'ecall': exec_ecall
    }
    execs.update(items_i)

    # A Extension
    items_a = {
        'lr.w': exec_lr, 'sc.w': exec_sc,
        'amoswap.w': exec_atomic, 'amoadd.w': exec_atomic,
        'amoxor.w': exec_atomic, 'amoand.w': exec_atomic,
        'amoor.w': exec_atomic, 'amomin.w': exec_atomic,
        'amomax.w': exec_atomic, 'amominu.w': exec_atomic,
        'amomaxu.w': exec_atomic
    }
    execs.update(items_a)

    # M Extension
    items_m = {
        'mul': exec_m_type, 'mulh': exec_m_type, 
        'mulhsu': exec_m_type, 'mulhu': exec_m_type,
        'div': exec_m_type, 'divu': exec_m_type,
        'rem': exec_m_type, 'remu': exec_m_type
    }
    execs.update(items_m)

    # F Extension
    items_f = {
        'flw': exec_flw, 'fsw': exec_fsw,
        'fadd.s': exec_f_arith, 'fsub.s': exec_f_arith, 
        'fmul.s': exec_f_arith, 'fdiv.s': exec_f_arith,
        'fsqrt.s': exec_sqrt, 
        'fsgnj.s': exec_f_arith, 'fsgnjn.s': exec_f_arith, 'fsgnjx.s': exec_f_arith,
        'fmin.s': exec_f_arith, 'fmax.s': exec_f_arith,
        'fcvt.w.s': exec_f_conv, 'fcvt.wu.s': exec_f_conv,
        'fmv.x.w': exec_f_conv, 'feq.s': exec_f_cmp,
        'flt.s': exec_f_cmp, 'fle.s': exec_f_cmp,
        'fcvt.s.w': exec_f_conv, 'fcvt.s.wu': exec_f_conv,
        'fmv.w.x': exec_f_conv
    }
    execs.update(items_f)
    
    # C Extension
    # We map all to exec_c_type
    c_ops = [
        'c.addi', 'c.mv', 'c.add', 'c.sub', 'c.and', 'c.or', 'c.xor',
        'c.li', 'c.lui', 'c.srli', 'c.srai', 'c.andi', 'c.nop',
        'c.lwsp', 'c.swsp', 'c.j', 'c.jal', 'c.jr', 'c.jalr',
        'c.beqz', 'c.bnez'
    ]
    for op in c_ops:
        execs[op] = exec_c_type
        
    return execs
