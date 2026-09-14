import { describe, expect, it } from "vitest";
import { StateVectorSimulator } from "../simulator/StateVectorSimulator";
import type { QuantumIR } from "../backend/src/compiler/types";

describe("StateVectorSimulator", () => {
  const simulator = new StateVectorSimulator();

  it("produces a Bell-state probability distribution", async () => {
    const source = "fn bell() {\n let q = new Qubit[2];\n H(q[0]);\n X(q[1]).controlled(q[0]);\n}";
    const result = await simulator.run(source, 100);
    expect(result.probabilities["00"]).toBeCloseTo(0.5);
    expect(result.probabilities["11"]).toBeCloseTo(0.5);
  });

  it("evaluates ground state |0⟩", async () => {
    const source = "fn main() { let q = new Qubit[1]; }";
    const result = await simulator.run(source);
    expect(result.probabilities["0"]).toBeCloseTo(1.0);
  });

  it("evaluates Pauli X |0⟩ -> |1⟩", async () => {
    const source = "fn main() { let q = new Qubit[1]; X(q[0]); }";
    const result = await simulator.run(source);
    expect(result.probabilities["1"]).toBeCloseTo(1.0);
  });

  it("evaluates Hadamard superposition H|0⟩", async () => {
    const source = "fn main() { let q = new Qubit[1]; H(q[0]); }";
    const result = await simulator.run(source);
    expect(result.probabilities["0"]).toBeCloseTo(0.5);
    expect(result.probabilities["1"]).toBeCloseTo(0.5);
  });

  it("evaluates H -> S phase shift", async () => {
    const source = "fn main() { let q = new Qubit[1]; H(q[0]); S(q[0]); }";
    const result = await simulator.run(source);
    expect(result.registers[0].bloch.y).toBeCloseTo(1.0);
  });

  it("evaluates H -> T phase shift", async () => {
    const source = "fn main() { let q = new Qubit[1]; H(q[0]); T(q[0]); }";
    const result = await simulator.run(source);
    expect(result.registers[0].bloch.x).toBeCloseTo(Math.SQRT1_2, 2);
    expect(result.registers[0].bloch.y).toBeCloseTo(Math.SQRT1_2, 2);
  });

  it("evaluates SWAP operation", async () => {
    const source = "fn main() { let q = new Qubit[2]; X(q[0]); SWAP(q[0], q[1]); }";
    const result = await simulator.run(source);
    expect(result.probabilities["10"]).toBeCloseTo(1.0);
  });

  it("evaluates Reset operation back to ground state", async () => {
    const source = "fn main() { let q = new Qubit[1]; X(q[0]); reset(q[0]); }";
    const result = await simulator.run(source);
    expect(result.probabilities["0"]).toBeCloseTo(1.0);
  });

  it("records deterministic measurements of |0⟩ and |1⟩", async () => {
    const zero = await simulator.run("fn main() { let q = new Qubit[1]; measure(q[0]); }", 32);
    const one = await simulator.run("fn main() { let q = new Qubit[1]; X(q[0]); measure(q[0]); }", 32);

    expect(zero.measurementResults.every(([result]) => result === 0)).toBe(true);
    expect(one.measurementResults.every(([result]) => result === 1)).toBe(true);
  });

  it("samples |+⟩ and |−⟩ measurements evenly", async () => {
    const plus = await simulator.run("fn main() { let q = new Qubit[1]; H(q[0]); measure(q[0]); }", 2000);
    const minus = await simulator.run("fn main() { let q = new Qubit[1]; H(q[0]); Z(q[0]); measure(q[0]); }", 2000);
    const fractionOf = (results: Array<Array<0 | 1>>, value: 0 | 1) => results.filter(([result]) => result === value).length / results.length;

    expect(fractionOf(plus.measurementResults, 0)).toBeGreaterThan(0.43);
    expect(fractionOf(plus.measurementResults, 0)).toBeLessThan(0.57);
    expect(fractionOf(minus.measurementResults, 0)).toBeGreaterThan(0.43);
    expect(fractionOf(minus.measurementResults, 0)).toBeLessThan(0.57);
  });

  it("records correlated Bell-state measurements", async () => {
    const result = await simulator.run("fn bell() { let q = new Qubit[2]; H(q[0]); X(q[1]).controlled(q[0]); measure(q[0]); measure(q[1]); }", 512);

    expect(result.measurementResults.every(([first, second]) => first === second)).toBe(true);
  });

  it("uses a collapsed state for later gates and repeated measurements", async () => {
    const result = await simulator.run("fn main() { let q = new Qubit[1]; H(q[0]); measure(q[0]); X(q[0]); measure(q[0]); }", 256);

    expect(result.measurementResults.every(([first, second]) => second === (first === 0 ? 1 : 0))).toBe(true);
    expect(result.measurementResults.every(([first, second]) => first !== second)).toBe(true);
  });

  it("supports nonzero qubit indices and preserves normalization after measurement", async () => {
    const result = await simulator.run("fn main() { let q = new Qubit[2]; X(q[1]); measure(q[1]); }", 64);
    const probabilitySum = Object.values(result.probabilities).reduce((sum, probability) => sum + probability, 0);

    expect(result.measurementResults.every(([measurement]) => measurement === 1)).toBe(true);
    expect(result.probabilities["10"]).toBeCloseTo(1);
    expect(probabilitySum).toBeCloseTo(1);
  });

  it("resets a measured qubit to |0⟩", async () => {
    const result = await simulator.run("fn main() { let q = new Qubit[1]; H(q[0]); measure(q[0]); reset(q[0]); measure(q[0]); }", 256);

    expect(result.measurementResults.every(([, afterReset]) => afterReset === 0)).toBe(true);
  });

  it("preserves the remaining qubit state when resetting after measurement", async () => {
    const result = await simulator.run("fn bell() { let q = new Qubit[2]; H(q[0]); X(q[1]).controlled(q[0]); measure(q[0]); reset(q[0]); measure(q[1]); }", 256);

    expect(result.measurementResults.every(([measured, remaining]) => measured === remaining)).toBe(true);
  });

  it("rejects invalid qubit references", async () => {
    const invalid: QuantumIR = {
      qubits: 1,
      operations: [{ opcode: "measure", targets: [1], controls: [], source: { start: 0, end: 0, line: 1, column: 1 } }],
    };

    await expect(simulator.runIR(invalid, 1)).rejects.toThrow("Invalid qubit index 1");
  });

  it("verifies state vector normalization sum = 1.0", async () => {
    const source = "fn main() { let q = new Qubit[3]; H(q[0]); H(q[1]); H(q[2]); }";
    const result = await simulator.run(source);
    const sum = Object.values(result.probabilities).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0);
  });

  describe("Performance Benchmarks (1, 2, 4, 8, 12 qubits)", () => {
    const sizes = [1, 2, 4, 8, 12];
    for (const numQubits of sizes) {
      it(`simulates ${numQubits} qubit(s) circuit within timing threshold`, async () => {
        let gatesCode = "";
        for (let i = 0; i < numQubits; i++) {
          gatesCode += `H(q[${i}]);\n`;
        }
        const source = `fn benchmark() { let q = new Qubit[${numQubits}]; ${gatesCode} }`;
        const start = performance.now();
        const result = await simulator.run(source, 1024);
        const duration = performance.now() - start;

        expect(result.registers.length).toBe(numQubits);
        expect(duration).toBeLessThan(1500); // 12-qubit state vector simulation takes well under 1.5s
      });
    }
  });
});
