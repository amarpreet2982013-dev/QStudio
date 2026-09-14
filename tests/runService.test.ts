import { describe, expect, it } from "vitest";
import type { QuantumIR } from "../backend/src/compiler/types";
import { defaultLanguageRegistry } from "../backend/src/languages";
import { StateVectorSimulator, type StateVectorResult } from "../simulator/StateVectorSimulator";
import { compileAndSimulate } from "../renderer/src/services/RunService";

class TrackingSimulator extends StateVectorSimulator {
  calls = 0;
  override async runIR(ir: QuantumIR, shots = 1024): Promise<StateVectorResult> {
    this.calls += 1;
    return super.runIR(ir, shots);
  }
}

describe("compileAndSimulate", () => {
  it("compiles valid source and executes the generated IR", async () => {
    const simulator = new TrackingSimulator();
    const adapter = defaultLanguageRegistry.get("silq")!;
    const result = await compileAndSimulate(adapter, "fn main() { let q = new Qubit[1]; X(q[0]); measure(q[0]); }", 32, simulator);

    expect(result.compilation.diagnostics).toEqual([]);
    expect(result.simulation?.counts["1"]).toBe(32);
    expect(result.simulation?.measurementResults.every(([measurement]) => measurement === 1)).toBe(true);
    expect(simulator.calls).toBe(1);
  });

  it("does not simulate source with compiler errors", async () => {
    const simulator = new TrackingSimulator();
    const adapter = defaultLanguageRegistry.get("silq")!;
    const result = await compileAndSimulate(adapter, "fn main() { let q = new Qubit[1]; X(q[1]); }", 32, simulator);

    expect(result.compilation.diagnostics.some((diagnostic) => diagnostic.severity === "error")).toBe(true);
    expect(result.simulation).toBeUndefined();
    expect(simulator.calls).toBe(0);
  });

  it("uses the current source and selected language adapter for each run", async () => {
    const simulator = new TrackingSimulator();
    const silq = defaultLanguageRegistry.get("silq")!;
    const qasm3 = defaultLanguageRegistry.get("openqasm3")!;

    const first = await compileAndSimulate(silq, "fn main() { let q = new Qubit[1]; X(q[0]); }", 8, simulator);
    const second = await compileAndSimulate(qasm3, "OPENQASM 3.0; qubit[1] q; x q[0];", 8, simulator);

    expect(first.compilation.ir.operations[0]?.opcode).toBe("x");
    expect(second.compilation.ir.operations[0]?.opcode).toBe("x");
    expect(first.simulation?.probabilities["1"]).toBeCloseTo(1);
    expect(second.simulation?.probabilities["1"]).toBeCloseTo(1);
    expect(simulator.calls).toBe(2);
  });

  it("propagates simulator failures for the UI to handle", async () => {
    const failingSimulator = {
      runIR: async () => {
        throw new Error("simulator unavailable");
      },
    } as unknown as StateVectorSimulator;

    await expect(
      compileAndSimulate(defaultLanguageRegistry.get("silq")!, "fn main() { let q = new Qubit[1]; }", 1, failingSimulator)
    ).rejects.toThrow("simulator unavailable");
  });
});