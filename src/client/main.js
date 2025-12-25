import { EditorState } from "@codemirror/state"
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter } from "@codemirror/view"
import { defaultKeymap } from "@codemirror/commands"
import { cpp } from "@codemirror/lang-cpp"
import { DatapathVisualizer } from "./datapath.js"
import { initSimulator, assemble, step, run, reset, stepBack, getMemoryDump } from "./sim_bridge.js"

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    initEditor();
    initUI();
    fetchRegisters();
    datapath = new DatapathVisualizer('datapath-canvas');
    initSimulator().then(() => {
        const msg = document.getElementById('status-message');
        if (msg) msg.textContent = "System Ready";
    });
});

let editor;
let datapath;
let currentProgram = [];
let currentFormat = 'hex';
let currentSimState = null;
let historyStack = []; // Store past states for Prev

function initEditor() {
    const textArea = document.getElementById('asm-editor');
    const initialDoc = textArea ? textArea.value : "# RISC-V Program\nli x1, 10\nli x2, 20\nadd x3, x1, x2";

    const startState = EditorState.create({
        doc: initialDoc,
        extensions: [
            keymap.of(defaultKeymap),
            lineNumbers(),
            highlightActiveLineGutter(),
            cpp(),
            EditorView.theme({
                "&": { height: "100%", fontSize: "13px" },
                ".cm-scroller": { overflow: "auto" }
            })
        ]
    });

    editor = new EditorView({
        state: startState,
        parent: document.getElementById('code-panel')
    });
}

function initUI() {
    // 1. View Toggles (Workbench vs Datapath)
    const navPills = document.querySelectorAll('.nav-pill');
    navPills.forEach(tab => {
        tab.addEventListener('click', () => {
            navPills.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const targetId = tab.dataset.view;
            document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));

            const page = document.getElementById(targetId + '-view');
            if (page) page.classList.add('active');

            if (targetId === 'datapath' && datapath) {
                datapath.resize();
            }
        });
    });

    // 2. Tab Items (Editor/Trace, Regs/Mem)
    const tabItems = document.querySelectorAll('.tab-item');
    tabItems.forEach(tab => {
        tab.addEventListener('click', () => {
            if (!tab.dataset.target) return;

            const container = tab.parentElement;
            container.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const targetId = tab.dataset.target;

            // Toggle Panels
            if (targetId === 'code-panel' || targetId === 'trace-panel') {
                // In Editor Card
                document.getElementById('code-panel').classList.add('hidden');
                document.getElementById('trace-panel').classList.add('hidden');
                document.getElementById(targetId).classList.remove('hidden');

                // Toggle Actions
                const traceActs = document.getElementById('trace-actions');
                if (targetId === 'trace-panel') traceActs.classList.remove('hidden');
                else traceActs.classList.add('hidden');
            }
            else if (targetId === 'regs-panel' || targetId === 'mem-panel') {
                // In Sidebar Card
                document.getElementById('regs-panel').classList.add('hidden');
                document.getElementById('mem-panel').classList.add('hidden');
                document.getElementById(targetId).classList.remove('hidden');
            }
        });
    });

    // 3. Format Toggles
    const fmtPills = document.querySelectorAll('.fmt-pill');
    fmtPills.forEach(btn => {
        btn.addEventListener('click', () => {
            const parent = btn.parentElement;
            parent.querySelectorAll('button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFormat = btn.dataset.value;
            if (currentSimState) renderRegisters(currentSimState.registers);
        });
    });

    // 4. Control Buttons (Assemble is always enabled)
    document.getElementById('assemble-btn').addEventListener('click', assembleCode);

    // Wire up Sim Controls - Disabled Initially
    const ctrls = [
        { id: 'run-btn', fn: runSimulation },
        { id: 'step-btn', fn: stepSimulation },
        { id: 'prev-btn', fn: prevStep },
        { id: 'reset-btn', fn: resetSimulation }
    ];

    ctrls.forEach(item => {
        const btn = document.getElementById(item.id);
        if (btn) {
            btn.addEventListener('click', item.fn);
            btn.disabled = true; // Disabled initially
        }
    });

    // Hex Buttons
    const cpyBtn = document.getElementById('copy-hex-btn');
    if (cpyBtn) cpyBtn.addEventListener('click', copyHex);

    const dlBtn = document.getElementById('download-mem-btn');
    if (dlBtn) dlBtn.addEventListener('click', downloadHex);

    // Initial Render
    renderRegisters(Array(32).fill(0));
}

// --- Logic ---

