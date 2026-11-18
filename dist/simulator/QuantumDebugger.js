"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuantumDebugger = void 0;
const StateVectorSimulator_1 = require("./StateVectorSimulator");
class QuantumDebugger {
    program;
    simulator;
    options;
    cursor = 0;
    breakpoints = new Set();
    snapshots = new Map();
    constructor(program, simulator = new StateVectorSimulator_1.StateVectorSimulator(), options = {}) {
        this.program = program;
        this.simulator = simulator;
        this.options = options;
        if (program.operations.some((operation) => operation.classicalTarget !== undefined || operation.condition !== undefined)) {
            throw new Error("The step debugger does not yet support dynamic-circuit trajectories. Use simulation output for per-shot measurement records.");
        }
    }
    get currentStep() { return this.cursor; }
    get totalSteps() { return this.program.operations.length; }
    reset() { this.cursor = 0; }
    async goToStep(step) {
        if (!Number.isInteger(step) || step < 0 || step > this.totalSteps) {
            throw new Error("Execution step is outside the compiled program.");
        }
        this.cursor = step;
        return this.snapshot();
    }
    addBreakpoint(operationIndex) { this.assertOperation(operationIndex); this.breakpoints.add(operationIndex); }
    removeBreakpoint(operationIndex) { this.breakpoints.delete(operationIndex); }
    toggleBreakpoint(operationIndex) { if (this.breakpoints.has(operationIndex)) {
        this.breakpoints.delete(operationIndex);
        return false;
    }
    else {
        this.addBreakpoint(operationIndex);
        return true;
    } }
    hasBreakpoint(operationIndex) { return this.breakpoints.has(operationIndex); }
    async stepForward() { if (this.cursor >= this.program.operations.length)
        return this.snapshot(); this.cursor++; return this.snapshot(); }
    async stepBack() { this.cursor = Math.max(0, this.cursor - 1); return this.snapshot(); }
    async continue() { do {
        if (this.cursor >= this.program.operations.length)
            break;
        this.cursor++;
    } while (!this.breakpoints.has(this.cursor)); return this.snapshot(); }
    inspectCircuit() { return { qubits: this.program.qubits, operations: this.program.operations.slice(0, this.cursor) }; }
    async inspectRegisters() { return (await this.snapshot()).state.registers; }
    async inspectProbabilities() { return (await this.snapshot()).state.probabilities; }
    async snapshot() { let state = this.snapshots.get(this.cursor); if (!state) {
        if (this.options.replaySeed !== undefined)
            this.simulator.setSeed(this.options.replaySeed);
        state = await this.simulator.runIR({ qubits: this.program.qubits, operations: this.program.operations.slice(0, this.cursor) });
        this.snapshots.set(this.cursor, state);
    } return { step: this.cursor, operation: this.program.operations[this.cursor - 1], state }; }
    assertOperation(index) { if (!Number.isInteger(index) || index < 0 || index >= this.program.operations.length)
        throw new Error("Breakpoint is outside the compiled circuit."); }
}
exports.QuantumDebugger = QuantumDebugger;
