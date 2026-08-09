import { describe, expect, it } from "vitest";
import { SilqCompiler } from "../backend/src/compiler/SilqCompiler";

describe("SilqCompiler", () => {
  it("lowers a controlled X into OpenQASM", async () => {
    const source = "fn bell() { let q = new Qubit[2]; H(q[0]); X(q[1]).controlled(q[0]); }";
    const result = await new SilqCompiler().analyze(source);
    expect(result.diagnostics).toEqual([]);
    expect(result.qasm).toContain("cx q[0], q[1];");
    expect(result.circuit.operations).toHaveLength(2);
  });
});
