/* simulator.js - Bridge to Pure JS RISC-V Simulator (RV32I) */
import { RISCVSimulator } from './lib/simulator.js';

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
