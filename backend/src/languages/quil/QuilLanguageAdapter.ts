import type { CircuitModel, Diagnostic } from "../../contracts";
import type { CompilationResult, QuantumIR } from "../../compiler/types";
import type { ExampleCode, LanguageCapabilities, QuantumLanguageAdapter } from "../types";
import { QuilParser } from "./QuilParser";

export class QuilLanguageAdapter implements QuantumLanguageAdapter {
  readonly id = "quil";
  readonly name = "Quil";
  readonly extensions = [".quil"];
  readonly monacoLanguageId = "quil";

  readonly capabilities: LanguageCapabilities = {
    gates: ["H", "X", "Y", "Z", "S", "T", "CNOT", "CZ", "SWAP"],
    measurement: true,
    reset: true,
    controlledGates: true,
    multiQubitGates: true,
  };

  readonly examplePrograms: ExampleCode[] = [
    {
      id: "bell-state-quil",
      name: "Bell State (Quil)",
      description: "Generates entangled Bell state (|00⟩ + |11⟩)/√2 using Quil syntax.",
      code: `DECLARE ro BIT[2]

H 0
CNOT 0 1

MEASURE 0 ro[0]
MEASURE 1 ro[1]
`,
    },
  ];

  constructor(private readonly parser = new QuilParser()) {}

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
