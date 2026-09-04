import { describe, expect, it } from "vitest";
import { SilqCompiler } from "../backend/src/compiler/SilqCompiler";

describe("SilqCompiler", () => {
  const compiler = new SilqCompiler();

  it("lowers a controlled X into OpenQASM", async () => {
    const source = "fn bell() { let q = new Qubit[2]; H(q[0]); X(q[1]).controlled(q[0]); }";
    const result = await compiler.analyze(source);
    expect(result.diagnostics).toEqual([]);
    expect(result.qasm).toContain("cx q[0], q[1];");
    expect(result.circuit.operations).toHaveLength(2);
  });

  it("parses valid function and qubit declaration", async () => {
    const source = "fn main() { let q = new Qubit[2]; }";
    const result = await compiler.analyze(source);
    expect(result.diagnostics).toHaveLength(0);
    expect(result.ast.kind).toBe("Program");
  });

  it("supports all single and multi-qubit gates (H, X, Y, Z, S, T, CNOT, CZ, SWAP, Measure, Reset)", async () => {
    const source = `
      fn gates() {
        let q = new Qubit[2];
        H(q[0]);
        X(q[1]);
        Y(q[0]);
        Z(q[1]);
        S(q[0]);
        T(q[1]);
        CNOT(q[0], q[1]);
        CZ(q[0], q[1]);
        SWAP(q[0], q[1]);
        measure(q[0]);
        reset(q[1]);
      }
    `;
    const result = await compiler.analyze(source);
    expect(result.diagnostics).toEqual([]);
    expect(result.ir.operations.length).toBe(11);
  });

  it("emits error diagnostics for malformed syntax", async () => {
    const source = "fn broken() { let q = new Qubit[2]; invalid_token_here }";
    const result = await compiler.analyze(source);
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(result.diagnostics[0].severity).toBe("error");
  });

  it("emits diagnostic for unknown qubit reference", async () => {
    const source = "fn main() { H(unknown_qubit[0]); }";
    const result = await compiler.analyze(source);
    expect(result.diagnostics.some((d) => d.message.includes("Unknown quantum register"))).toBe(true);
  });

  it("emits diagnostic for invalid qubit index", async () => {
    const source = "fn main() { let q = new Qubit[2]; H(q[5]); }";
    const result = await compiler.analyze(source);
    expect(result.diagnostics.some((d) => d.message.includes("Invalid qubit index 5"))).toBe(true);
  });

  it("emits diagnostic for duplicate declaration", async () => {
    const source = "fn main() { let q = new Qubit[2]; let q = new Qubit[1]; }";
    const result = await compiler.analyze(source);
    expect(result.diagnostics.some((d) => d.message.includes("Duplicate declaration 'q'"))).toBe(true);
  });
});
