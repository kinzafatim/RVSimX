export class DatapathVisualizer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Configuration
        this.colors = {
            component: { stroke: "#2c5d88", fill: "#ffffff", highlight: "#e3f2fd" },
            wire: { passive: "#b0bec5", active: "#2196f3", high: "#ff9800" },
            text: "#37474f",
            control: { active: "#4caf50", passive: "#cfd8dc" }
        };

        // Component Layout (Scaled 1000x600)
        this.layout = {
            // Fetch
            pc: { x: 50, y: 300, w: 60, h: 40, label: "PC" },
            add4: { x: 100, y: 220, w: 40, h: 30, shape: 'alu', label: "+4" },

            // Instruction Memory
            imem: { x: 180, y: 300, w: 90, h: 100, label: "I-MEM" },

            // Decode
            splitter: { x: 300, y: 300, w: 30, h: 100, label: "" }, // Visual splitter
            control: { x: 350, y: 50, w: 80, h: 120, label: "CONTROL" },
            regs: { x: 450, y: 300, w: 100, h: 100, label: "REGISTERS" },
            immGen: { x: 450, y: 450, w: 60, h: 50, label: "IMM" },

            // Execute
            aluMuxA: { x: 580, y: 280, w: 20, h: 40, shape: 'mux' },
            aluMuxB: { x: 580, y: 380, w: 20, h: 40, shape: 'mux' },
            alu: { x: 650, y: 310, w: 70, h: 90, shape: 'alu', label: "ALU" },

            // Memory
            dmem: { x: 800, y: 300, w: 90, h: 100, label: "D-MEM" },

            // Writeback
            wbMux: { x: 920, y: 300, w: 20, h: 60, shape: 'mux' }
        };
    }

    resize() {
        const parent = this.canvas.parentElement;
        this.canvas.width = parent.clientWidth;
        this.canvas.height = parent.clientHeight;
        this.draw({});
    }

    draw(state) {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.clearRect(0, 0, w, h);

        // Coordinate System
        const scale = Math.min(w / 1000, h / 600) * 0.95;
        ctx.save();
        ctx.translate((w - 1000 * scale) / 2, (h - 600 * scale) / 2);
        ctx.scale(scale, scale);

        const ctrl = state.pipeline || {};

        // --- 1. Draw Wires with Animation Logic ---
        // PC -> IMEM
        this.drawWire(110, 320, 180, 320, true);
        // IMEM -> Splitter
        this.drawWire(270, 350, 300, 350, true);

        // Splitter -> Registers (Reads)
        this.drawWire(330, 330, 450, 330, true); // rs1
        this.drawWire(330, 370, 450, 370, true); // rs2

        // Splitter -> ImmGen
        this.drawWire(330, 390, 450, 470, true);

        // Splitter -> Control (Opcode)
        this.drawWire(330, 310, 390, 170, true);

        // Control Signals (Vertical)
        // RegDst, Branch, MemRead, MemtoReg, ALUOp, MemWrite, ALUSrc, RegWrite
        // Simplified visual wires

        // Regs -> ALU Mux A
        this.drawWire(550, 320, 580, 300, true);
        // PC -> ALU Mux A (for branches/auipc)
        this.drawWire(80, 200, 580, 290, false); // Simplified path

        // Regs -> ALU Mux B
        this.drawWire(550, 380, 580, 390, ctrl.alu_src_b === 'reg');
        // ImmGen -> ALU Mux B
        this.drawWire(510, 475, 580, 410, ctrl.alu_src_b === 'imm');

        // ALU Muxes -> ALU
        this.drawWire(600, 300, 650, 340, true);
        this.drawWire(600, 400, 650, 370, true);

        // ALU -> DMEM (Address)
        this.drawWire(720, 355, 800, 355, true);
        // Regs -> DMEM (Data for Store)
        this.drawWire(550, 390, 800, 380, ctrl.mem_write);

        // ALU -> WB Mux
        this.drawWire(720, 355, 920, 320, ctrl.mem_to_reg === 'alu');
        // DMEM -> WB Mux
        this.drawWire(890, 350, 920, 340, ctrl.mem_to_reg === 'mem');

        // WB Mux -> Regs (Writeback)
        if (ctrl.reg_write) {
            ctx.strokeStyle = this.colors.wire.active;
            ctx.beginPath();
            ctx.moveTo(940, 330);
            ctx.lineTo(960, 330);
            ctx.lineTo(960, 550);
            ctx.lineTo(400, 550);
            ctx.lineTo(400, 350);
            ctx.lineTo(450, 350);
            ctx.stroke();
            this.drawArrow(450, 350);
        }

        // --- 2. Draw Components ---
        Object.values(this.layout).forEach(c => this.drawComponent(ctx, c, ctrl));

        ctx.restore();
    }

    drawWire(x1, y1, x2, y2, active) {
        const ctx = this.ctx;
        ctx.beginPath();
        ctx.strokeStyle = active ? this.colors.wire.active : this.colors.wire.passive;
        ctx.lineWidth = active ? 3 : 2;
        ctx.setLineDash(active ? [] : [5, 5]);

        // Simple routing (Horizontal then Vertical if needed)
        // Or direct if close? simplified logic for now: direct line
        // Better: Manhattan routing
        const midX = (x1 + x2) / 2;

        ctx.moveTo(x1, y1);
        // If simple horizontal
        if (Math.abs(y1 - y2) < 10) {
            ctx.lineTo(x2, y2);
        } else {
            // Step
            ctx.lineTo(midX, y1);
            ctx.lineTo(midX, y2);
            ctx.lineTo(x2, y2);
        }
        ctx.stroke();

        if (active) this.drawArrow(x2, y2);
        ctx.setLineDash([]);
    }

    drawArrow(x, y) {
        const ctx = this.ctx;
        const s = 5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - s, y - s);
        ctx.lineTo(x - s, y + s);
        ctx.fill();
    }

    drawComponent(ctx, c, ctrl) {
        ctx.beginPath();
        ctx.fillStyle = this.colors.component.fill;
        ctx.strokeStyle = this.colors.component.stroke;
        ctx.lineWidth = 2;

        if (c.shape === 'alu') {
            this.drawALUShape(ctx, c.x, c.y, c.w, c.h);
        } else if (c.shape === 'mux') {
            this.drawMuxShape(ctx, c.x, c.y, c.w, c.h);
        } else {
            ctx.rect(c.x, c.y, c.w, c.h);
        }

        ctx.fill();
        ctx.stroke();

        if (c.label) {
            ctx.fillStyle = this.colors.text;
            ctx.font = "bold 12px Inter";
            ctx.textAlign = "center";
            ctx.fillText(c.label, c.x + c.w / 2, c.y + c.h / 2 + 4);
        }

        // Add specific highlights based on control
        if (c.label === "ALU" && (ctrl.alu_src_a || ctrl.alu_src_b)) {
            // highlight logic
        }
        if (c.label === "D-MEM" && (ctrl.mem_read || ctrl.mem_write)) {
            ctx.fillStyle = "rgba(40, 167, 69, 0.2)";
            ctx.fill();
        }
        if (c.label === "REGISTERS" && ctrl.reg_write) {
            ctx.fillStyle = "rgba(40, 167, 69, 0.2)";
            ctx.fill();
        }
    }

    drawALUShape(ctx, x, y, w, h) {
        ctx.moveTo(x, y);
        ctx.lineTo(x + w, y + h * 0.2);
        ctx.lineTo(x + w, y + h * 0.8);
        ctx.lineTo(x, y + h);
        ctx.lineTo(x, y + h * 0.6);
        ctx.lineTo(x + w * 0.2, y + h * 0.5);
        ctx.lineTo(x, y + h * 0.4);
        ctx.closePath();
    }

    drawMuxShape(ctx, x, y, w, h) {
        ctx.moveTo(x, y);
        ctx.lineTo(x + w, y + h * 0.2);
        ctx.lineTo(x + w, y + h * 0.8);
        ctx.lineTo(x, y + h);
        ctx.closePath();
    }
}
