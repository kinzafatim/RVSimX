import { EditorState } from "@codemirror/state"
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter } from "@codemirror/view"
import { defaultKeymap } from "@codemirror/commands"
import { cpp } from "@codemirror/lang-cpp"
import { DatapathVisualizer } from "./datapath.js"
import { initSimulator, assemble, step, run, reset } from "./sim_bridge.js"

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    initEditor();
    initUI();
    fetchRegisters();
    datapath = new DatapathVisualizer('datapath-canvas');
    initSimulator().then(() => {
        document.getElementById('status-message').textContent = "Simulator Ready (Client-side)";
    });
});

let editor;
let datapath;
let currentProgram = [];

function initEditor() {
    const startState = EditorState.create({
        doc: "# RISC-V Program\nli x1, 10\nli x2, 20\nadd x3, x1, x2",
        extensions: [
            keymap.of(defaultKeymap),
            lineNumbers(),
            highlightActiveLineGutter(),
            cpp(), // Syntax highlighting
            EditorView.theme({
                "&": { height: "100%" },
                ".cm-scroller": { overflow: "auto" }
            })
        ]
    });

    editor = new EditorView({
        state: startState,
        parent: document.getElementById('editor-container')
    });
}

function initUI() {
    // View Toggles (Workbench vs Datapath)
    const toggles = document.querySelectorAll('.toggle-btn');
    toggles.forEach(btn => {
        btn.addEventListener('click', () => {
            toggles.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
            document.getElementById(`${btn.dataset.view}-view`).classList.add('active');
            if (btn.dataset.view === 'datapath' && datapath) {
                datapath.resize();
            }
        });
    });

    // Sub-Tabs (Editor/Trace, Regs/Mem)
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            if (!tab.dataset.target) return;

            // Find parent panel (left or right)
            const panel = tab.closest('.panel-header').parentElement;

            // Toggle tabs in this header
            panel.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Toggle contents in this panel
            panel.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            const target = document.getElementById(tab.dataset.target);
            if (target) {
                target.classList.add('active');
            }

            // Specific logic for Execution Trace controls
            if (tab.dataset.target === 'execution-trace') {
                document.getElementById('trace-controls').style.display = 'flex';
            } else if (tab.dataset.target === 'editor-container') {
                document.getElementById('trace-controls').style.display = 'none';
            }
        });
    });

    // Format Toggles
    document.querySelectorAll('.fmt-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.fmt-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFormat = btn.dataset.fmt;
            // Re-render registers if we had state
            // Ideally trigger a re-render
        });
    });

    // Control Buttons
    document.getElementById('assemble-btn').addEventListener('click', assembleCode);
    document.getElementById('step-btn').addEventListener('click', stepSimulation);
    document.getElementById('run-btn').addEventListener('click', runSimulation);
    document.getElementById('reset-btn').addEventListener('click', resetSimulation);

    // Hex Buttons
    document.getElementById('copy-hex-btn').addEventListener('click', copyHex);
    document.getElementById('download-hex-btn').addEventListener('click', downloadHex);

    // Initial Register Render
    renderRegisters(Array(32).fill(0));
}

// API Calls via Pyodide Bridge
async function assembleCode() {
    const code = editor.state.doc.toString();
    const status = document.getElementById('status-message');
    status.textContent = "Assembling...";

    try {
        const data = await assemble(code);

        if (data.success) {
            status.textContent = "Assembly successful. Ready to run.";
            status.style.color = "#155724";
            currentProgram = data.program;
            renderProgramList(data.program);
            renderTrace(data.program);
        } else {
            status.textContent = `Error: ${data.message}`;
            status.style.color = "#bd2130";
        }
    } catch (e) {
        console.error('Assembly error:', e);
        status.textContent = "Assembly Error (Check Console)";
    }
}

async function stepSimulation() {
    try {
        const data = await step();
        if (data.success) updateState(data.state);
    } catch (e) { console.error(e); }
}

async function runSimulation() {
    try {
        const data = await run();
        if (data.success) updateState(data.state);
    } catch (e) { console.error(e); }
}

async function resetSimulation() {
    try {
        const data = await reset();
        if (data.success) updateState(data.state);
    } catch (e) { console.error(e); }
}

async function fetchRegisters() {
    // Initial fetch if needed, generally driven by state updates
}

// Rendering
const regNames = [
    "zero", "ra", "sp", "gp", "tp", "t0", "t1", "t2",
    "s0", "s1", "a0", "a1", "a2", "a3", "a4", "a5",
    "a6", "a7", "s2", "s3", "s4", "s5", "s6", "s7",
    "s8", "s9", "s10", "s11", "t3", "t4", "t5", "t6"
];

