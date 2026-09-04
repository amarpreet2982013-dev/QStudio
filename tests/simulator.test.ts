import { describe, expect, it } from "vitest";
import { StateVectorSimulator } from "../simulator/StateVectorSimulator";

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
