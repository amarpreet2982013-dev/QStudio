"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SilqLanguageAdapter = void 0;
const SilqCompiler_1 = require("../compiler/SilqCompiler");
class SilqLanguageAdapter {
    compiler;
    id = "silq";
    name = "Silq (QStudio)";
    extensions = [".silq"];
    monacoLanguageId = "silq";
    capabilities = {
        gates: ["H", "X", "Y", "Z", "S", "T", "CNOT", "CZ", "SWAP"],
        measurement: true,
        reset: true,
        controlledGates: true,
        multiQubitGates: true,
    };
    examplePrograms = [
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
    constructor(compiler = new SilqCompiler_1.SilqCompiler()) {
        this.compiler = compiler;
    }
    async compile(source) {
        return this.compiler.analyze(source);
    }
    async diagnostics(source) {
        return this.compiler.diagnostics(source);
    }
    async generateCircuit(source) {
        return this.compiler.generateCircuit(source);
    }
    async generateIR(source) {
        const res = await this.compiler.analyze(source);
        return res.ir;
    }
    format(source) {
        let depth = 0;
        return source
            .split("\n")
            .map((line) => {
            const trimmed = line.trim();
            if (trimmed.startsWith("}"))
                depth = Math.max(0, depth - 1);
            const formatted = `${"  ".repeat(depth)}${trimmed}`;
            if (trimmed.endsWith("{"))
                depth++;
            return formatted;
        })
            .join("\n");
    }
}
exports.SilqLanguageAdapter = SilqLanguageAdapter;
