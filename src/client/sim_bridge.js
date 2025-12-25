/* simulator.js - Pure JS RISC-V Simulator (RV32I) */

class Memory {
    constructor() {
        this.data = new Map(); // Address -> Byte
    }

    read(addr, size, signed = false) {
        let val = 0;
        for (let i = 0; i < size; i++) {
            const byte = this.data.get(addr + i) || 0;
            // Little Endian
            val |= (byte << (i * 8));
        }

        if (signed) {
            // Sign extend
            const bits = size * 8;
            if (val & (1 << (bits - 1))) {
                // JS masking to 32-bit signed
                val = (val | (0xFFFFFFFF << bits));
            }
        } else {
            val = val >>> 0;
        }
        return val | 0; // force 32-bit signed int representation for JS logic
    }

    write(addr, val, size) {
        for (let i = 0; i < size; i++) {
            this.data.set(addr + i, (val >> (i * 8)) & 0xFF);
        }
    }

    getMap() {
        const obj = {};
        for (const [k, v] of this.data) {
            obj[k] = v;
        }
        return obj;
    }

    clear() {
        this.data.clear();
    }
}

// Instruction Encodings (Opcode, Funct3, Funct7)
const ENCODING = {
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
    'ecall': { type: 'I', opcode: 0x73, funct3: 0x0, funct7: 0x00 }
};

class RISCVSimulator {
    constructor() {
        this.memory = new Memory();
        this.history = []; // State history stack
        this.reset();
        this.programData = [];
    }

    reset() {
        this.x = new Int32Array(32).fill(0);
        this.x[2] = 0x7FFFFFF0; // SP
        this.pc = 0;
        this.memory.clear();
        this.pipeline_state = this.empty_pipeline_state();
        this.history = [];

        // Restore data segment
        if (this.programData) {
            for (const write of this.programData) {
                this.memory.write(write.addr, write.val, write.size);
            }
        }
    }

    empty_pipeline_state() {
        return {
            pc: 0, inst: 0,
            rs1: 0, rs2: 0, rd: 0, imm: 0,
            alu_out: 0, mem_out: 0,
            reg_write: false, mem_write: false, mem_read: false,
            branch_taken: false,
            alu_src_a: 'reg', alu_src_b: 'reg', mem_to_reg: 'alu',
            branch: false, jump: false
        };
    }