async function assembleCode() {
    const code = editor.state.doc.toString();
    const status = document.getElementById('status-message');
    status.textContent = "Assembling...";

    try {
        const data = await assemble(code);

        if (data.success) {
            status.textContent = "Assembly successful.";
            status.style.color = "var(--assemble-text)";
            currentProgram = data.program;

            // Enable Controls
            ['run-btn', 'step-btn', 'prev-btn', 'reset-btn'].forEach(id => {
                const btn = document.getElementById(id);
                if (btn) btn.disabled = false;
            });

            // Reset state
            historyStack = [];
            currentSimState = null;
            await reset(); // Backend reset

            // Update UI
            renderProgramList(data.program, 0);
            renderTrace(data.program);
        } else {
            status.textContent = `Error: ${data.message}`;
            status.style.color = "#d32f2f";
        }
    } catch (e) {
        console.error('Assembly error:', e);
        status.textContent = "Assembly Error";
    }
}

async function stepSimulation() {
    try {
        // Push current state to history before stepping
        if (currentSimState) {
            historyStack.push(JSON.parse(JSON.stringify(currentSimState)));
        }

        const data = await step();
        if (data.success) {
            updateState(data.state);
            document.getElementById('status-message').textContent = "Stepped 1 instruction.";
        } else {
            document.getElementById('status-message').textContent = "End of program or Error.";
        }
    } catch (e) { console.error(e); }
}

async function runSimulation() {
    try {
        // Save state before run
        if (currentSimState) historyStack.push(JSON.parse(JSON.stringify(currentSimState)));

        const data = await run();
        if (data.success) {
            updateState(data.state);
            document.getElementById('status-message').textContent = "Execution complete.";
        }
    } catch (e) { console.error(e); }
}

async function prevStep() {
    try {
        const ret = await stepBack();
        if (ret.success) {
            updateState(ret.state);
            document.getElementById('status-message').textContent = "Stepped Back.";
        } else {
            document.getElementById('status-message').textContent = "Cannot step back further.";
        }
    } catch (e) { console.error(e); }
}

