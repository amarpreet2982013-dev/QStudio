"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenQasm2LanguageAdapter = void 0;
const OpenQasm2Parser_1 = require("./OpenQasm2Parser");
class OpenQasm2LanguageAdapter {
    parser;
    id = "openqasm2";
    name = "OpenQASM 2.0";
    extensions = [".qasm", ".qasm2"];
    monacoLanguageId = "openqasm2";
    capabilities = {
        gates: ["h", "x", "y", "z", "s", "t", "cx", "cz", "swap"],
        measurement: true,
        reset: true,
        controlledGates: true,
        multiQubitGates: true,
    };
    examplePrograms = [
        {
            id: "bell-state-openqasm2",
            name: "Bell State (OpenQASM 2.0)",
            description: "Generates entangled Bell state (|00⟩ + |11⟩)/√2 using OpenQASM 2.0 syntax.",
            code: `OPENQASM 2.0;
include "qelib1.inc";

qreg q[2];
creg c[2];

h q[0];
cx q[0],q[1];

measure q[0] -> c[0];
measure q[1] -> c[1];
`,
        },
    ];
    constructor(parser = new OpenQasm2Parser_1.OpenQasm2Parser()) {
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
exports.OpenQasm2LanguageAdapter = OpenQasm2LanguageAdapter;
