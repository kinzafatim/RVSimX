// Instruction Encodings
export const ENCODING = {
    'add': { type: 'R', opcode: 0x33, funct3: 0x0, funct7: 0x00 },
    'sub': { type: 'R', opcode: 0x33, funct3: 0x0, funct7: 0x20 },
    'sll': { type: 'R', opcode: 0x33, funct3: 0x1, funct7: 0x00 },
    'slt': { type: 'R', opcode: 0x33, funct3: 0x2, funct7: 0x00 },
    'sltu': { type: 'R', opcode: 0x33, funct3: 0x3, funct7: 0x00 },
    'xor': { type: 'R', opcode: 0x33, funct3: 0x4, funct7: 0x00 },
    'srl': { type: 'R', opcode: 0x33, funct3: 0x5, funct7: 0x00 },
    'sra': { type: 'R', opcode: 0x33, funct3: 0x5, funct7: 0x20 },
    'or': { type: 'R', opcode: 0x33, funct3: 0x6, funct7: 0x00 },
    'and': { type: 'R', opcode: 0x33, funct3: 0x7, funct7: 0x00 },

    'addi': { type: 'I', opcode: 0x13, funct3: 0x0 },
    'slti': { type: 'I', opcode: 0x13, funct3: 0x2 },
    'sltiu': { type: 'I', opcode: 0x13, funct3: 0x3 },
    'xori': { type: 'I', opcode: 0x13, funct3: 0x4 },
    'ori': { type: 'I', opcode: 0x13, funct3: 0x6 },
    'andi': { type: 'I', opcode: 0x13, funct3: 0x7 },
    'slli': { type: 'I', opcode: 0x13, funct3: 0x1, funct7: 0x00 },
    'srli': { type: 'I', opcode: 0x13, funct3: 0x5, funct7: 0x00 },
    'srai': { type: 'I', opcode: 0x13, funct3: 0x5, funct7: 0x20 },

    'lb': { type: 'I', opcode: 0x03, funct3: 0x0 },
    'lh': { type: 'I', opcode: 0x03, funct3: 0x1 },
    'lw': { type: 'I', opcode: 0x03, funct3: 0x2 },
    'lbu': { type: 'I', opcode: 0x03, funct3: 0x4 },
    'lhu': { type: 'I', opcode: 0x03, funct3: 0x5 },

    'sb': { type: 'S', opcode: 0x23, funct3: 0x0 },
    'sh': { type: 'S', opcode: 0x23, funct3: 0x1 },
    'sw': { type: 'S', opcode: 0x23, funct3: 0x2 },

    'beq': { type: 'B', opcode: 0x63, funct3: 0x0 },
    'bne': { type: 'B', opcode: 0x63, funct3: 0x1 },
    'blt': { type: 'B', opcode: 0x63, funct3: 0x4 },
    'bge': { type: 'B', opcode: 0x63, funct3: 0x5 },
    'bltu': { type: 'B', opcode: 0x63, funct3: 0x6 },
    'bgeu': { type: 'B', opcode: 0x63, funct3: 0x7 },

    'jal': { type: 'J', opcode: 0x6F },
    'jalr': { type: 'I', opcode: 0x67, funct3: 0x0 },
    'lui': { type: 'U', opcode: 0x37 },
    'auipc': { type: 'U', opcode: 0x17 },
    'ecall': { type: 'I', opcode: 0x73, funct3: 0x0, funct7: 0x00 },

    // RV32A
    // funct7 = (funct5 << 2)
    'lr.w': { type: 'R', opcode: 0x2F, funct3: 0x2, funct7: 0x08 }, // 00010 00
    'sc.w': { type: 'R', opcode: 0x2F, funct3: 0x2, funct7: 0x0C }, // 00011 00
    'amoswap.w': { type: 'R', opcode: 0x2F, funct3: 0x2, funct7: 0x04 }, // 00001 00
    'amoadd.w': { type: 'R', opcode: 0x2F, funct3: 0x2, funct7: 0x00 }, // 00000 00
    'amoxor.w': { type: 'R', opcode: 0x2F, funct3: 0x2, funct7: 0x10 }, // 00100 00
    'amoand.w': { type: 'R', opcode: 0x2F, funct3: 0x2, funct7: 0x30 }, // 01100 00
    'amoor.w': { type: 'R', opcode: 0x2F, funct3: 0x2, funct7: 0x20 }, // 01000 00
    'amomin.w': { type: 'R', opcode: 0x2F, funct3: 0x2, funct7: 0x40 }, // 10000 00
    'amomax.w': { type: 'R', opcode: 0x2F, funct3: 0x2, funct7: 0x50 }, // 10100 00
    'amominu.w': { type: 'R', opcode: 0x2F, funct3: 0x2, funct7: 0x60 }, // 11000 00
    'amomaxu.w': { type: 'R', opcode: 0x2F, funct3: 0x2, funct7: 0x70 }  // 11100 00
};
