const regNames = [
    "zero", "ra", "sp", "gp", "tp", "t0", "t1", "t2",
    "s0", "s1", "a0", "a1", "a2", "a3", "a4", "a5",
    "a6", "a7", "s2", "s3", "s4", "s5", "s6", "s7",
    "s8", "s9", "s10", "s11", "t3", "t4", "t5", "t6"
];

let currentDatapath = null;
let currentFormat = 'hex';

export function setDatapath(dp) {
    currentDatapath = dp;
}

export function setFormat(fmt) {
    currentFormat = fmt;
}

export function updateState(state, program) {
    if (!state) return;

    // PC Badge
    const pcHex = "0x" + state.pc.toString(16).padStart(4, '0').toUpperCase();
    document.querySelectorAll('.pc-badge span').forEach(el => el.textContent = pcHex);

    renderRegisters(state.registers);
    renderMemory(state.memory);
    highlightTrace(state.pc);
    renderProgramList(program, state.pc);

    if (currentDatapath) {
        currentDatapath.draw(state);
    }
}

export function renderRegisters(values) {
    const container = document.getElementById('regs-panel');
    if (!container) return;
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

export function renderTrace(program) {
    const tbody = document.getElementById('trace-body');
    if (!tbody) return;
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

export function renderProgramList(program, currentPc) {
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
