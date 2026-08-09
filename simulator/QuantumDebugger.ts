import type { QuantumIR } from "../backend/src/compiler/types";
import { StateVectorSimulator, type StateVectorResult } from "./StateVectorSimulator";

export interface DebugSnapshot { step: number; operation?: QuantumIR["operations"][number]; state: StateVectorResult; }
export class QuantumDebugger {
  private cursor = 0; private breakpoints = new Set<number>(); private readonly snapshots = new Map<number, StateVectorResult>();
  constructor(private readonly program: QuantumIR, private readonly simulator = new StateVectorSimulator()) {}
  addBreakpoint(operationIndex: number): void { this.assertOperation(operationIndex); this.breakpoints.add(operationIndex); }
  removeBreakpoint(operationIndex: number): void { this.breakpoints.delete(operationIndex); }
  async stepForward(): Promise<DebugSnapshot> { if (this.cursor >= this.program.operations.length) return this.snapshot(); this.cursor++; return this.snapshot(); }
  async stepBack(): Promise<DebugSnapshot> { this.cursor = Math.max(0, this.cursor - 1); return this.snapshot(); }
  async continue(): Promise<DebugSnapshot> { do { if (this.cursor >= this.program.operations.length) break; this.cursor++; } while (!this.breakpoints.has(this.cursor)); return this.snapshot(); }
  inspectCircuit(): QuantumIR { return { qubits: this.program.qubits, operations: this.program.operations.slice(0, this.cursor) }; }
  async inspectRegisters(): Promise<StateVectorResult["registers"]> { return (await this.snapshot()).state.registers; }
  async inspectProbabilities(): Promise<StateVectorResult["probabilities"]> { return (await this.snapshot()).state.probabilities; }
  private async snapshot(): Promise<DebugSnapshot> { let state = this.snapshots.get(this.cursor); if (!state) { state = await this.simulator.runIR({ qubits: this.program.qubits, operations: this.program.operations.slice(0, this.cursor) }); this.snapshots.set(this.cursor, state); } return { step: this.cursor, operation: this.program.operations[this.cursor - 1], state }; }
  private assertOperation(index: number): void { if (!Number.isInteger(index) || index < 0 || index >= this.program.operations.length) throw new Error("Breakpoint is outside the compiled circuit."); }
}
