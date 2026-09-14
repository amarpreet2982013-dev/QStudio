import { SilqCompiler } from "../backend/src/compiler/SilqCompiler";
import type { IROperation, QuantumIR } from "../backend/src/compiler/types";
export interface SimulationResult { shots: number; counts: Record<string, number>; measurements: Array<Array<0 | 1>>; stateVector?: string[]; elapsedMs: number; }
export interface QuantumSimulator { compile(source: string): Promise<QuantumIR>; run(source: string, shots?: number): Promise<SimulationResult>; measure(qubit: number): Promise<0 | 1>; stop(): Promise<void>; }

export interface StateVectorResult extends SimulationResult { probabilities: Record<string, number>; registers: Array<{ qubit: number; zero: number; one: number; bloch: { x: number; y: number; z: number } }>; }
type Complex = readonly [number, number];

export class StateVectorSimulator implements QuantumSimulator {
  private cancelled = false;
  private real = new Float64Array(); private imaginary = new Float64Array(); private qubits = 0;
  constructor(private readonly compiler = new SilqCompiler()) {}
  async compile(source: string): Promise<QuantumIR> { return (await this.compiler.analyze(source)).ir; }
  async run(source: string, shots = 1024): Promise<StateVectorResult> { const ir = await this.compile(source); return this.runIR(ir, shots); }
  async runIR(ir: QuantumIR, shots = 1024): Promise<StateVectorResult> {
    if (ir.qubits < 1 || ir.qubits > 12) throw new Error("State-vector simulation supports 1–12 qubits."); if (!Number.isInteger(shots) || shots < 1) throw new Error("Shots must be a positive integer.");
    this.cancelled = false; const started = performance.now(); const counts: Record<string, number> = {}; const measurements: Array<Array<0 | 1>> = []; let finalProbabilities: Record<string, number> = {};
    for (let shot = 0; shot < shots; shot++) {
      this.initialize(ir.qubits); const shotMeasurements: Array<0 | 1> = [];
      for (const operation of ir.operations) { if (this.cancelled) throw new Error("Simulation stopped."); this.apply(operation, shotMeasurements); }
      finalProbabilities = this.probabilities(); const key = shotMeasurements.length > 0 ? shotMeasurements.join("") : this.sampleOne(finalProbabilities); counts[key] = (counts[key] ?? 0) + 1; measurements.push(shotMeasurements);
    }
    return { shots, counts, measurements, probabilities: finalProbabilities, stateVector: this.stateVector(), registers: this.registers(), elapsedMs: Math.round(performance.now() - started) };
  }
  async measure(qubit: number): Promise<0 | 1> { this.assertQubit(qubit); return this.measureQubit(qubit); }
  async stop(): Promise<void> { this.cancelled = true; }
  private initialize(qubits: number): void { this.qubits = qubits; const size = 1 << qubits; this.real = new Float64Array(size); this.imaginary = new Float64Array(size); this.real[0] = 1; }
  private apply(operation: IROperation, measurements: Array<0 | 1>): void { const [a, b] = operation.targets; switch (operation.opcode) { case "h": this.single(a, [Math.SQRT1_2, 0], [Math.SQRT1_2, 0], [Math.SQRT1_2, 0], [-Math.SQRT1_2, 0]); break; case "x": this.single(a, [0, 0], [1, 0], [1, 0], [0, 0]); break; case "y": this.single(a, [0, 0], [0, -1], [0, 1], [0, 0]); break; case "z": this.single(a, [1, 0], [0, 0], [0, 0], [-1, 0]); break; case "s": this.single(a, [1, 0], [0, 0], [0, 0], [0, 1]); break; case "t": this.single(a, [1, 0], [0, 0], [0, 0], [Math.SQRT1_2, Math.SQRT1_2]); break; case "cx": this.controlledX(operation.controls[0] ?? a, operation.targets[operation.controls.length ? 0 : 1] ?? b); break; case "cz": this.controlledZ(operation.controls[0] ?? a, operation.targets[operation.controls.length ? 0 : 1] ?? b); break; case "swap": this.swap(a, b); break; case "reset": for (const target of operation.targets) this.reset(target); break; case "measure": for (const target of operation.targets) measurements.push(this.measureQubit(target)); break; } }
  private single(target: number, m00: Complex, m01: Complex, m10: Complex, m11: Complex): void { this.assertQubit(target); const bit = 1 << target; for (let base = 0; base < this.real.length; base += bit << 1) for (let offset = 0; offset < bit; offset++) { const i0 = base + offset, i1 = i0 + bit; const [r0, im0] = [this.real[i0], this.imaginary[i0]], [r1, im1] = [this.real[i1], this.imaginary[i1]]; [this.real[i0], this.imaginary[i0]] = this.multiplyAdd(m00, r0, im0, m01, r1, im1); [this.real[i1], this.imaginary[i1]] = this.multiplyAdd(m10, r0, im0, m11, r1, im1); } }
  private multiplyAdd(a: Complex, br: number, bi: number, c: Complex, dr: number, di: number): [number, number] { return [a[0] * br - a[1] * bi + c[0] * dr - c[1] * di, a[0] * bi + a[1] * br + c[0] * di + c[1] * dr]; }
  private controlledX(control: number, target: number): void { this.assertQubit(control); this.assertQubit(target); if (control === target) throw new Error("Control and target must differ."); for (let i = 0; i < this.real.length; i++) if ((i & (1 << control)) && !(i & (1 << target))) { const pair = i | (1 << target); [this.real[i], this.real[pair]] = [this.real[pair], this.real[i]]; [this.imaginary[i], this.imaginary[pair]] = [this.imaginary[pair], this.imaginary[i]]; } }
  private controlledZ(control: number, target: number): void { this.assertQubit(control); this.assertQubit(target); for (let i = 0; i < this.real.length; i++) if ((i & (1 << control)) && (i & (1 << target))) { this.real[i] *= -1; this.imaginary[i] *= -1; } }
  private swap(a: number, b: number): void { this.assertQubit(a); this.assertQubit(b); if (a === b) return; for (let i = 0; i < this.real.length; i++) { const bitA = Boolean(i & (1 << a)), bitB = Boolean(i & (1 << b)); if (bitA === bitB) continue; const pair = i ^ (1 << a) ^ (1 << b); if (i < pair) { [this.real[i], this.real[pair]] = [this.real[pair], this.real[i]]; [this.imaginary[i], this.imaginary[pair]] = [this.imaginary[pair], this.imaginary[i]]; } } }
  private reset(qubit: number): void { const result = this.measureQubit(qubit); if (result === 1) this.single(qubit, [0, 0], [1, 0], [1, 0], [0, 0]); }
  private measureQubit(qubit: number): 0 | 1 { this.assertQubit(qubit); const one = this.probabilityOne(qubit); const result: 0 | 1 = Math.random() < one ? 1 : 0; this.collapse(qubit, result); return result; }
  private probabilityOne(qubit: number): number { let value = 0; for (let i = 0; i < this.real.length; i++) if (i & (1 << qubit)) value += this.real[i] ** 2 + this.imaginary[i] ** 2; return value; }
  private collapse(qubit: number, result: 0 | 1): void { const probability = result ? this.probabilityOne(qubit) : 1 - this.probabilityOne(qubit); const scale = probability > 0 ? 1 / Math.sqrt(probability) : 0; for (let i = 0; i < this.real.length; i++) if (Boolean(i & (1 << qubit)) !== Boolean(result)) { this.real[i] = 0; this.imaginary[i] = 0; } else { this.real[i] *= scale; this.imaginary[i] *= scale; } }
  private probabilities(): Record<string, number> { const result: Record<string, number> = {}; for (let i = 0; i < this.real.length; i++) { const value = this.real[i] ** 2 + this.imaginary[i] ** 2; if (value > 1e-12) result[i.toString(2).padStart(this.qubits, "0")] = value; } return result; }
  private sampleOne(probabilities: Record<string, number>): string { const rows = Object.entries(probabilities); let cursor = Math.random(); for (const [state, probability] of rows) { cursor -= probability; if (cursor <= 0) return state; } return rows[rows.length - 1]?.[0] ?? ""; }
  private stateVector(): string[] { const output: string[] = []; for (let i = 0; i < this.real.length; i++) { const r = this.real[i], im = this.imaginary[i]; if (Math.abs(r) > 1e-12 || Math.abs(im) > 1e-12) output.push(`${this.format(r)}${im < 0 ? " − " : " + "}${this.format(Math.abs(im))}i|${i.toString(2).padStart(this.qubits, "0")}⟩`); } return output; }
  private registers(): StateVectorResult["registers"] { return Array.from({ length: this.qubits }, (_, qubit) => { const one = this.probabilityOne(qubit); let x = 0, y = 0; const bit = 1 << qubit; for (let i = 0; i < this.real.length; i++) if (!(i & bit)) { const pair = i | bit; x += 2 * (this.real[i] * this.real[pair] + this.imaginary[i] * this.imaginary[pair]); y += 2 * (this.real[i] * this.imaginary[pair] - this.imaginary[i] * this.real[pair]); } return { qubit, zero: 1 - one, one, bloch: { x, y, z: 1 - 2 * one } }; }); }
  private assertQubit(qubit: number): void { if (!Number.isInteger(qubit) || qubit < 0 || qubit >= this.qubits) throw new Error(`Invalid qubit index ${qubit}.`); } private format(value: number): string { return Math.abs(value).toFixed(3); }
}
