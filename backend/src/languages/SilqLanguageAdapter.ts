import type { CircuitModel, Diagnostic } from "../contracts";
import type { CompilationResult, QuantumIR } from "../compiler/types";
import { SilqCompiler } from "../compiler/SilqCompiler";
import type { QuantumLanguageAdapter, LanguageCapabilities, ExampleCode } from "./types";

export class SilqLanguageAdapter implements QuantumLanguageAdapter {
  readonly id = "silq";
  readonly name = "Silq (QStudio)";
  readonly extensions = [".silq"];
  readonly monacoLanguageId = "silq";

  readonly capabilities: LanguageCapabilities = {
    gates: ["H", "X", "Y", "Z", "S", "T", "CNOT", "CZ", "SWAP"],
    measurement: true,
    reset: true,
    controlledGates: true,
    multiQubitGates: true,
  };

  readonly examplePrograms: ExampleCode[] = [
    {
      id: "bell-state-silq",
      name: "Bell State (Silq)",
      description: "Generates entangled Bell state (|00⟩ + |11⟩)/√2 using Hadamard and controlled-X in Silq.",
      code: `// A Bell-state program in Silq
fn bell() {
  let q = new Qubit[2];
  H(q[0]);
  X(q[1]).controlled(q[0]);
  return measure(q);
}
`,
    },
  ];

  constructor(private readonly compiler = new SilqCompiler()) {}

  async compile(source: string): Promise<CompilationResult> {
    return this.compiler.analyze(source);
  }

  async diagnostics(source: string): Promise<Diagnostic[]> {
    return this.compiler.diagnostics(source);
  }

  async generateCircuit(source: string): Promise<CircuitModel> {
    return this.compiler.generateCircuit(source);
  }

  async generateIR(source: string): Promise<QuantumIR> {
    const res = await this.compiler.analyze(source);
    return res.ir;
  }

  format(source: string): string {
    let depth = 0;
    return source
      .split("\n")
      .map((line) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("}")) depth = Math.max(0, depth - 1);
        const formatted = `${"  ".repeat(depth)}${trimmed}`;
        if (trimmed.endsWith("{")) depth++;
        return formatted;
      })
      .join("\n");
  }
}
