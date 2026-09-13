import type { CircuitModel, Diagnostic } from "../../contracts";
import type { CompilationResult, QuantumIR } from "../../compiler/types";
import type { ExampleCode, LanguageCapabilities, QuantumLanguageAdapter } from "../types";
import { QSharpParser } from "./QSharpParser";

export class QSharpLanguageAdapter implements QuantumLanguageAdapter {
  readonly id = "qsharp";
  readonly name = "Microsoft Q#";
  readonly extensions = [".qs"];
  readonly monacoLanguageId = "qsharp";

  readonly capabilities: LanguageCapabilities = {
    gates: ["H", "X", "Y", "Z", "S", "T", "CNOT", "CZ", "SWAP"],
    measurement: true,
    reset: true,
    controlledGates: true,
    multiQubitGates: true,
  };

  readonly examplePrograms: ExampleCode[] = [
    {
      id: "bell-state-qsharp",
      name: "Bell State (Q#)",
      description: "Generates entangled Bell state (|00⟩ + |11⟩)/√2 using Microsoft Q# syntax.",
      code: `namespace QStudio.Examples {
    open Microsoft.Quantum.Intrinsic;

    operation BellState() : Result[] {
        use q = Qubit[2];

        H(q[0]);
        CNOT(q[0], q[1]);

        let results = [M(q[0]), M(q[1])];

        ResetAll(q);
        return results;
    }
}
`,
    },
  ];

  constructor(private readonly parser = new QSharpParser()) {}

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
    let depth = 0;
    return source
      .split("\n")
      .map((line) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("}")) depth = Math.max(0, depth - 1);
        const formatted = `${"    ".repeat(depth)}${trimmed}`;
        if (trimmed.endsWith("{")) depth++;
        return formatted;
      })
      .join("\n");
  }
}