function updateState(state) {
    if (!state) return;

    document.getElementById('pc-value').textContent = "0x" + state.pc.toString(16).padStart(4, '0').toUpperCase();
    renderRegisters(state.registers);
    renderMemory(state.memory);
    highlightTrace(state.pc);

    // Highlight current line in program list if visible
    renderProgramList(currentProgram, state.pc);

    if (datapath) {
        datapath.draw(state);
    }
}

function renderTrace(program) {
    const tbody = document.getElementById('trace-body');
    tbody.innerHTML = '';

    if (!program) return;

    program.forEach(inst => {
        const row = document.createElement('tr');
        row.id = `trace-${inst.address}`;

        // Machine Code
        const machine = document.createElement('td');
        machine.className = 'font-mono';
        machine.textContent = "0x" + inst.machine_code.toString(16).padStart(8, '0').toUpperCase();

        // Basic Code
        const basic = document.createElement('td');
        basic.textContent = inst.basic_code || inst.source;

        // Original Code
        const original = document.createElement('td');
        original.textContent = inst.source; // In the screenshot they look identical often

        row.appendChild(machine);
        row.appendChild(basic);
        row.appendChild(original);
        tbody.appendChild(row);
    });
}

function highlightTrace(pc) {
    // Remove old highlights
    document.querySelectorAll('.trace-table tr').forEach(r => r.classList.remove('current-inst'));

    const row = document.getElementById(`trace-${pc}`);
    if (row) {
        row.classList.add('current-inst');
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function renderRegisters(values) {
    const container = document.getElementById('registers-list');
    container.innerHTML = '';

    values.forEach((val, idx) => {
        const row = document.createElement('div');
        row.className = 'register-row';

        const name = document.createElement('span');
        name.className = 'reg-name';
        name.textContent = `x${idx} (${regNames[idx]})`;

        const value = document.createElement('span');
        value.className = 'reg-val';

        if (currentFormat === 'hex') {
            value.textContent = "0x" + val.toString(16).padStart(8, '0');
        } else {
            // handle signed 32-bit int
            value.textContent = (val | 0).toString();
        }

        row.appendChild(name);
        row.appendChild(value);
        container.appendChild(row);
    });
}

function renderMemory(memory) {
    const container = document.getElementById('memory-list');
    container.innerHTML = '';

    if (!memory || Object.keys(memory).length === 0) {
        container.innerHTML = '<div class="empty-state">No memory data</div>';
        return;
    }

    // Sort addresses
    const addrs = Object.keys(memory).map(Number).sort((a, b) => a - b);

    // Group by words (4 bytes)
    const words = {};
    addrs.forEach(addr => {
        const aligned = addr - (addr % 4);
        if (!words[aligned]) words[aligned] = [0, 0, 0, 0];
        words[aligned][addr % 4] = memory[addr];
    });

    for (const [addr, bytes] of Object.entries(words)) {
        const row = document.createElement('div');
        row.className = 'memory-row';

        const addrSpan = document.createElement('span');
        addrSpan.className = 'mem-addr';
        addrSpan.textContent = "0x" + parseInt(addr).toString(16).padStart(8, '0');

        const valSpan = document.createElement('span');
        valSpan.className = 'mem-val';

        // Combine bytes to word for display
        let wordVal = 0;
        for (let i = 0; i < 4; i++) {
            wordVal |= (bytes[i] || 0) << (i * 8);
        }
        // unsigned convert
        wordVal = wordVal >>> 0;

        valSpan.textContent = "0x" + wordVal.toString(16).padStart(8, '0');

        row.appendChild(addrSpan);
        row.appendChild(valSpan);
        container.appendChild(row);
    }
}

function copyHex() {
    if (!currentProgram) return;
    const hex = currentProgram.map(inst => inst.machine_code.toString(16).padStart(8, '0')).join('\n');
    navigator.clipboard.writeText(hex);
    alert('Hex code copied to clipboard!');
}

function downloadHex() {
    if (!currentProgram) return;
    const hex = currentProgram.map(inst => inst.machine_code.toString(16).padStart(8, '0')).join('\n');
    const blob = new Blob([hex], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'program.hex';
    a.click();
}

function renderProgramList(program, currentPc) {
    const container = document.getElementById('program-list');
    container.innerHTML = '';

    if (!program) return;

    program.forEach(inst => {
        const row = document.createElement('div');
        row.className = 'program-row';
        if (inst.address === currentPc) {
            row.classList.add('active');
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        const addr = document.createElement('span');
        addr.className = 'prog-addr';
        addr.textContent = "0x" + inst.address.toString(16).padStart(8, '0');

        const src = document.createElement('span');
        src.className = 'prog-src';
        src.textContent = inst.source;

        row.appendChild(addr);
        row.appendChild(src);
        container.appendChild(row);
    });
}