    assemble(code) {
        this.program = [];
        this.programData = [];
        this.labels = {};
        this.history = [];

        const lines = code.split('\n');
        let currentAddr = 0;
        const pass1Items = [];

        // --- Pass 1: Parse, Labels, Addresses ---
        for (let rawLine of lines) {
            const line = rawLine.split('#')[0].replace(/^\s+|\s+$/g, '');
            if (!line) continue;

            if (line.startsWith('.')) {
                if (line.startsWith('.text') || line.startsWith('.data') || line.startsWith('.globl')) continue;
            }

            if (line.endsWith(':')) {
                const label = line.slice(0, -1);
                this.labels[label] = currentAddr;
                continue;
            }
            if (line.includes(':')) {
                const parts = line.split(':');
                const label = parts[0].trim();
                this.labels[label] = currentAddr;
                const rest = parts[1].trim();
                if (rest) pass1Items.push({ line: rest, addr: currentAddr });

                if (rest.startsWith('.')) {
                    if (rest.startsWith('.word')) currentAddr += 4;
                    else if (rest.startsWith('.byte')) currentAddr += 1;
                    else if (rest.startsWith('.string') || rest.startsWith('.asciz')) {
                        const str = rest.match(/"([^"]*)"/);
                        if (str) currentAddr += str[1].length + 1;
                    }
                } else {
                    currentAddr += 4;
                }
                continue;
            }

            pass1Items.push({ line, addr: currentAddr });
            if (line.startsWith('.')) {
                if (line.startsWith('.word')) currentAddr += 4;
                else if (line.startsWith('.byte')) currentAddr += 1;
                else if (line.startsWith('.string') || line.startsWith('.asciz')) {
                    const str = line.match(/"([^"]*)"/);
                    if (str) currentAddr += str[1].length + 1;
                }
            } else {
                currentAddr += 4;
            }
        }

        // --- Pass 2: Generation ---
        for (const item of pass1Items) {
            const line = item.line;
            const addr = item.addr;

            try {
                if (line.startsWith('.')) {
                    this.handle_directive(line, addr);
                } else {
                    const inst = this.parse_instruction(line, addr);
                    this.program.push(inst);
                    // Write Code to Memory as well
                    this.programData.push({ addr: inst.address, val: inst.machine_code, size: 4 });
                }
            } catch (e) {
                return { success: false, message: `Error at '${line}': ${e.message}` };
            }
        }

        return { success: true, message: "Assembled", program: this.program };
    }

    handle_directive(line, addr) {
        const parts = line.replace(/,/g, ' ').trim().split(/\s+/);
        const dir = parts[0];

        if (dir === '.word') {
            const val = this.resolve_imm(parts[1], addr);
            this.programData.push({ addr, val, size: 4 });
        } else if (dir === '.byte') {
            const val = this.resolve_imm(parts[1], addr);
            this.programData.push({ addr, val, size: 1 });
        } else if (dir === '.string' || dir === '.asciz') {
            const buf = line.match(/"([^"]*)"/);
            if (buf) {
                const str = buf[1];
                for (let i = 0; i < str.length; i++) {
                    this.programData.push({ addr: addr + i, val: str.charCodeAt(i), size: 1 });
                }
                this.programData.push({ addr: addr + str.length, val: 0, size: 1 });
            }
        }
    }

    parse_instruction(line, addr) {
        const parts = line.replace(/,/g, ' ').replace(/\(/g, ' ').replace(/\)/g, ' ').trim().split(/\s+/);
        let op = parts[0].toLowerCase();
        let args = parts.slice(1);

        const inst = {
            address: addr,
            source: line,
            basic_code: line,
            op: op,
            args: [],
            machine_code: 0
        };

        if (op === 'li') {
            inst.op = 'addi'; inst.type = 'I';
            inst.args = [this.get_reg(args[0]), 0, this.resolve_imm(args[1], addr)];
            op = 'addi';
        } else if (op === 'mv') {
            inst.op = 'addi'; inst.type = 'I';
            inst.args = [this.get_reg(args[0]), this.get_reg(args[1]), 0];
            op = 'addi';
        } else if (op === 'nop') {
            inst.op = 'addi'; inst.type = 'I';
            inst.args = [0, 0, 0];
            op = 'addi';
        } else if (op === 'j') {
            inst.op = 'jal'; inst.type = 'J';
            inst.args = [0, this.resolve_imm(args[0], addr)];
            op = 'jal';
        }

        if (!inst.args.length) {
            const schema = ENCODING[op];
            if (!schema) throw new Error("Unknown opcode");
            inst.type = schema.type;

            if (schema.type === 'R') {
                inst.args = [this.get_reg(args[0]), this.get_reg(args[1]), this.get_reg(args[2])];
            } else if (schema.type === 'I') {
                if (['lb', 'lh', 'lw', 'lbu', 'lhu', 'jalr'].includes(op)) {
                    inst.args = [this.get_reg(args[0]), this.resolve_imm(args[1], addr), this.get_reg(args[2])];
                } else {
                    inst.args = [this.get_reg(args[0]), this.get_reg(args[1]), this.resolve_imm(args[2], addr)];
                }
            } else if (schema.type === 'S') {
                inst.args = [this.get_reg(args[0]), this.resolve_imm(args[1], addr), this.get_reg(args[2])];
            } else if (schema.type === 'B') {
                inst.args = [this.get_reg(args[0]), this.get_reg(args[1]), this.resolve_imm(args[2], addr)];
            } else if (schema.type === 'U') {
                inst.args = [this.get_reg(args[0]), this.resolve_imm(args[1], addr)];
            } else if (schema.type === 'J') {
                inst.args = [this.get_reg(args[0]), this.resolve_imm(args[1], addr)];
            }
        }

        inst.machine_code = this.encode(op, inst.args);
        return inst;
    }

    get_reg(s) {
        if (!s) return 0;
        s = s.toLowerCase();
        if (s === 'zero' || s === 'x0') return 0;
        if (s.startsWith('x')) {
            const val = parseInt(s.substring(1));
            return isNaN(val) ? 0 : val;
        }
        const abis = ['zero', 'ra', 'sp', 'gp', 'tp', 't0', 't1', 't2', 's0', 's1', 'a0', 'a1', 'a2',
            'a3', 'a4', 'a5', 'a6', 'a7', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9',
            's10', 's11', 't3', 't4', 't5', 't6'];
        const idx = abis.indexOf(s);
        return idx !== -1 ? idx : 0;
    }

    resolve_imm(s, currentAddr) {
        if (!s) return 0;
        if (this.labels.hasOwnProperty(s)) {
            return this.labels[s] - currentAddr;
        }
        if (s.toLowerCase().startsWith('0x')) return parseInt(s, 16);
        return parseInt(s);
    }

    encode(op, args) {
        const info = ENCODING[op];
        if (!info) return 0;

        const [a1, a2, a3] = args;
        let mc = 0;

        if (info.type === 'R') {
            mc = (info.funct7 << 25) | (a3 << 20) | (a2 << 15) | (info.funct3 << 12) | (a1 << 7) | info.opcode;
        } else if (info.type === 'I') {
            if (['lb', 'lh', 'lw', 'lbu', 'lhu', 'jalr'].includes(op)) {
                mc = ((a2 & 0xFFF) << 20) | (a3 << 15) | (info.funct3 << 12) | (a1 << 7) | info.opcode;
            } else {
                let imm = a3;
                if (['slli', 'srli', 'srai'].includes(op)) imm = imm & 0x1F;
                if (info.funct7) {
                    mc = (info.funct7 << 25) | (imm << 20) | (a2 << 15) | (info.funct3 << 12) | (a1 << 7) | info.opcode;
                } else {
                    mc = ((imm & 0xFFF) << 20) | (a2 << 15) | (info.funct3 << 12) | (a1 << 7) | info.opcode;
                }
            }
        } else if (info.type === 'S') {
            const imm = a2;
            const imm11_5 = (imm >> 5) & 0x7F;
            const imm4_0 = imm & 0x1F;
            mc = (imm11_5 << 25) | (a1 << 20) | (a3 << 15) | (info.funct3 << 12) | (imm4_0 << 7) | info.opcode;
        } else if (info.type === 'B') {
            const imm = a3;
            const bit12 = (imm >> 12) & 1;
            const bit11 = (imm >> 11) & 1;
            const bit10_5 = (imm >> 5) & 0x3F;
            const bit4_1 = (imm >> 1) & 0xF;
            mc = (bit12 << 31) | (bit10_5 << 25) | (a2 << 20) | (a1 << 15) | (info.funct3 << 12) | (bit4_1 << 8) | (bit11 << 7) | info.opcode;
        } else if (info.type === 'U') {
            const imm = a2;
            mc = ((imm & 0xFFFFF) << 12) | (a1 << 7) | info.opcode;
        } else if (info.type === 'J') {
            const imm = a2;
            const bit20 = (imm >> 20) & 1;
            const bit10_1 = (imm >> 1) & 0x3FF;
            const bit11 = (imm >> 11) & 1;
            const bit19_12 = (imm >> 12) & 0xFF;
            mc = (bit20 << 31) | (bit10_1 << 21) | (bit11 << 20) | (bit19_12 << 12) | (a1 << 7) | info.opcode;
        }
        return mc >>> 0;
    }

    step() {
        const pcIdx = this.pc / 4;
        const inst = this.program.find(i => i.address === this.pc);

        if (!inst) return false;

        // Save State for Prev functionality
        // deep clone registers and memory map
        this.history.push({
            x: new Int32Array(this.x),
            pc: this.pc,
            memoryData: new Map(this.memory.data),
            pipeline: { ...this.pipeline_state }
        });

        // Cap history to prevent memory leaks in excessively long sessions, e.g. 500 steps
        // If user runs 1000 steps, they can't undo all the way back, which is standard performance tradeoff.
        if (this.history.length > 500) {
            this.history.shift();
        }

        this.pipeline_state = this.empty_pipeline_state();
        this.pipeline_state.pc = this.pc;
        this.pipeline_state.inst = inst.machine_code;

        try {
            this.execute_inst(inst);
        } catch (e) {
            console.error(e);
            return false;
        }

        this.x[0] = 0;
        return true;
    }

    // NEW: Restore previous state
    stepBack() {
        if (this.history.length === 0) return false;
        const prev = this.history.pop();

        this.x = prev.x;
        this.pc = prev.pc;
        this.memory.data = prev.memoryData;
        this.pipeline_state = prev.pipeline;
        return true;
    }

    // NEW: Get Memory Dump String
    getMemoryDump() {
        const keys = Array.from(this.memory.data.keys()).sort((a, b) => a - b);
        if (keys.length === 0) return "Memory is empty.";

        let output = "";
        const min = keys[0];
        const max = keys[keys.length - 1];

        // Align to 16-byte rows
        const start = min - (min % 16);
        const end = max + (16 - (max % 16));

        for (let base = start; base < end; base += 16) {
            // Only print row if it has data? Or assume sparse dump?
            // "Download Hex DM" usually implies a clean format. 
            // We'll print rows that have at least one byte defined, or gaps.
            // Let's print only non-empty rows for efficiency.
            let hasData = false;
            for (let i = 0; i < 16; i++) {
                if (this.memory.data.has(base + i)) { hasData = true; break; }
            }

            if (hasData) {
                let row = `${base.toString(16).padStart(8, '0').toUpperCase()}: `;
                let ascii = '';
                for (let i = 0; i < 16; i++) {
                    const addr = base + i;
                    const val = this.memory.data.get(addr);
                    if (val !== undefined) {
                        row += val.toString(16).padStart(2, '0').toUpperCase() + " ";
                        // ascii friendly char
                        ascii += (val >= 32 && val <= 126) ? String.fromCharCode(val) : '.';
                    } else {
                        row += "00 ";
                        ascii += '.';
                    }
                }
                output += `${row}  |${ascii}|\n`;
            }
        }
        return output;
    }

    run() {
        let steps = 0;
        while (steps < 10000) {
            if (!this.step()) break;
            steps++;
        }
    }

    execute_inst(inst) {
        const op = inst.op;
        const args = inst.args;
        if (op === 'add') { this.wr(args[0], this.r(args[1]) + this.r(args[2])); }
        else if (op === 'sub') { this.wr(args[0], this.r(args[1]) - this.r(args[2])); }
        else if (op === 'xor') { this.wr(args[0], this.r(args[1]) ^ this.r(args[2])); }
        else if (op === 'or') { this.wr(args[0], this.r(args[1]) | this.r(args[2])); }
        else if (op === 'and') { this.wr(args[0], this.r(args[1]) & this.r(args[2])); }
        else if (op === 'sll') { this.wr(args[0], this.r(args[1]) << (this.r(args[2]) & 0x1F)); }
        else if (op === 'srl') { this.wr(args[0], this.r(args[1]) >>> (this.r(args[2]) & 0x1F)); }
        else if (op === 'sra') { this.wr(args[0], this.r(args[1]) >> (this.r(args[2]) & 0x1F)); }
        else if (op === 'slt') { this.wr(args[0], this.r(args[1]) < this.r(args[2]) ? 1 : 0); }
        else if (op === 'sltu') { this.wr(args[0], (this.r(args[1]) >>> 0) < (this.r(args[2]) >>> 0) ? 1 : 0); }

        else if (op === 'addi') { this.wr(args[0], this.r(args[1]) + args[2]); }
        else if (op === 'xori') { this.wr(args[0], this.r(args[1]) ^ args[2]); }
        else if (op === 'ori') { this.wr(args[0], this.r(args[1]) | args[2]); }
        else if (op === 'andi') { this.wr(args[0], this.r(args[1]) & args[2]); }
        else if (op === 'slli') { this.wr(args[0], this.r(args[1]) << (args[2] & 0x1F)); }
        else if (op === 'srli') { this.wr(args[0], this.r(args[1]) >>> (args[2] & 0x1F)); }
        else if (op === 'srai') { this.wr(args[0], this.r(args[1]) >> (args[2] & 0x1F)); }
        else if (op === 'slti') { this.wr(args[0], this.r(args[1]) < args[2] ? 1 : 0); }
        else if (op === 'sltiu') { this.wr(args[0], (this.r(args[1]) >>> 0) < (args[2] >>> 0) ? 1 : 0); }

        else if (op === 'lb') { this.wr(args[0], this.memory.read(this.r(args[2]) + args[1], 1, true)); }
        else if (op === 'lh') { this.wr(args[0], this.memory.read(this.r(args[2]) + args[1], 2, true)); }
        else if (op === 'lw') { this.wr(args[0], this.memory.read(this.r(args[2]) + args[1], 4, true)); }
        else if (op === 'lbu') { this.wr(args[0], this.memory.read(this.r(args[2]) + args[1], 1, false)); }
        else if (op === 'lhu') { this.wr(args[0], this.memory.read(this.r(args[2]) + args[1], 2, false)); }

        else if (op === 'sb') {
            this.memory.write(this.r(args[2]) + args[1], this.r(args[0]), 1);
            this.pc += 4;
        }
        else if (op === 'sh') {
            this.memory.write(this.r(args[2]) + args[1], this.r(args[0]), 2);
            this.pc += 4;
        }
        else if (op === 'sw') {
            this.memory.write(this.r(args[2]) + args[1], this.r(args[0]), 4);
            this.pc += 4;
        }

        else if (op === 'beq') { this.pc += (this.r(args[0]) === this.r(args[1])) ? args[2] : 4; }
        else if (op === 'bne') { this.pc += (this.r(args[0]) !== this.r(args[1])) ? args[2] : 4; }
        else if (op === 'blt') { this.pc += (this.r(args[0]) < this.r(args[1])) ? args[2] : 4; }
        else if (op === 'bge') { this.pc += (this.r(args[0]) >= this.r(args[1])) ? args[2] : 4; }
        else if (op === 'bltu') { this.pc += ((this.r(args[0]) >>> 0) < (this.r(args[1]) >>> 0)) ? args[2] : 4; }
        else if (op === 'bgeu') { this.pc += ((this.r(args[0]) >>> 0) >= (this.r(args[1]) >>> 0)) ? args[2] : 4; }

        else if (op === 'jal') {
            const temp = this.pc + 4;
            this.pc += args[1];
            if (args[0] !== 0) this.x[args[0]] = temp;
        }
        else if (op === 'jalr') {
            const temp = this.pc + 4;
            this.pc = (this.r(args[2]) + args[1]) & ~1;
            if (args[0] !== 0) this.x[args[0]] = temp;
        }
        else if (op === 'lui') { this.wr(args[0], (args[1] << 12)); }
        else if (op === 'auipc') { this.wr(args[0], this.pc + (args[1] << 12)); }

        else if (op === 'ecall') {
            if (this.x[17] === 93) this.pc = -1; // End
            else this.pc += 4;
        }
        else { this.pc += 4; }

        this.pipeline_state.reg_write = ['R', 'I', 'U', 'J'].includes(ENCODING[op]?.type);
        this.pipeline_state.mem_to_reg = ['lb', 'lh', 'lw'].includes(op) ? 'mem' : 'alu';
        this.pipeline_state.mem_write = ['S'].includes(ENCODING[op]?.type);
    }

    r(idx) { return this.x[idx]; }
    wr(idx, val) {
        if (idx !== 0) this.x[idx] = val | 0;
        this.pc += 4;
    }

    getState() {
        return {
            registers: Array.from(this.x),
            pc: this.pc,
            memory: this.memory.getMap(),
            pipeline: this.pipeline_state
        };
    }
}

const sim = new RISCVSimulator();

export async function initSimulator() { return true; }
export async function assemble(code) {
    return new Promise(resolve => resolve(sim.assemble(code)));
}
export async function step() {
    return new Promise(resolve => {
        const success = sim.step();
        resolve({ success, state: sim.getState() });
    });
}
export async function run() {
    return new Promise(resolve => {
        sim.run();
        resolve({ success: true, state: sim.getState() });
    });
}
export async function reset() {
    return new Promise(resolve => {
        sim.reset();
        resolve({ success: true, state: sim.getState() });
    });
}
export async function stepBack() {
    return new Promise(resolve => {
        const success = sim.stepBack();
        resolve({ success, state: sim.getState() });
    });
}
export async function getMemoryDump() {
    return sim.getMemoryDump();
}
