export class DatapathVisualizer {
    constructor(canvasId) {
        this.container = document.querySelector('.atomic-viz-container');
        if (!this.container) return; // Should not happen if HTML is correct

        // State
        this.instType = 'amoadd';
        this.step = 0;
        this.isPlaying = false;
        this.aq = false;
        this.rl = false;
        this.reservationActive = true;
        this.totalSteps = 5;
        this.timer = null;

        // Instruction Data
        this.instructions = {
            lr: { name: "lr.w", desc: "Load Reserved", verb: "Load", isAMO: false },
            sc: { name: "sc.w", desc: "Store Conditional", verb: "Store", isAMO: false },
            amoswap: { name: "amoswap.w", desc: "Atomic Swap", verb: "Swap", isAMO: true },
            amoadd: { name: "amoadd.w", desc: "Atomic Add", verb: "Add", isAMO: true },
            amoxor: { name: "amoxor.w", desc: "Atomic XOR", verb: "XOR", isAMO: true },
            amoand: { name: "amoand.w", desc: "Atomic AND", verb: "AND", isAMO: true },
            amoor: { name: "amoor.w", desc: "Atomic OR", verb: "OR", isAMO: true },
            amomin: { name: "amomin.w", desc: "Atomic Min", verb: "Min", isAMO: true },
            amomax: { name: "amomax.w", desc: "Atomic Max", verb: "Max", isAMO: true },
            amominu: { name: "amominu.w", desc: "Atomic MinU", verb: "MinU", isAMO: true },
            amomaxu: { name: "amomaxu.w", desc: "Atomic MaxU", verb: "MaxU", isAMO: true }
        };

        this.initUI();
        this.updateUI();
    }

    resize() {
        // No-op for now, SVG is responsive via CSS
    }

    // Called by main simulator loop - we might ignore this for the standalone viz
    draw(state) {
        // strictly standalone for now as requested
    }

    initUI() {
        // 1. Inject Instruction Buttons
        const btnGroup = document.getElementById('inst-buttons');
        Object.keys(this.instructions).forEach(key => {
            const btn = document.createElement('button');
            btn.className = 'inst-btn';
            btn.textContent = key.toUpperCase();
            btn.onclick = () => {
                this.instType = key;
                this.reset();
            };
            btnGroup.appendChild(btn);
        });

        // 2. Toggles
        document.getElementById('check-aq').addEventListener('change', (e) => {
            this.aq = e.target.checked;
            this.updateUI();
        });
        document.getElementById('check-rl').addEventListener('change', (e) => {
            this.rl = e.target.checked;
            this.updateUI();
        });

        // Reservation
        document.getElementById('btn-reservation').addEventListener('click', () => {
            this.reservationActive = !this.reservationActive;
            this.updateUI();
        });

        // 3. Controls
        document.getElementById('btn-play').addEventListener('click', () => this.togglePlay());
        document.getElementById('btn-next').addEventListener('click', () => this.nextStep());
        document.getElementById('btn-reset').addEventListener('click', () => this.reset());
    }

    reset() {
        this.step = 0;
        this.isPlaying = false;
        clearInterval(this.timer);
        this.updateUI();
    }

    togglePlay() {
        if (this.step >= this.totalSteps) this.step = 0;
        this.isPlaying = !this.isPlaying;

        if (this.isPlaying) {
            this.timer = setInterval(() => {
                if (this.step >= this.totalSteps) {
                    this.isPlaying = false;
                    clearInterval(this.timer);
                    this.updateUI();
                } else {
                    this.step++;
                    this.updateUI();
                }
            }, 2000);
        } else {
            clearInterval(this.timer);
        }
        this.updateUI();
    }

    nextStep() {
        if (this.step < this.totalSteps) {
            this.step++;
            this.updateUI();
        }
    }

