
import { DatapathVisualizer } from "./datapath.js"
import { initSimulator, assemble, step, run, reset, stepBack } from "./sim_bridge.js"
import { initEditor, getCode, setEditorErrors } from "./ui/editor.js"
import { updateState, renderRegisters, renderTrace, renderProgramList, setDatapath, setFormat } from "./ui/renderer.js"

// State
let datapath;
let currentProgram = [];
let currentSimState = null;
let historyStack = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initEditor('code-panel');
    initUI();
    datapath = new DatapathVisualizer('datapath-canvas');
    setDatapath(datapath);

    // Initial Render
    renderRegisters(Array(32).fill(0));

    initSimulator().then(() => {
        const msg = document.getElementById('status-message');
        if (msg) msg.textContent = "System Ready";
    });
});

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
                document.getElementById('code-panel').classList.add('hidden');
                document.getElementById('trace-panel').classList.add('hidden');
                document.getElementById(targetId).classList.remove('hidden');

                const traceActs = document.getElementById('trace-actions');
                if (targetId === 'trace-panel') traceActs.classList.remove('hidden');
                else traceActs.classList.add('hidden');
            }
            else if (targetId === 'regs-panel' || targetId === 'mem-panel') {
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
            let format = btn.dataset.value;
            setFormat(format);
            if (currentSimState) updateState(currentSimState, currentProgram);
        });
    });

    // 4. Control Buttons
    document.getElementById('assemble-btn').addEventListener('click', assembleCode);

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
            btn.disabled = true;
        }
    });

    const cpyBtn = document.getElementById('copy-hex-btn');
    if (cpyBtn) cpyBtn.addEventListener('click', copyHex);

    const dlBtn = document.getElementById('download-mem-btn');
    if (dlBtn) dlBtn.addEventListener('click', downloadHex);
}

// Logic
async function assembleCode() {
    const code = getCode();
    const status = document.getElementById('status-message');
    status.textContent = "Assembling...";

    // Clear previous errors
    setEditorErrors([]);

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
            await reset();

            // Update UI
            renderProgramList(data.program, 0);
            renderTrace(data.program);
        } else {
            status.textContent = `Error: ${data.message || 'Assembly Failed'}`;
            status.style.color = "#d32f2f";
            if (data.errors) {
                setEditorErrors(data.errors);
            }
        }
    } catch (e) {
        console.error('Assembly error:', e);
        status.textContent = "Assembly Error";
    }
}

async function stepSimulation() {
    try {
        if (currentSimState) {
            historyStack.push(JSON.parse(JSON.stringify(currentSimState)));
        }

        const data = await step();
        if (data.success) {
            handleStateUpdate(data.state);
            document.getElementById('status-message').textContent = "Stepped 1 instruction.";
        } else {
            document.getElementById('status-message').textContent = "End of program or Error.";
        }
    } catch (e) { console.error(e); }
}

async function runSimulation() {
    try {
        if (currentSimState) historyStack.push(JSON.parse(JSON.stringify(currentSimState)));

        const data = await run();
        if (data.success) {
            handleStateUpdate(data.state);
            document.getElementById('status-message').textContent = "Execution complete.";
        }
    } catch (e) { console.error(e); }
}

async function prevStep() {
    try {
        const ret = await stepBack();
        if (ret.success) {
            handleStateUpdate(ret.state);
            document.getElementById('status-message').textContent = "Stepped Back.";
        } else {
            document.getElementById('status-message').textContent = "Cannot step back further.";
        }
    } catch (e) { console.error(e); }
}

async function resetSimulation() {
    try {
        historyStack = [];
        const data = await reset();
        if (data.success) {
            handleStateUpdate(data.state);
            document.getElementById('status-message').textContent = "System Reset.";
        }
    } catch (e) { console.error(e); }
}

function handleStateUpdate(state) {
    if (!state) return;
    currentSimState = state;
    updateState(state, currentProgram);
}

function copyHex() {
    if (!currentProgram) return;

    // Sort by address for consistent hex dump
    const addrs = Object.keys(currentProgram).map(Number).sort((a, b) => a - b);
    let hex = "";

    // Check if currentProgram is array or dict
    if (Array.isArray(currentProgram)) {
        hex = currentProgram.map(inst => inst.machine_code.toString(16).padStart(8, '0')).join('\n');
    } else {
        hex = addrs.map(addr => {
            const inst = currentProgram[addr];
            return inst.machine_code.toString(16).padStart(8, '0');
        }).join('\n');
    }

    navigator.clipboard.writeText(hex);
    alert('Copied.');
}

function downloadHex() {
    try {
        if (!currentProgram || (Array.isArray(currentProgram) && currentProgram.length === 0) || (typeof currentProgram === 'object' && Object.keys(currentProgram).length === 0)) {
            console.warn("No program assembled.");
            return;
        }

        let hexOutput = "";

        if (Array.isArray(currentProgram)) {
            for (const inst of currentProgram) {
                const hex = (inst.machine_code >>> 0).toString(16).padStart(8, '0');
                hexOutput += hex + "\n";
            }
        } else {
            const addrs = Object.keys(currentProgram).map(Number).sort((a, b) => a - b);
            for (const addr of addrs) {
                const inst = currentProgram[addr];
                const hex = (inst.machine_code >>> 0).toString(16).padStart(8, '0');
                hexOutput += hex + "\n";
            }
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
