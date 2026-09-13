import type { CircuitModel, Diagnostic } from "../../contracts";
import type { CompilationResult, QuantumIR } from "../../compiler/types";
import type { ExampleCode, LanguageCapabilities, QuantumLanguageAdapter } from "../types";
import { OpenQasm3Parser } from "./OpenQasm3Parser";

export class OpenQasm3LanguageAdapter implements QuantumLanguageAdapter {
  readonly id = "openqasm3";
  readonly name = "OpenQASM 3.0";
  readonly extensions = [".qasm", ".qasm3"];
  readonly monacoLanguageId = "openqasm3";

  readonly capabilities: LanguageCapabilities = {
    gates: ["h", "x", "y", "z", "s", "t", "cx", "cnot", "cz", "swap"],
    measurement: true,
    reset: true,
    controlledGates: true,
    multiQubitGates: true,
  };

  readonly examplePrograms: ExampleCode[] = [
    {
      id: "bell-state-openqasm3",
      name: "Bell State (OpenQASM 3.0)",
      description: "Generates entangled Bell state (|00⟩ + |11⟩)/√2 using OpenQASM 3.0 syntax.",
      code: `OPENQASM 3.0;
include "stdgates.inc";

qubit[2] q;
bit[2] c;

h q[0];
cx q[0], q[1];

measure q[0] -> c[0];
measure q[1] -> c[1];
`,
    },
  ];

  constructor(private readonly parser = new OpenQasm3Parser()) {}

  async compile(source: string): Promise<CompilationResult> {
    return this.parser.parse(source);
  }

  async diagnostics(source: string): Promise<Diagnostic[]> {
    const result = this.parser.parse(source);
    return result.diagnostics;
  }

  async generateCircuit(source: string): Promise<CircuitModel> {
    const result = this.parser.parse(source);
    return result.circuit;
  }

  async generateIR(source: string): Promise<QuantumIR> {
    const result = this.parser.parse(source);
    return result.ir;
  }

  format(source: string): string {
    return source
      .split("\n")
      .map((line) => line.trim())
      .join("\n");
  }
}