    // --- Core Logic ---
    getStepInfo(type, s) {
        const currentInst = this.instructions[type];

        // Construct full syntax for detail
        // e.g. amoadd.w.aq.rl rd, rs2, (rs1)
        const suffix = (this.aq ? '.aq' : '') + (this.rl ? '.rl' : '');
        const syntax = `${currentInst.name}${suffix} rd, ${type === 'lr' ? '(rs1)' : 'rs2, (rs1)'}`;

        if (s === 0) return { title: "Idle", desc: "Ready", detail: syntax };
        if (s === 1) return { title: "IF Stage", desc: "Fetch Instruction", detail: "Fetching instruction from IMEM." };
        if (s === 2) return { title: "ID Stage (Decode & Fetch)", desc: "Decode & Read Memory", detail: `Control decodes opcode. rs1 is sent to Memory. 'Fetched data at rs1 address' is retrieved immediately from Mem[rs1].` };
        if (s === 3) {
            if (type === 'lr') return { title: "EX Stage", desc: "Pass Through", detail: "LR has no arithmetic. Old Value passes through." };
            return { title: "EX Stage (Atomic ALU)", desc: `Execute: ${currentInst.verb}`, detail: `Atomic ALU (in EX) computes: [Fetched Data] ${currentInst.verb} [rs2] = New Value.` };
        }
        if (s === 4) {
            if (type === 'lr') return { title: "MEM Stage", desc: "Set Reservation", detail: "Marking Reservation Set Active. No write." };
            if (type === 'sc') return { title: "MEM Stage", desc: this.reservationActive ? "Store Success" : "Store Fail", detail: this.reservationActive ? "Reservation Valid. Writing New Value to Mem." : "Reservation Invalid. Write suppressed." };
            return { title: "MEM Stage (Store)", desc: "Write New Value", detail: `Writing the computed 'New Value' back to Mem[rs1].` };
        }
        if (s === 5) {
            const val = type === 'sc' ? (this.reservationActive ? "0" : "1") : "Fetched data at rs1 address";
            return { title: "WB Stage", desc: "Writeback Old Value", detail: `Writing '${val}' to register rd.` };
        }
        return { title: "", desc: "", detail: "" };
    }

    isActive(targetSteps) {
        if (Array.isArray(targetSteps)) return targetSteps.includes(this.step);
        return this.step === targetSteps;
    }

    // --- Render ---
    updateUI() {
        const { instType, step, isPlaying, aq, rl, reservationActive } = this;
        const currentInst = this.instructions[instType];

        // 1. Update Buttons State
        const btns = document.querySelectorAll('.inst-btn');
        btns.forEach(b => {
            if (b.textContent.toLowerCase().startsWith(instType.split('.')[0])) b.classList.add('active');
            else b.classList.remove('active');
        });

        // 2. Syntax & Switches
        const suffix = (aq ? '.aq' : '') + (rl ? '.rl' : '');
        const fullSyntax = `${currentInst.name}${suffix} rd, ${instType === 'lr' ? '(rs1)' : 'rs2, (rs1)'}`;
        document.getElementById('full-syntax').textContent = fullSyntax;

        // Toggles visual update
        document.getElementById('toggle-aq').style.justifyContent = aq ? 'flex-end' : 'flex-start';
        document.getElementById('toggle-aq').style.backgroundColor = aq ? '#2563eb' : '#cbd5e1';
        document.getElementById('toggle-rl').style.justifyContent = rl ? 'flex-end' : 'flex-start';
        document.getElementById('toggle-rl').style.backgroundColor = rl ? '#2563eb' : '#cbd5e1';

        // Reservation Button (Show only for sc)
        const btnRes = document.getElementById('btn-reservation');
        if (instType === 'sc') {
            btnRes.classList.remove('hidden');
            if (reservationActive) {
                btnRes.classList.add('active');
                btnRes.querySelector('.icon').textContent = '✓'; // Use checkmark
            } else {
                btnRes.classList.remove('active');
                btnRes.querySelector('.icon').textContent = '✕';
            }
        } else {
            btnRes.classList.add('hidden');
        }

        // Play Button Text
        const btnPlay = document.getElementById('btn-play');
        btnPlay.innerHTML = isPlaying ? 'Pause' : 'Play';
        document.getElementById('btn-next').disabled = isPlaying || step === 5;

        // 3. Info Panel
        const info = this.getStepInfo(instType, step);
        document.getElementById('info-title').textContent = info.title;
        document.getElementById('info-desc').textContent = info.desc;
        document.getElementById('info-detail').textContent = info.detail;

        const infoPanel = document.getElementById('info-panel');
        // Border color handling
        if (instType === 'sc' && step === 4 && !reservationActive) {
            infoPanel.classList.add('fail');
        } else {
            infoPanel.classList.remove('fail');
        }

        // 4. SVG Visuals
        // Helper to set active styles
        const setWire = (id, active, fail = false) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.classList.remove('active-wire', 'fail-wire');
            if (fail) el.classList.add('fail-wire');
            else if (active) el.classList.add('active-wire');
        };

        const setComp = (id, active) => {
            const el = document.getElementById(id);
            if (!el) return;
            if (active) el.classList.add('active-comp');
            else el.classList.remove('active-comp');
        };

        const setText = (id, active) => {
            const el = document.getElementById(id);
            if (!el) return;
            if (active) el.classList.add('active-text');
            else el.classList.remove('active-text');
        };

