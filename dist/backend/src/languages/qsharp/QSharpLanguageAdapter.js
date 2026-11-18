"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QSharpLanguageAdapter = void 0;
const QSharpParser_1 = require("./QSharpParser");
class QSharpLanguageAdapter {
    parser;
    id = "qsharp";
    name = "Microsoft Q#";
    extensions = [".qs"];
    monacoLanguageId = "qsharp";
    capabilities = {
        gates: ["H", "X", "Y", "Z", "S", "T", "CNOT", "CZ", "SWAP"],
        measurement: true,
        reset: true,
        controlledGates: true,
        multiQubitGates: true,
    };
    examplePrograms = [
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
    constructor(parser = new QSharpParser_1.QSharpParser()) {
        this.parser = parser;
    }
    async compile(source) {
        return this.parser.parse(source);
    }
    async diagnostics(source) {
        const result = this.parser.parse(source);
        return result.diagnostics;
    }
    async generateCircuit(source) {
        const result = this.parser.parse(source);
        return result.circuit;
    }
    async generateIR(source) {
        const result = this.parser.parse(source);
        return result.ir;
    }
    format(source) {
        let depth = 0;
        return source
            .split("\n")
            .map((line) => {
            const trimmed = line.trim();
            if (trimmed.startsWith("}"))
                depth = Math.max(0, depth - 1);
            const formatted = `${"    ".repeat(depth)}${trimmed}`;
            if (trimmed.endsWith("{"))
                depth++;
            return formatted;
        })
            .join("\n");
    }
}
exports.QSharpLanguageAdapter = QSharpLanguageAdapter;
