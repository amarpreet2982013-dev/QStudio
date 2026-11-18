"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuilParser = void 0;
const CircuitGenerator_1 = require("../../compiler/CircuitGenerator");
const OpenQasmGenerator_1 = require("../../compiler/OpenQasmGenerator");
const QUIL_KEYWORDS = new Set([
    "DECLARE",
    "BIT",
    "OCTET",
    "INTEGER",
    "REAL",
    "COMPLEX",
    "SHARING",
    "OFFSET",
    "H",
    "X",
    "Y",
    "Z",
    "S",
    "T",
    "CNOT",
    "CZ",
    "SWAP",
    "MEASURE",
    "RESET",
    "PRAGMA",
    "NOP",
    "HALT",
    "WAIT",
]);
const GATE_OPCODES = {
    h: "h",
    x: "x",
    y: "y",
    z: "z",
    s: "s",
    t: "t",
    cnot: "cx",
    cx: "cx",
    cz: "cz",
    swap: "swap",
    measure: "measure",
    reset: "reset",
};
class QuilParser {
    cursor = 0;
    diagnostics = [];
    tokenize(source) {
        const tokens = [];
        let position = 0;
        let line = 1;
        let column = 1;
        const push = (kind, value, start, startLine, startColumn) => {
            tokens.push({
                kind,
                value,
                start,
                end: position,
                line: startLine,
                column: startColumn,
            });
        };
        const advance = () => {
            const char = source[position++] ?? "";
            if (char === "\n") {
                line++;
                column = 1;
            }
            else {
                column++;
            }
            return char;
        };
        while (position < source.length) {
            const char = source[position];
            if (char === "\n") {
                const start = position;
                const startLine = line;
                const startColumn = column;
                advance();
                push("symbol", "\n", start, startLine, startColumn);
                continue;
            }
            if (/\s/.test(char)) {
                advance();
                continue;
            }
            const start = position;
            const startLine = line;
            const startColumn = column;
            // Comment: # ...
            if (char === "#") {
                let value = "";
                while (position < source.length && source[position] !== "\n") {
                    value += advance();
                }
                push("comment", value, start, startLine, startColumn);
                continue;
            }
            // Identifiers / Keywords
            if (/[A-Za-z_]/.test(char)) {
                let value = "";
                while (/[A-Za-z0-9_]/.test(source[position] ?? "")) {
                    value += advance();
                }
                push(QUIL_KEYWORDS.has(value) ? "keyword" : "identifier", value, start, startLine, startColumn);
                continue;
            }
            // Numbers
            if (/\d/.test(char)) {
                let value = "";
                while (/\d/.test(source[position] ?? "")) {
                    value += advance();
                }
                if (source[position] === "." && /\d/.test(source[position + 1] ?? "")) {
                    value += advance();
                    while (/\d/.test(source[position] ?? "")) {
                        value += advance();
                    }
                }
                push("number", value, start, startLine, startColumn);
                continue;
            }
            // Strings
            if (char === '"') {
                let value = advance();
                while (position < source.length && source[position] !== '"') {
                    value += advance();
                }
                if (source[position] === '"')
                    value += advance();
                push("string", value, start, startLine, startColumn);
                continue;
            }
            // Symbols
            advance();
            push("symbol", char, start, startLine, startColumn);
        }
        tokens.push({ kind: "eof", value: "", start: position, end: position, line, column });
        return tokens;
    }
    parse(source) {
        const tokens = this.tokenize(source);
        this.cursor = 0;
        this.diagnostics = [];
        const body = [];
        const symbols = new Map();
        const operations = [];
        const classicalOffsets = new Map();
        let maxQubitIndex = -1;
        let totalClassicalBits = 0;
        const firstToken = tokens[0] ?? { start: 0, end: 0, line: 1, column: 1 };
        const lastToken = tokens[tokens.length - 1] ?? firstToken;
        while (!this.at(tokens, "eof")) {
            const current = this.peek(tokens);
            if (current.kind === "comment" || current.value === "\n" || current.value === ";") {
                this.next(tokens);
                continue;
            }
            // DECLARE ro BIT[2] or DECLARE mem REAL[1]
            if (current.value === "DECLARE") {
                const start = this.next(tokens);
                const nameToken = this.expect(tokens, "identifier");
                const typeToken = this.peek(tokens);
                if (typeToken.kind === "keyword" || typeToken.kind === "identifier") {
                    this.next(tokens);
                }
                let size = 1;
                if (this.at(tokens, "[")) {
                    this.next(tokens);
                    const sizeToken = this.expect(tokens, "number");
                    size = Number(sizeToken.value || "1");
                    this.expectValue(tokens, "]");
                }
                this.consumeLine(tokens);
                const nodeRange = this.range(start, this.previous(tokens));
                symbols.set(nameToken.value, { kind: "variable", size, range: nodeRange, references: [] });
                if (typeToken.value.toUpperCase() === "BIT") {
                    classicalOffsets.set(nameToken.value, { offset: totalClassicalBits, size });
                    totalClassicalBits += size;
                }
                body.push({
                    kind: "Variable",
                    name: nameToken.value,
                    range: nodeRange,
                });
                continue;
            }
            // MEASURE 0 ro[0] or MEASURE 0
            if (current.value === "MEASURE") {
                const start = this.next(tokens);
                const qIndexToken = this.expect(tokens, "number");
                const qIndex = Number(qIndexToken.value || "0");
                maxQubitIndex = Math.max(maxQubitIndex, qIndex);
                // Optional classical target ro[0]
                let classicalTarget;
                if (!this.at(tokens, "\n") && !this.at(tokens, "eof") && !this.at(tokens, ";")) {
                    const classicalRegister = this.expect(tokens, "identifier");
                    const register = classicalOffsets.get(classicalRegister.value);
                    let classicalIndex = 0;
                    let explicitIndex = false;
                    if (this.at(tokens, "[")) {
                        explicitIndex = true;
                        this.next(tokens);
                        classicalIndex = Number(this.expect(tokens, "number").value || "0");
                        this.expectValue(tokens, "]");
                    }
                    if (!register || classicalIndex < 0 || classicalIndex >= register.size || (!explicitIndex && register.size !== 1)) {
                        this.error(classicalRegister, `Invalid classical bit reference '${classicalRegister.value}'.`);
                    }
                    else {
                        classicalTarget = register.offset + classicalIndex;
                    }
                }
                this.consumeLine(tokens);
                const nodeRange = this.range(start, this.previous(tokens));
                const qRef = { name: "q", index: qIndex, range: nodeRange };
                body.push({
                    kind: "Gate",
                    gate: "measure",
                    targets: [qRef],
                    controls: [],
                    ...(classicalTarget === undefined ? {} : { classicalTarget }),
                    range: nodeRange,
                });
                operations.push({
                    opcode: "measure",
                    targets: [qIndex],
                    controls: [],
                    ...(classicalTarget === undefined ? {} : { classicalTarget }),
                    source: nodeRange,
                });
                continue;
            }
            // RESET or RESET 0
            if (current.value === "RESET") {
                const start = this.next(tokens);
                let qIndex = 0;
                let targets = [0];
                if (this.peek(tokens).kind === "number") {
                    const numToken = this.next(tokens);
                    qIndex = Number(numToken.value);
                    targets = [qIndex];
                    maxQubitIndex = Math.max(maxQubitIndex, qIndex);
                }
                this.consumeLine(tokens);
                const nodeRange = this.range(start, this.previous(tokens));
                const qRef = { name: "q", index: qIndex, range: nodeRange };
                body.push({
                    kind: "Gate",
                    gate: "reset",
                    targets: [qRef],
                    controls: [],
                    range: nodeRange,
                });
                operations.push({
                    opcode: "reset",
                    targets,
                    controls: [],
                    source: nodeRange,
                });
                continue;
            }
            // PRAGMA / NOP / HALT (Ignored)
            if (current.value === "PRAGMA" || current.value === "NOP" || current.value === "HALT") {
                this.next(tokens);
                this.consumeLine(tokens);
                continue;
            }
            // Gates: H 0, CNOT 0 1, CZ 0 1, SWAP 0 1, X 0, Y 0, Z 0, S 0, T 0
            const gateLower = current.value.toLowerCase();
            if (GATE_OPCODES[gateLower]) {
                const start = this.next(tokens);
                const qubitIndices = [];
                while (!this.at(tokens, "\n") && !this.at(tokens, ";") && !this.at(tokens, "eof")) {
                    if (this.peek(tokens).kind === "number") {
                        const num = Number(this.next(tokens).value);
                        qubitIndices.push(num);
                        maxQubitIndex = Math.max(maxQubitIndex, num);
                    }
                    else {
                        this.next(tokens);
                    }
                }
                this.consumeLine(tokens);
                const nodeRange = this.range(start, this.previous(tokens));
                const opcode = GATE_OPCODES[gateLower];
                let targets = [];
                let controls = [];
                if (opcode === "cx" || opcode === "cz") {
                    if (qubitIndices.length < 2) {
                        this.diagnostics.push({
                            severity: "error",
                            message: `${current.value} requires two qubit indices (e.g. ${current.value} 0 1).`,
                            line: nodeRange.line,
                            column: nodeRange.column,
                            endLine: nodeRange.line,
                            endColumn: nodeRange.column + current.value.length,
                            range: nodeRange,
                        });
                    }
                    controls = qubitIndices.slice(0, 1);
                    targets = qubitIndices.slice(1, 2);
                }
                else if (opcode === "swap") {
                    if (qubitIndices.length < 2) {
                        this.diagnostics.push({
                            severity: "error",
                            message: "SWAP requires two target qubit indices.",
                            line: nodeRange.line,
                            column: nodeRange.column,
                            endLine: nodeRange.line,
                            endColumn: nodeRange.column + current.value.length,
                            range: nodeRange,
                        });
                    }
                    targets = qubitIndices.slice(0, 2);
                }
                else {
                    if (qubitIndices.length < 1) {
                        this.diagnostics.push({
                            severity: "error",
                            message: `${current.value} requires a target qubit index (e.g. ${current.value} 0).`,
                            line: nodeRange.line,
                            column: nodeRange.column,
                            endLine: nodeRange.line,
                            endColumn: nodeRange.column + current.value.length,
                            range: nodeRange,
                        });
                    }
                    targets = qubitIndices.slice(0, 1);
                }
                const gateNode = {
                    kind: "Gate",
                    gate: gateLower,
                    targets: targets.map((idx) => ({ name: "q", index: idx, range: nodeRange })),
                    controls: controls.map((idx) => ({ name: "q", index: idx, range: nodeRange })),
                    range: nodeRange,
                };
                body.push(gateNode);
                if (targets.length > 0 || controls.length > 0) {
                    operations.push({
                        opcode,
                        targets,
                        controls,
                        source: nodeRange,
                    });
                }
                continue;
            }
            this.error(current, `Unexpected Quil instruction or token '${current.value}'`);
            this.next(tokens);
        }
        const totalQubits = Math.max(1, maxQubitIndex + 1);
        if (totalQubits > 12) {
            this.diagnostics.push({
                severity: "error",
                message: `Circuit uses ${totalQubits} qubits. The local state-vector simulator supports 1–12 qubits.`,
                line: 1,
                column: 1,
            });
        }
        // Insert implicit qubit register declaration for AST representation
        const qDecl = {
            kind: "QubitDeclaration",
            name: "q",
            size: totalQubits,
            range: { start: 0, end: 0, line: 1, column: 1 },
        };
        body.unshift(qDecl);
        symbols.set("q", { kind: "qubit", size: totalQubits, range: qDecl.range, references: [] });
        const ast = {
            kind: "Program",
            body,
            range: this.range(firstToken, lastToken),
        };
        const semantic = {
            symbols: symbols,
            diagnostics: this.diagnostics,
        };
        const ir = {
            qubits: totalQubits,
            ...(totalClassicalBits > 0 ? { classicalBits: totalClassicalBits } : {}),
            operations,
        };
        const circuitGen = new CircuitGenerator_1.CircuitGenerator();
        const qasmGen = new OpenQasmGenerator_1.OpenQasmGenerator();
        return {
            tokens,
            ast,
            semantic,
            ir,
            qasm: qasmGen.generate(ir),
            circuit: circuitGen.generate(ir),
            diagnostics: this.diagnostics,
        };
    }
    consumeLine(tokens) {
        while (!this.at(tokens, "eof") && !this.at(tokens, "\n") && !this.at(tokens, ";")) {
            this.next(tokens);
        }
        if (this.at(tokens, "\n") || this.at(tokens, ";")) {
            this.next(tokens);
        }
    }
    expect(tokens, kind) {
        const token = this.peek(tokens);
        if (token.kind !== kind) {
            this.error(token, `Expected ${kind}, received '${token.value || "end of file"}'`);
        }
        else {
            this.next(tokens);
        }
        return token;
    }
    expectValue(tokens, value) {
        const token = this.peek(tokens);
        if (token.value !== value) {
            this.error(token, `Expected '${value}', received '${token.value || "end of file"}'`);
        }
        else {
            this.next(tokens);
        }
    }
    error(token, message) {
        const endColumn = token.column + Math.max(1, token.value.length);
        this.diagnostics.push({
            severity: "error",
            message,
            line: token.line,
            column: token.column,
            endLine: token.line,
            endColumn,
            range: { start: token.start, end: token.end },
        });
    }
    peek(tokens) {
        return tokens[this.cursor] ?? tokens[tokens.length - 1];
    }
    next(tokens) {
        return tokens[this.cursor++] ?? tokens[tokens.length - 1];
    }
    previous(tokens) {
        return tokens[Math.max(0, this.cursor - 1)];
    }
    at(tokens, value) {
        const token = this.peek(tokens);
        return token.kind === value || token.value === value;
    }
    range(start, end) {
        return { start: start.start, end: end.end, line: start.line, column: start.column };
    }
}
exports.QuilParser = QuilParser;
