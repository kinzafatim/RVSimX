import { Memory } from './memory.js';
import { ENCODING } from './encoding.js';
import * as D from './defs.js';

export class RISCVSimulator {
    constructor() {
        this.memory = new Memory();
        this.history = [];
        this.reset();
        this.programData = [];
        // Program map for disassembly/debugging UI lookup
        // address -> { source, basic_code }
        this.debugInfo = new Map();
    }

    reset() {
        this.x = new Int32Array(32).fill(0);
        this.x[2] = 0x7FFFFFF0; // SP
        this.pc = 0;
        this.memory.clear();
        this.pipeline_state = this.empty_pipeline_state();
        this.reservation = null; // for LR/SC
        this.history = [];
        this.cycles = 0;

        // Reload Data/Text if present (Assembler output)
        if (this.programData && this.programData.length > 0) {
            for (const item of this.programData) {
                this.memory.write(item.addr, item.val, item.size);
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

    // --- Assembler (Generates Machine Code & Loads Memory) ---
    assemble(code) {
        this.programData = []; // Clear previous load
        this.debugInfo.clear();
        this.labels = {};

        // ... (Keep existingassembler logic, but ensure it populates programData correctly)
        // We will reuse the robust assembler logic from before, but simplified to just fill programData

        const lines = code.split('\n');
        let currentAddr = 0;
        const pass1Items = [];

        // Pass 1
        for (let rawLine of lines) {
            const line = rawLine.split('#')[0].replace(/^\s+|\s+$/g, '');
            if (!line) continue;
            if (line.startsWith('.')) {
                if (line.startsWith('.text') || line.startsWith('.data') || line.startsWith('.globl')) continue;
            }
            if (line.endsWith(':')) {
                this.labels[line.slice(0, -1)] = currentAddr;
                continue;
            }
            if (line.includes(':')) {
                const parts = line.split(':');
                this.labels[parts[0].trim()] = currentAddr;
                const rest = parts[1].trim();
                if (rest) pass1Items.push({ line: rest, addr: currentAddr });

                // Increment based on type
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

        const programList = []; // For UI display

        // Pass 2
        for (const item of pass1Items) {
            const line = item.line;
            const addr = item.addr;
            try {
                if (line.startsWith('.')) {
                    this.handle_directive(line, addr);
                } else {
                    const inst = this.parse_instruction(line, addr);
                    // Write Instruction to Memory
                    this.memory.write(addr, inst.machine_code, 4);
                    // Store for Reload
                    this.programData.push({ addr, val: inst.machine_code, size: 4 });
                    // Store Debug Info
                    this.debugInfo.set(addr, inst);
                    programList.push(inst);
                }
            } catch (e) {
                return { success: false, message: `Error at '${line}': ${e.message}` };
            }
        }

        // Prepare simulator
        this.reset();
        return { success: true, message: "Assembled", program: programList };
    }

    // ... (Keep helper methods: handle_directive, parse_instruction, get_reg, resolve_imm, encode) ...
    // Copying over previous implementation for brevity in tool call, simulating full content
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
                for (let i = 0; i < str.length; i++) this.programData.push({ addr: addr + i, val: str.charCodeAt(i), size: 1 });
                this.programData.push({ addr: addr + str.length, val: 0, size: 1 });
            }
        }
    }

    parse_instruction(line, addr) {
        // ... (Same as updated previous version) ...
        const parts = line.replace(/,/g, ' ').replace(/\(/g, ' ').replace(/\)/g, ' ').trim().split(/\s+/);
        let rawOp = parts[0].toLowerCase();
        let args = parts.slice(1);
        let op = rawOp;
        let aq = 0; let rl = 0;

        if (op.includes('.') && (op.startsWith('amo') || op.startsWith('lr') || op.startsWith('sc'))) {
            if (op.endsWith('.aqrl')) { aq = 1; rl = 1; op = op.replace('.aqrl', ''); }
            else if (op.endsWith('.aq')) { aq = 1; op = op.replace('.aq', ''); }
            else if (op.endsWith('.rl')) { rl = 1; op = op.replace('.rl', ''); }
        }

        const inst = { address: addr, source: line, basic_code: line, op: op, rawOp: rawOp, aq, rl, args: [], machine_code: 0 };

        if (op === 'li') { inst.op = 'addi'; inst.type = 'I'; inst.args = [this.get_reg(args[0]), 0, this.resolve_imm(args[1], addr)]; op = 'addi'; }
        else if (op === 'mv') { inst.op = 'addi'; inst.type = 'I'; inst.args = [this.get_reg(args[0]), this.get_reg(args[1]), 0]; op = 'addi'; }
        else if (op === 'nop') { inst.op = 'addi'; inst.type = 'I'; inst.args = [0, 0, 0]; op = 'addi'; }
        else if (op === 'j') { inst.op = 'jal'; inst.type = 'J'; inst.args = [0, this.resolve_imm(args[0], addr)]; op = 'jal'; }

        if (!inst.args.length) {
            const schema = ENCODING[op];
            if (!schema) throw new Error("Unknown opcode");
            inst.type = schema.type;
            if (schema.type === 'R') inst.args = [this.get_reg(args[0]), this.get_reg(args[1]), this.get_reg(args[2])];
            else if (schema.type === 'I') {
                if (['lb', 'lh', 'lw', 'lbu', 'lhu', 'jalr'].includes(op)) inst.args = [this.get_reg(args[0]), this.resolve_imm(args[1], addr), this.get_reg(args[2])];
                else inst.args = [this.get_reg(args[0]), this.get_reg(args[1]), this.resolve_imm(args[2], addr)];
            }
            else if (schema.type === 'S') inst.args = [this.get_reg(args[0]), this.resolve_imm(args[1], addr), this.get_reg(args[2])];
            else if (schema.type === 'B') inst.args = [this.get_reg(args[0]), this.get_reg(args[1]), this.resolve_imm(args[2], addr)];
            else if (schema.type === 'U' || schema.type === 'J') inst.args = [this.get_reg(args[0]), this.resolve_imm(args[1], addr)];
        } else if (['lr.w', 'sc.w', 'amoswap.w', 'amoadd.w', 'amoxor.w', 'amoand.w', 'amoor.w', 'amomin.w', 'amomax.w', 'amominu.w', 'amomaxu.w'].includes(op)) {
            inst.type = 'R';
            if (op === 'lr.w') inst.args = [this.get_reg(args[0]), this.get_reg(args[1]), 0];
            else inst.args = [this.get_reg(args[0]), this.get_reg(args[2]), this.get_reg(args[1])]; // [rd, rs1, rs2]
        }

        inst.machine_code = this.encode(inst);
        return inst;
    }

    get_reg(s) {
        if (!s) return 0;
        s = s.toLowerCase();
        if (s === 'zero' || s === 'x0') return 0;
        if (s.startsWith('x')) { const val = parseInt(s.substring(1)); return isNaN(val) ? 0 : val; }
        const idx = D.ABI_NAMES.indexOf(s);
        return idx !== -1 ? idx : 0;
    }

    resolve_imm(s, currentAddr) {
        if (!s) return 0;
        if (this.labels.hasOwnProperty(s)) return this.labels[s] - currentAddr;
        if (s.toLowerCase().startsWith('0x')) return parseInt(s, 16);
        return parseInt(s);
    }

    encode(inst) {
        // Reuse encoding logic for assembler output, relies on ENCODING.js
        // Ideally we'd rewrite this too but it's "Assembler side" vs "Simulator side"
        const op = inst.op;
        const args = inst.args;
        const info = ENCODING[op];
        if (!info) return 0;
        const [a1, a2, a3] = args;
        let mc = 0;
        if (info.type === 'R') {
            let f7 = info.funct7;
            if (inst.aq) f7 |= 0x02; if (inst.rl) f7 |= 0x01;
            mc = (f7 << 25) | (a3 << 20) | (a2 << 15) | (info.funct3 << 12) | (a1 << 7) | info.opcode;
        } else if (info.type === 'I') {
            if (['lb', 'lh', 'lw', 'lbu', 'lhu', 'jalr'].includes(op)) mc = ((a2 & 0xFFF) << 20) | (a3 << 15) | (info.funct3 << 12) | (a1 << 7) | info.opcode;
            else {
                let imm = a3;
                if (['slli', 'srli', 'srai'].includes(op)) imm = imm & 0x1F;
                mc = ((imm & 0xFFF) << 20) | (a2 << 15) | (info.funct3 << 12) | (a1 << 7) | info.opcode;
                if (info.funct7) mc |= (info.funct7 << 25);
            }
        } else if (info.type === 'S') {
            const imm = a2;
            const imm11_5 = (imm >> 5) & 0x7F; const imm4_0 = imm & 0x1F;
            mc = (imm11_5 << 25) | (a1 << 20) | (a3 << 15) | (info.funct3 << 12) | (imm4_0 << 7) | info.opcode;
        } else if (info.type === 'B') {
            const imm = a3;
            const bit12 = (imm >> 12) & 1; const bit11 = (imm >> 11) & 1; const bit10_5 = (imm >> 5) & 0x3F; const bit4_1 = (imm >> 1) & 0xF;
            mc = (bit12 << 31) | (bit10_5 << 25) | (a2 << 20) | (a1 << 15) | (info.funct3 << 12) | (bit4_1 << 8) | (bit11 << 7) | info.opcode;
        } else if (info.type === 'U') {
            mc = ((a2 & 0xFFFFF) << 12) | (a1 << 7) | info.opcode;
        } else if (info.type === 'J') {
            const imm = a2;
            const bit20 = (imm >> 20) & 1; const bit10_1 = (imm >> 1) & 0x3FF; const bit11 = (imm >> 11) & 1; const bit19_12 = (imm >> 12) & 0xFF;
            mc = (bit20 << 31) | (bit10_1 << 21) | (bit11 << 20) | (bit19_12 << 12) | (a1 << 7) | info.opcode;
        }
        return mc >>> 0;
    }

    // --- Core Simulator Logic (Binary Execution) ---

    step() {
        // Fetch 32-bit instruction from memory
        const instVal = this.memory.read(this.pc, 4, false); // read machine code as unsigned

        // Halt if 0 (null instruction/empty memory)
        if (instVal === 0) return false;

        // Save State
        this.history.push({
            x: new Int32Array(this.x),
            pc: this.pc,
            memoryPages: this.copyPages(),
            pipeline: { ...this.pipeline_state }
        });
        if (this.history.length > 500) this.history.shift();

        // Initialize pipeline state for viz
        this.pipeline_state = this.empty_pipeline_state();
        this.pipeline_state.pc = this.pc;
        this.pipeline_state.inst = instVal;

        try {
            this.execute_binary(instVal);
            this.cycles++;
            this.x[0] = 0; // Hardwire Zero
            return true;
        } catch (e) {
            console.error("Exec Error at " + this.pc.toString(16), e);
            return false;
        }
    }

    execute_binary(mc) {
        const opcode = mc & 0x7F;
        const rd = (mc >> 7) & 0x1F;
        const funct3 = (mc >> 12) & 0x7;
        const rs1 = (mc >> 15) & 0x1F;
        const rs2 = (mc >> 20) & 0x1F;
        const funct7 = (mc >> 25) & 0x7F;

        // UI Helpers
        const setPipe = (args) => Object.assign(this.pipeline_state, args);
        setPipe({ rs1, rs2, rd }); // optimistically set

        let next_pc = this.pc + 4;
        const u32 = (v) => v >>> 0;
        const i32 = (v) => v | 0;

        switch (opcode) {
            case D.OPCODE_LUI: {
                const imm = mc & 0xFFFFF000;
                this.wr(rd, imm);
                setPipe({ imm, alu_out: imm, alu_src_a: 'x', alu_src_b: 'imm', reg_write: true });
                break;
            }
            case D.OPCODE_AUIPC: {
                const imm = mc & 0xFFFFF000;
                const res = (this.pc + imm) | 0;
                this.wr(rd, res);
                setPipe({ imm, alu_out: res, alu_src_a: 'pc', alu_src_b: 'imm', reg_write: true });
                break;
            }
            case D.OPCODE_JAL: {
                // J-Type Imm: 20|10:1|11|19:12
                const i20 = (mc >> 31) & 1;
                const i10_1 = (mc >> 21) & 0x3FF;
                const i11 = (mc >> 20) & 1;
                const i19_12 = (mc >> 12) & 0xFF;
                let imm = (i20 << 20) | (i19_12 << 12) | (i11 << 11) | (i10_1 << 1);
                imm = D.to_signed(imm, 21);

                if (rd !== 0) this.wr(rd, this.pc + 4);
                next_pc = this.pc + imm;
                setPipe({ imm, jump: true, branch_taken: true, reg_write: true });
                break;
            }
            case D.OPCODE_JALR: {
                const imm = D.to_signed(mc >> 20, 12);
                if (rd !== 0) this.wr(rd, this.pc + 4);
                next_pc = (this.x[rs1] + imm) & ~1;
                setPipe({ imm, jump: true, branch_taken: true, reg_write: true });
                break;
            }
            case D.OPCODE_BRANCH: {
                // B-Type Imm: 12|10:5|4:1|11
                const i12 = (mc >> 31) & 1;
                const i10_5 = (mc >> 25) & 0x3F;
                const i4_1 = (mc >> 8) & 0xF;
                const i11 = (mc >> 7) & 1;
                let imm = (i12 << 12) | (i11 << 11) | (i10_5 << 5) | (i4_1 << 1);
                imm = D.to_signed(imm, 13);

                const v1 = this.x[rs1];
                const v2 = this.x[rs2];
                let take = false;

                if (funct3 === D.F3_BEQ) take = (v1 === v2);
                else if (funct3 === D.F3_BNE) take = (v1 !== v2);
                else if (funct3 === D.F3_BLT) take = (v1 < v2);
                else if (funct3 === D.F3_BGE) take = (v1 >= v2);
                else if (funct3 === D.F3_BLTU) take = (u32(v1) < u32(v2));
                else if (funct3 === D.F3_BGEU) take = (u32(v1) >= u32(v2));

                if (take) next_pc = this.pc + imm;
                setPipe({ imm, branch: true, branch_taken: take });
                break;
            }
            case D.OPCODE_LOAD: {
                const imm = D.to_signed(mc >> 20, 12);
                const addr = (this.x[rs1] + imm) | 0;
                let val = 0;
                let size = 4;

                if (funct3 === D.F3_LB) val = this.memory.read(addr, 1, true);
                else if (funct3 === D.F3_LH) val = this.memory.read(addr, 2, true);
                else if (funct3 === D.F3_LW) val = this.memory.read(addr, 4, true);
                else if (funct3 === D.F3_LBU) val = this.memory.read(addr, 1, false);
                else if (funct3 === D.F3_LHU) val = this.memory.read(addr, 2, false);

                this.wr(rd, val);
                setPipe({ imm, alu_out: addr, mem_out: val, mem_read: true, mem_to_reg: 'mem', reg_write: true });
                break;
            }
            case D.OPCODE_STORE: {
                // S-Type Imm: 11:5|4:0
                const i11_5 = (mc >> 25) & 0x7F;
                const i4_0 = (mc >> 7) & 0x1F;
                const imm = D.to_signed((i11_5 << 5) | i4_0, 12);

                const addr = (this.x[rs1] + imm) | 0;
                const val = this.x[rs2];

                if (funct3 === D.F3_SB) this.memory.write(addr, val, 1);
                else if (funct3 === D.F3_SH) this.memory.write(addr, val, 2);
                else if (funct3 === D.F3_SW) this.memory.write(addr, val, 4);

                this.reservation = null; // Invalidate atomic
                setPipe({ imm, alu_out: addr, mem_write: true });
                break;
            }
            case D.OPCODE_IMM: {
                const imm = D.to_signed(mc >> 20, 12);
                const v1 = this.x[rs1];
                let res = 0;
                if (funct3 === D.F3_ADD_SUB) res = v1 + imm;
                else if (funct3 === D.F3_SLT) res = (v1 < imm) ? 1 : 0;
                else if (funct3 === D.F3_SLTU) res = (u32(v1) < u32(imm)) ? 1 : 0;
                else if (funct3 === D.F3_XOR) res = v1 ^ imm;
                else if (funct3 === D.F3_OR) res = v1 | imm;
                else if (funct3 === D.F3_AND) res = v1 & imm;
                else if (funct3 === D.F3_SLL) res = v1 << (imm & 0x1F);
                else if (funct3 === D.F3_SRL_SRA) {
                    if ((mc >> 30) & 1) res = v1 >> (imm & 0x1F); // SRA
                    else res = v1 >>> (imm & 0x1F); // SRL
                }
                this.wr(rd, res);
                setPipe({ imm, alu_out: res, reg_write: true, alu_src_b: 'imm' });
                break;
            }
            case D.OPCODE_REG: {
                const v1 = this.x[rs1];
                const v2 = this.x[rs2];
                let res = 0;
                if (funct3 === D.F3_ADD_SUB) {
                    if ((mc >> 30) & 1) res = v1 - v2; // SUB
                    else res = v1 + v2; // ADD
                }
                else if (funct3 === D.F3_SLL) res = v1 << (v2 & 0x1F);
                else if (funct3 === D.F3_SLT) res = (v1 < v2) ? 1 : 0;
                else if (funct3 === D.F3_SLTU) res = (u32(v1) < u32(v2)) ? 1 : 0;
                else if (funct3 === D.F3_XOR) res = v1 ^ v2;
                else if (funct3 === D.F3_SRL_SRA) {
                    if ((mc >> 30) & 1) res = v1 >> (v2 & 0x1F); // SRA
                    else res = v1 >>> (v2 & 0x1F); // SRL
                }
                else if (funct3 === D.F3_OR) res = v1 | v2;
                else if (funct3 === D.F3_AND) res = v1 & v2;

                this.wr(rd, res);
                setPipe({ alu_out: res, reg_write: true });
                break;
            }
            case D.OPCODE_SYSTEM: {
                // ECALL is 0
                const imm12 = mc >> 20;
                if (imm12 === 0) { // ECALL
                    // Minimal handler
                    if (this.x[17] === 93) next_pc = -1; // Exit
                    else if (this.x[17] === 1) console.log(String.fromCharCode(this.x[10]));
                }
                break;
            }
            case D.OPCODE_ATOMIC: {
                const funct5 = (mc >> 27) & 0x1F;
                const aq = (mc >> 26) & 1;
                const rl = (mc >> 25) & 1;
                const addr = this.x[rs1];

                // For AMO/SC, rs2 is val. For LR, rs2 is 0.
                if (funct5 === D.AMO_LR) {
                    const val = this.memory.read(addr, 4, true);
                    this.reservation = addr;
                    this.wr(rd, val);
                    setPipe({ alu_out: addr, mem_out: val, mem_read: true, reg_write: true });
                } else if (funct5 === D.AMO_SC) {
                    if (this.reservation === addr) {
                        this.memory.write(addr, this.x[rs2], 4);
                        this.wr(rd, 0); // Success
                    } else {
                        this.wr(rd, 1); // Fail
                    }
                    this.reservation = null;
                    setPipe({ alu_out: addr, mem_write: true, reg_write: true });
                } else {
                    // AMOs
                    const v1 = this.memory.read(addr, 4, true);
                    const v2 = this.x[rs2];
                    let res = 0;
                    if (funct5 === D.AMO_SWAP) res = v2;
                    else if (funct5 === D.AMO_ADD) res = v1 + v2;
                    else if (funct5 === D.AMO_XOR) res = v1 ^ v2;
                    else if (funct5 === D.AMO_AND) res = v1 & v2;
                    else if (funct5 === D.AMO_OR) res = v1 | v2;
                    else if (funct5 === D.AMO_MIN) res = (v1 < v2) ? v1 : v2;
                    else if (funct5 === D.AMO_MAX) res = (v1 > v2) ? v1 : v2;
                    else if (funct5 === D.AMO_MINU) res = (u32(v1) < u32(v2)) ? v1 : v2;
                    else if (funct5 === D.AMO_MAXU) res = (u32(v1) > u32(v2)) ? v1 : v2;

                    this.memory.write(addr, res, 4);
                    this.reservation = null;
                    this.wr(rd, v1);
                    setPipe({ alu_out: addr, mem_out: v1, mem_read: true, mem_write: true, reg_write: true });
                }
                break;
            }
            default:
                console.warn(`Unimplemented Opcode: 0x${opcode.toString(16)}`);
        }

        if (next_pc !== -1) this.pc = next_pc;
    }

    wr(rd, val) {
        if (rd !== 0) this.x[rd] = val | 0;
    }

    stepBack() {
        if (this.history.length === 0) return false;
        const prev = this.history.pop();
        this.x = prev.x;
        this.pc = prev.pc;
        this.memory.pages = prev.memoryPages;
        this.pipeline_state = prev.pipeline;
        return true;
    }

    // Helpers copied from prev
    copyPages() { const c = {}; for (let k in this.memory.pages) c[k] = new Uint8Array(this.memory.pages[k]); return c; }
    getMemoryDump() {
        const keys = Object.keys(this.memory.pages).map(Number).sort((a, b) => a - b);
        if (keys.length === 0) return "Memory is empty.";

        let output = "";
        for (const pIdx of keys) {
            const page = this.memory.pages[pIdx];
            const baseAddr = pIdx << 12;
            for (let r = 0; r < 4096; r += 16) {
                let hasData = false;
                for (let i = 0; i < 16; i++) if (page[r + i] !== 0) hasData = true;
                if (hasData) {
                    let rowStr = `${(baseAddr + r).toString(16).padStart(8, '0').toUpperCase()}: `;
                    let ascii = '';
                    for (let i = 0; i < 16; i++) {
                        const val = page[r + i];
                        rowStr += val.toString(16).padStart(2, '0').toUpperCase() + " ";
                        ascii += (val >= 32 && val <= 126) ? String.fromCharCode(val) : '.';
                    }
                    output += `${rowStr}  |${ascii}|\n`;
                }
            }
        }
        return output;
    }
    getState() { return { registers: Array.from(this.x), pc: this.pc, memory: this.memory.getMap(), pipeline: this.pipeline_state }; }
    run() { let s = 0; while (s < 10000) { if (!this.step()) break; s++; } }
}
