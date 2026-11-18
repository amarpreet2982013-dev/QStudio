"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenQasm3LanguageAdapter = void 0;
const OpenQasm3Parser_1 = require("./OpenQasm3Parser");
class OpenQasm3LanguageAdapter {
    parser;
    id = "openqasm3";
    name = "OpenQASM 3.0";
    extensions = [".qasm", ".qasm3"];
    monacoLanguageId = "openqasm3";
    capabilities = {
        gates: ["h", "x", "y", "z", "s", "t", "cx", "cnot", "cz", "swap"],
        measurement: true,
        reset: true,
        controlledGates: true,
        multiQubitGates: true,
    };
    examplePrograms = [
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
    constructor(parser = new OpenQasm3Parser_1.OpenQasm3Parser()) {
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
exports.OpenQasm3LanguageAdapter = OpenQasm3LanguageAdapter;
