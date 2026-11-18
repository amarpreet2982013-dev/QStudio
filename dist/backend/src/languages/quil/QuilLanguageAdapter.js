"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuilLanguageAdapter = void 0;
const QuilParser_1 = require("./QuilParser");
class QuilLanguageAdapter {
    parser;
    id = "quil";
    name = "Quil";
    extensions = [".quil"];
    monacoLanguageId = "quil";
    capabilities = {
        gates: ["H", "X", "Y", "Z", "S", "T", "CNOT", "CZ", "SWAP"],
        measurement: true,
        reset: true,
        controlledGates: true,
        multiQubitGates: true,
    };
    examplePrograms = [
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
    constructor(parser = new QuilParser_1.QuilParser()) {
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
        return source
            .split("\n")
            .map((line) => line.trim())
            .join("\n");
    }
}
exports.QuilLanguageAdapter = QuilLanguageAdapter;
