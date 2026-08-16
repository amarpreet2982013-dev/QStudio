import { describe, expect, it } from "vitest";
import { StateVectorSimulator } from "../simulator/StateVectorSimulator";

describe("StateVectorSimulator", () => {
  const simulator = new StateVectorSimulator();

  describe("State vector", () => {
    it("initializes to |0⟩", async () => {
      const source = "fn test() { let q = new Qubit[1]; }";
      const result = await simulator.run(source, 100);
      expect(result.probabilities["0"]).toBeCloseTo(1.0);
      expect(result.probabilities["1"] ?? 0).toBeCloseTo(0.0);
    });

    it("returns valid state vector", async () => {
      const source = "fn test() { let q = new Qubit[1]; H(q[0]); }";
      const result = await simulator.run(source, 100);
      expect(result.stateVector).toBeDefined();
      expect(Array.isArray(result.stateVector)).toBe(true);
    });
  });

  describe("Single-qubit gates", () => {
    it("H gate creates superposition", async () => {
      const source = "fn test() { let q = new Qubit[1]; H(q[0]); }";
      const result = await simulator.run(source, 1000);
      expect(result.probabilities["0"]).toBeCloseTo(0.5, 1);
      expect(result.probabilities["1"]).toBeCloseTo(0.5, 1);
    });

    it("X gate flips state", async () => {
      const source = "fn test() { let q = new Qubit[1]; X(q[0]); }";
      const result = await simulator.run(source, 100);
      expect(result.probabilities["0"] ?? 0).toBeCloseTo(0.0);
      expect(result.probabilities["1"]).toBeCloseTo(1.0);
    });

    it("Y gate applies Pauli-Y", async () => {
      const source = "fn test() { let q = new Qubit[1]; Y(q[0]); }";
      const result = await simulator.run(source, 100);
      expect(result.probabilities["1"]).toBeCloseTo(1.0);
    });

    it("Z gate applies phase", async () => {
      const source = "fn test() { let q = new Qubit[1]; H(q[0]); Z(q[0]); }";
      const result = await simulator.run(source, 1000);
      expect(result.probabilities["0"]).toBeCloseTo(0.5, 1);
      expect(result.probabilities["1"]).toBeCloseTo(0.5, 1);
    });

    it("S gate applies π/2 phase", async () => {
      const source = "fn test() { let q = new Qubit[1]; H(q[0]); S(q[0]); }";
      const result = await simulator.run(source, 1000);
      expect(result.probabilities["0"]).toBeCloseTo(0.5, 1);
    });

    it("T gate applies π/4 phase", async () => {
      const source = "fn test() { let q = new Qubit[1]; H(q[0]); T(q[0]); }";
      const result = await simulator.run(source, 1000);
      expect(result.probabilities["0"]).toBeCloseTo(0.5, 1);
    });
  });

  describe("Two-qubit gates", () => {
    it("produces a Bell state (CNOT)", async () => {
      const source = "fn bell() { let q = new Qubit[2]; H(q[0]); X(q[1]).controlled(q[0]); }";
      const result = await simulator.run(source, 1000);
      expect(result.probabilities["00"]).toBeCloseTo(0.5, 1);
      expect(result.probabilities["11"]).toBeCloseTo(0.5, 1);
    });

    it("CZ gate entangles qubits", async () => {
      const source = "fn test() { let q = new Qubit[2]; H(q[0]); H(q[1]); CZ(q[0], q[1]); }";
      const result = await simulator.run(source, 1000);
      expect(Object.keys(result.probabilities).length).toBeGreaterThan(0);
    });

    it("SWAP gate exchanges qubits", async () => {
      const source = "fn test() { let q = new Qubit[2]; X(q[0]); SWAP(q[0], q[1]); }";
      const result = await simulator.run(source, 100);
      expect(result.probabilities["10"]).toBeCloseTo(1.0);
    });
  });

  describe("Measurement", () => {
    it("measures qubit probabilistically", async () => {
      const source = "fn test() { let q = new Qubit[1]; H(q[0]); measure(q[0]); }";
      const result = await simulator.run(source, 1000);
      expect(result.counts["0"]).toBeDefined();
      expect(result.counts["1"]).toBeDefined();
    });

    it("measurement results sum to shots", async () => {
      const shots = 500;
      const source = "fn test() { let q = new Qubit[2]; H(q[0]); H(q[1]); }";
      const result = await simulator.run(source, shots);
      const total = Object.values(result.counts).reduce((a, b) => a + b, 0);
      expect(total).toBe(shots);
    });
  });

  describe("Reset", () => {
    it("resets qubit to |0⟩", async () => {
      const source = "fn test() { let q = new Qubit[1]; X(q[0]); reset(q[0]); }";
      const result = await simulator.run(source, 100);
      expect(result.probabilities["0"]).toBeCloseTo(1.0);
    });
  });

  describe("Normalization", () => {
    it("probabilities sum to 1", async () => {
      const source = "fn test() { let q = new Qubit[2]; H(q[0]); H(q[1]); }";
      const result = await simulator.run(source, 100);
      const sum = Object.values(result.probabilities).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0);
    });
  });

  describe("Multi-qubit operations", () => {
    it("handles 3-qubit system", async () => {
      const source = "fn test() { let q = new Qubit[3]; H(q[0]); H(q[1]); H(q[2]); }";
      const result = await simulator.run(source, 100);
      expect(result.probabilities).toBeDefined();
      expect(Object.keys(result.probabilities).length).toBeGreaterThan(0);
    });

    it("handles 4-qubit system", async () => {
      const source = "fn test() { let q = new Qubit[4]; H(q[0]); }";
      const result = await simulator.run(source, 100);
      expect(result.probabilities).toBeDefined();
    });
  });

  describe("Registers", () => {
    it("returns register information", async () => {
      const source = "fn test() { let q = new Qubit[2]; H(q[0]); }";
      const result = await simulator.run(source, 100);
      expect(result.registers).toBeDefined();
      expect(result.registers.length).toBe(2);
    });

    it("registers contain Bloch vectors", async () => {
      const source = "fn test() { let q = new Qubit[1]; H(q[0]); }";
      const result = await simulator.run(source, 100);
      const register = result.registers[0];
      expect(register.bloch).toBeDefined();
      expect(register.bloch.x).toBeDefined();
      expect(register.bloch.y).toBeDefined();
      expect(register.bloch.z).toBeDefined();
    });

    it("registers contain probabilities", async () => {
      const source = "fn test() { let q = new Qubit[1]; H(q[0]); }";
      const result = await simulator.run(source, 100);
      const register = result.registers[0];
      expect(register.zero).toBeDefined();
      expect(register.one).toBeDefined();
      expect(register.zero + register.one).toBeCloseTo(1.0);
    });
  });

  describe("Performance", () => {
    it("measures execution time", async () => {
      const source = "fn test() { let q = new Qubit[1]; H(q[0]); }";
      const result = await simulator.run(source, 100);
      expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
      expect(typeof result.elapsedMs).toBe("number");
    });
  });
});