        const s = step;

        // IF Stage
        setComp('rect-pc', s === 1);
        setComp('rect-imem', s === 1);
        setText('text-pc', s === 1);
        setText('text-imem', s === 1);
        setWire('wire-if-1', s === 1);
        setWire('wire-if-2', s === 1);

        // ID Stage
        setComp('rect-control', s === 2);
        setComp('rect-regfile', s === 2);
        setText('text-control', s === 2);
        setText('text-regfile', s === 2 || s === 5); // persistent highlight for WB source? No, just active

        // RegFile is active in 2 (read) and 5 (write check? no, WB uses wire).
        // Let's follow React logic: fill={getFill(2)} -> Active only on 2? 
        // React: stroke={getWireStyle([2,5])} -> Stroke active on 2 and 5.
        // My setComp sets fill and stroke. I might need separate control if exact match needed.
        // For now, simple active/inactive.
        setComp('rect-regfile', s === 2 || s === 5);

        setWire('wire-id-1', s === 2);
        setWire('wire-id-2', s === 2);

        // Special Paths
        // rs1: active 2 and 4
        setWire('wire-rs1', s === 2 || s === 4);
        setText('label-rs1', s === 2 || s === 4);

        // Fetched Loop: active 2 and 5
        setWire('wire-fetched', s === 2 || s === 5);
        setText('label-fetched', s === 2 || s === 5);

        // EX Stage (Atomic ALU)
        setComp('circle-atomic', s === 3);
        setText('text-atomic-1', s === 3);
        setText('text-atomic-2', s === 3);

        // Inputs
        // rs2: active 2, 3
        setWire('wire-rs2', s === 2 || s === 3);
        setText('label-rs2', s === 2 || s === 3);

        // Old Val to ALU: active 2, 3
        setWire('wire-oldval', s === 2 || s === 3);
        setText('label-oldval', s === 2 || s === 3);

        // Output New Val: active 3, 4 (unless LR)
        const isLR = instType === 'lr';
        const isStoreActive = !isLR && (instType !== 'sc' || (s === 4 ? reservationActive : true)); // Logic check

        const newValActive = !isLR && (s === 3 || s === 4);
        setWire('wire-newval', newValActive);
        if (isLR) {
            document.getElementById('wire-newval').style.display = 'none';
        } else {
            document.getElementById('wire-newval').style.display = 'block';
        }

        // MEM Stage
        // React: fill={getFill([2,4])}
        setComp('rect-dmem', s === 2 || s === 4);
        setText('text-dmem', s === 2 || s === 4);

        // Reservation
        // Always visible, but color changes
        const resRect = document.getElementById('rect-reservation');
        if (reservationActive) {
            resRect.setAttribute('fill', '#dcfce7');
            resRect.setAttribute('stroke', '#16a34a');
        } else {
            resRect.setAttribute('fill', '#fee2e2');
            resRect.setAttribute('stroke', '#ef4444');
        }

        // Store Path
        // React: if (instType !== 'lr' && (instType !== 'sc' || reservationActive))
        // And step === 4
        // SC Failure check for stroke color
        let storeFail = false;
        if (instType === 'sc' && s === 4 && !reservationActive) storeFail = true;

        const showStore = !isLR && (instType !== 'sc' || reservationActive);

        const wireStore = document.getElementById('wire-store');
        if (showStore) {
            wireStore.style.display = 'block';
            // Active on step 4
            setWire('wire-store', s === 4, storeFail); // Pass fail flag
        } else {
            // If SC fail, we might still want to show the wire but failed?
            // React logic: if sc fail, show red wire? 
            // React code: if (instType !== 'lr' && (instType !== 'sc' || reservationActive)) -> path shown.
            // So if SC fail, path is HIDDEN? 
            // Wait, `getWireStyle` has SC Failure check. 
            // But the path rendering has `(instType !== 'sc' || reservationActive)`.
            // So if `!reservationActive`, the path is NOT rendered in React.
            wireStore.style.display = 'none';
        }

        const lblStore = document.getElementById('label-store');
        if (s === 4 && !isLR) lblStore.style.display = 'block';
        else lblStore.style.display = 'none';
        if (storeFail) lblStore.style.fill = '#ef4444';
        else lblStore.style.fill = '#6b7280'; // Reset

        // WB Stage
        setComp('poly-mux', s === 5);
        setWire('wire-wb-in', s === 2 || s === 5);
        setText('label-wb-in', s === 2 || s === 5);

        setWire('wire-wb-out', s === 5);
        setText('label-wb-out', s === 5);
    }
}