async function downloadHex() {
    try {
        if (!currentProgram || currentProgram.length === 0) {
            console.warn("No program assembled.");
            return;
        }

        // Generate hex dump of instructions
        // Each instruction's machine_code is a 32-bit integer.
        // We format it as 8-digit hex string.
        let hexOutput = "";
        for (const inst of currentProgram) {
            // Need unsigned 32-bit hex
            const hex = (inst.machine_code >>> 0).toString(16).padStart(8, '0');
            hexOutput += hex + "\n";
        }

        const blob = new Blob([hexOutput], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'hex.txt';
        a.click();
        URL.revokeObjectURL(url);
    } catch (e) { console.error(e); }
}

async function resetSimulation() {
    try {
        historyStack = [];
        const data = await reset();
        if (data.success) {
            updateState(data.state);
            document.getElementById('status-message').textContent = "System Reset.";
        }
    } catch (e) { console.error(e); }
}

async function fetchRegisters() { }

const regNames = [
    "zero", "ra", "sp", "gp", "tp", "t0", "t1", "t2",
    "s0", "s1", "a0", "a1", "a2", "a3", "a4", "a5",
    "a6", "a7", "s2", "s3", "s4", "s5", "s6", "s7",
    "s8", "s9", "s10", "s11", "t3", "t4", "t5", "t6"
];

function updateState(state) {
    if (!state) return;
    currentSimState = state;

    // PC Badge
    const pcHex = "0x" + state.pc.toString(16).padStart(4, '0').toUpperCase();
    document.querySelectorAll('.pc-badge span').forEach(el => el.textContent = pcHex);

    renderRegisters(state.registers);
    renderMemory(state.memory);
    highlightTrace(state.pc);
    renderProgramList(currentProgram, state.pc);

    if (datapath) {
        datapath.draw(state);
    }
}

function renderRegisters(values) {
    const container = document.getElementById('regs-panel');
    container.innerHTML = '';

    values.forEach((val, idx) => {
        const row = document.createElement('div');
        row.className = 'register-row';

        // Name
        const nameCol = document.createElement('div');
        nameCol.className = 'reg-name';

        const idSpan = document.createElement('span');
        idSpan.className = 'reg-id';
        idSpan.textContent = `x${idx}`;

        const aliasSpan = document.createElement('span');
        aliasSpan.className = 'reg-alias';
        aliasSpan.textContent = `(${regNames[idx]})`;

        nameCol.appendChild(idSpan);
        nameCol.appendChild(aliasSpan);

        // Value
        const valueSpan = document.createElement('span');
        valueSpan.className = 'reg-val';

        if (currentFormat === 'hex') {
            valueSpan.textContent = "0x" + val.toString(16).padStart(8, '0');
        } else {
            valueSpan.textContent = (val | 0).toString();
        }

        row.appendChild(nameCol);
        row.appendChild(valueSpan);
        container.appendChild(row);
    });
}

function renderMemory(memory) {
    const container = document.getElementById('memory-hex');
    if (!container) return;
    container.innerHTML = '';

    // Header
    const headerRow = document.createElement('div');
    headerRow.className = 'memory-header-row';
    const addrCol = document.createElement('div');
    addrCol.className = 'mem-addr-col';
    addrCol.textContent = 'Addrs';
    headerRow.appendChild(addrCol);

    const bytesCol = document.createElement('div');
    bytesCol.className = 'mem-data-col';
    for (let i = 0; i < 8; i++) {
        const b = document.createElement('span');
        b.className = 'mem-byte';
        b.textContent = `+${i}`;
        bytesCol.appendChild(b);
    }
    headerRow.appendChild(bytesCol);
    container.appendChild(headerRow);

    // Separator
    const sep = document.createElement('div');
    sep.className = 'memory-separator';
    container.appendChild(sep);

    if (!memory) memory = {};

    // Determine range: Always show at least 0x0000 to 0x00F8 (256 bytes)
    // If memory has higher addresses, include them too.
    let maxAddr = 255;
    const keys = Object.keys(memory).map(Number);
    if (keys.length > 0) {
        maxAddr = Math.max(maxAddr, ...keys);
    }

    // Round up maxAddr to next multiple of 8 minus 1
    // e.g. if 255 -> 255.
    // if 256 -> 263 (new row).
    maxAddr = Math.ceil((maxAddr + 1) / 8) * 8 - 1;

    // Generate Rows
    for (let baseAddr = 0; baseAddr <= maxAddr; baseAddr += 8) {
        const row = document.createElement('div');
        row.className = 'memory-row';

        const addr = document.createElement('span');
        addr.className = 'mem-addr-col';
        addr.textContent = baseAddr.toString(16).padStart(4, '0').toUpperCase() + ":";
        row.appendChild(addr);

        const dataGrid = document.createElement('div');
        dataGrid.className = 'mem-data-col';

        for (let offset = 0; offset < 8; offset++) {
            const currentAddr = baseAddr + offset;
            const val = memory[currentAddr] !== undefined ? memory[currentAddr] : 0;
            const b = document.createElement('span');
            b.className = 'mem-byte';
            b.textContent = (val & 0xFF).toString(16).padStart(2, '0').toUpperCase();
            dataGrid.appendChild(b);
        }
        row.appendChild(dataGrid);
        container.appendChild(row);
    }
}

function renderTrace(program) {
    const tbody = document.getElementById('trace-body');
    tbody.innerHTML = '';
    if (!program) return;

    program.forEach(inst => {
        const row = document.createElement('tr');
        row.id = `trace-${inst.address}`;

        const mach = document.createElement('td');
        mach.style.fontFamily = 'monospace';
        mach.textContent = "0x" + inst.machine_code.toString(16).padStart(8, '0').toUpperCase();

        const basic = document.createElement('td');
        basic.textContent = inst.basic_code || inst.source;

        const orig = document.createElement('td');
        orig.textContent = inst.source;

        row.appendChild(mach);
        row.appendChild(basic);
        row.appendChild(orig);
        tbody.appendChild(row);
    });
}

function highlightTrace(pc) {
    document.querySelectorAll('.trace-table tr').forEach(r => r.classList.remove('current-inst'));
    const row = document.getElementById(`trace-${pc}`);
    if (row) {
        row.classList.add('current-inst');
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function renderProgramList(program, currentPc) {
    const container = document.getElementById('program-list');
    if (!container) return;
    container.innerHTML = '';
    if (!program) return;

    program.forEach(inst => {
        const row = document.createElement('div');
        row.className = 'program-row';
        if (inst.address === currentPc) row.classList.add('active');

        const txt = document.createElement('span');
        txt.textContent = inst.source;
        row.appendChild(txt);
        container.appendChild(row);
    });
}

function copyHex() {
    if (!currentProgram) return;
    const hex = currentProgram.map(inst => inst.machine_code.toString(16).padStart(8, '0')).join('\n');
    navigator.clipboard.writeText(hex);
    alert('Copied.');
}
