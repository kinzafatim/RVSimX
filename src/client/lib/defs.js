export const ABI_NAMES = ["zero", "ra", "sp", "gp", "tp", "t0", "t1", "t2", "s0", "s1", "a0", "a1", "a2", "a3", "a4", "a5", "a6", "a7", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9", "s10", "s11", "t3", "t4", "t5", "t6"];

// --- RV32I Opcodes ---
export const OPCODE_LUI = 0x37; // 0110111
export const OPCODE_AUIPC = 0x17; // 0010111
export const OPCODE_LOAD = 0x03; // 0000011
export const OPCODE_STORE = 0x23; // 0100011
export const OPCODE_IMM = 0x13; // 0010011
export const OPCODE_REG = 0x33; // 0110011
export const OPCODE_BRANCH = 0x63; // 1100011
export const OPCODE_JAL = 0x6F; // 1101111
export const OPCODE_JALR = 0x67; // 1100111
export const OPCODE_SYSTEM = 0x73; // 1110011 (ECALL)
export const OPCODE_ATOMIC = 0x2F; // 0101111 (RV32A)

// --- Funct3 Codes ---
export const F3_ADD_SUB = 0x0;
export const F3_SLL = 0x1;
export const F3_SLT = 0x2;
export const F3_SLTU = 0x3;
export const F3_XOR = 0x4;
export const F3_SRL_SRA = 0x5;
export const F3_OR = 0x6;
export const F3_AND = 0x7;

export const F3_BEQ = 0x0;
export const F3_BNE = 0x1;
export const F3_BLT = 0x4;
export const F3_BGE = 0x5;
export const F3_BLTU = 0x6;
export const F3_BGEU = 0x7;

export const F3_LB = 0x0;
export const F3_LH = 0x1;
export const F3_LW = 0x2;
export const F3_LBU = 0x4;
export const F3_LHU = 0x5;

export const F3_SB = 0x0;
export const F3_SH = 0x1;
export const F3_SW = 0x2;

// RV32A Funct3 (All usually 0x2 for .w)
export const F3_AMO_W = 0x2;

// --- Funct7 Codes ---
export const F7_ADD = 0x00;
export const F7_SUB = 0x20;
export const F7_SRL = 0x00;
export const F7_SRA = 0x20;

// RV32A Funct5 (Top 5 bits of funct7)
export const AMO_LR = 0x02;
export const AMO_SC = 0x03;
export const AMO_SWAP = 0x01;
export const AMO_ADD = 0x00;
export const AMO_XOR = 0x04;
export const AMO_AND = 0x0C;
export const AMO_OR = 0x08;
export const AMO_MIN = 0x10;
export const AMO_MAX = 0x14;
export const AMO_MINU = 0x18;
export const AMO_MAXU = 0x1C;

// Helper: Sign Extend
export function to_signed(val, bits) {
    const hidden = 1 << (bits - 1);
    const mask = (1 << bits) - 1;
    val = val & mask;
    if (val & hidden) {
        return val - (1 << bits);
    }
    return val;
}
