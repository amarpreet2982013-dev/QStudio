import { describe, expect, it } from "vitest";
import { SilqCompiler } from "../backend/src/compiler/SilqCompiler";

describe("SilqCompiler", () => {
  const compiler = new SilqCompiler();

  describe("Valid programs", () => {
    it("compiles empty program", async () => {
      const result = await compiler.analyze("");
      expect(result.diagnostics.length).toBe(0);
    });

    it("compiles single qubit gate", async () => {
      const source = "fn test() { let q = new Qubit[1]; H(q[0]); }";
      const result = await compiler.analyze(source);
      expect(result.diagnostics).toEqual([]);
      expect(result.qasm).toContain("h q[0];");
    });

    it("compiles all single-qubit gates", async () => {
      const gates = ["H", "X", "Y", "Z", "S", "T"];
      for (const gate of gates) {
        const source = `fn test() { let q = new Qubit[1]; ${gate}(q[0]); }`;
        const result = await compiler.analyze(source);
        expect(result.diagnostics).toEqual([]);
        expect(result.qasm.toLowerCase()).toContain(gate.toLowerCase());
      }
    });

    it("compiles two-qubit gates", async () => {
      const gates = ["CNOT", "CZ", "SWAP"];
      for (const gate of gates) {
        const source = `fn test() { let q = new Qubit[2]; ${gate}(q[0], q[1]); }`;
        const result = await compiler.analyze(source);
        expect(result.diagnostics).toEqual([]);
      }
    });

    it("compiles controlled X (Bell state)", async () => {
      const source = "fn bell() { let q = new Qubit[2]; H(q[0]); X(q[1]).controlled(q[0]); }";
      const result = await compiler.analyze(source);
      expect(result.diagnostics).toEqual([]);
      expect(result.qasm).toContain("cx q[0], q[1];");
      expect(result.circuit.operations).toHaveLength(2);
    });

    it("compiles measurement", async () => {
      const source = "fn test() { let q = new Qubit[1]; measure(q[0]); }";
      const result = await compiler.analyze(source);
      expect(result.diagnostics).toEqual([]);
    });

    it("compiles reset", async () => {
      const source = "fn test() { let q = new Qubit[1]; reset(q[0]); }";
      const result = await compiler.analyze(source);
      expect(result.diagnostics).toEqual([]);
    });

    it("compiles multiple statements", async () => {
      const source = "fn test() { let q = new Qubit[2]; H(q[0]); X(q[1]); H(q[0]); }";
      const result = await compiler.analyze(source);
      expect(result.diagnostics).toEqual([]);
      expect(result.circuit.operations.length).toBeGreaterThan(0);
    });

    it("compiles with comments", async () => {
      const source = "// Comment\nfn test() { let q = new Qubit[1]; H(q[0]); // Another comment\n}";
      const result = await compiler.analyze(source);
      expect(result.diagnostics).toEqual([]);
    });
  });

  describe("AST generation", () => {
    it("generates AST for function", async () => {
      const source = "fn test() { let q = new Qubit[1]; H(q[0]); }";
      const ast = await compiler.parse(source);
      expect(ast.body).toBeDefined();
      expect(ast.body.length).toBeGreaterThan(0);
    });

    it("AST contains function name", async () => {
      const source = "fn myFunction() { let q = new Qubit[1]; }";
      const ast = await compiler.parse(source);
      const func = ast.body[0];
      expect(func.kind).toBe("Function");
      expect((func as any).name).toBe("myFunction");
    });
  });

  describe("Semantic analysis", () => {
    it("detects undefined variables", async () => {
      const source = "fn test() { H(undefined_var); }";
      const result = await compiler.analyze(source);
      expect(result.diagnostics.length).toBeGreaterThan(0);
    });

    it("accepts valid identifier names", async () => {
      const source = "fn test_fn() { let myVar = new Qubit[1]; H(myVar[0]); }";
      const result = await compiler.analyze(source);
      expect(result.diagnostics).toEqual([]);
    });
  });

  describe("OpenQASM generation", () => {
    it("generates valid OpenQASM", async () => {
      const source = "fn test() { let q = new Qubit[1]; H(q[0]); }";
      const result = await compiler.analyze(source);
      expect(result.qasm).toContain("OPENQASM");
      expect(result.qasm).toContain("h q[0];");
    });
  });

  describe("Circuit generation", () => {
    it("generates circuit model", async () => {
      const source = "fn test() { let q = new Qubit[2]; H(q[0]); X(q[1]); }";
      const circuit = await compiler.generateCircuit(source);
      expect(circuit).toBeDefined();
      expect(circuit.qubits).toBe(2);
      expect(circuit.operations.length).toBeGreaterThan(0);
    });

    it("circuit operations map to gates", async () => {
      const source = "fn test() { let q = new Qubit[2]; H(q[0]); X(q[1]); }";
      const circuit = await compiler.generateCircuit(source);
      const gates = circuit.operations.map((op) => op.gate);
      expect(gates).toContain("H");
      expect(gates).toContain("X");
    });
  });
});
