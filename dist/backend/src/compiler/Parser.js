"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Parser = void 0;
class Parser {
    cursor = 0;
    diagnostics = [];
    parse(tokens) {
        this.cursor = 0;
        this.diagnostics = [];
        const body = [];
        const firstToken = tokens[0] ?? { start: 0, end: 0, line: 1, column: 1 };
        const lastToken = tokens[tokens.length - 1] ?? firstToken;
        while (!this.at(tokens, "eof")) {
            const statement = this.statement(tokens);
            if (statement) {
                body.push(statement);
            }
        }
        return {
            ast: { kind: "Program", body, range: this.range(firstToken, lastToken) },
            diagnostics: this.diagnostics,
        };
    }
    statement(tokens) {
        const current = this.peek(tokens);
        if (current.kind === "eof")
            return undefined;
        if (current.kind === "comment" || current.value === ";") {
            this.next(tokens);
            return undefined;
        }
        if (current.value === "fn")
            return this.functionDeclaration(tokens);
        if (current.value === "let")
            return this.declaration(tokens);
        if (current.value === "return") {
            const start = this.next(tokens);
            this.consumeUntil(tokens, ";");
            return { kind: "Return", range: this.range(start, this.previous(tokens)) };
        }
        if (/^(H|X|Y|Z|S|T|CNOT|CZ|SWAP|Measure|measure|Reset|reset)$/i.test(current.value)) {
            return this.gate(tokens);
        }
        if (current.value === "}") {
            return undefined;
        }
        this.error(current, `Invalid syntax or statement '${current.value}'`);
        this.next(tokens);
        return undefined;
    }
    functionDeclaration(tokens) {
        const start = this.next(tokens);
        const name = this.expect(tokens, "identifier");
        this.consumeUntil(tokens, "{");
        const body = [];
        while (!this.at(tokens, "eof") && !this.at(tokens, "}")) {
            const node = this.statement(tokens);
            if (node)
                body.push(node);
        }
        const end = this.at(tokens, "}") ? this.next(tokens) : this.previous(tokens);
        return { kind: "Function", name: name.value, body, range: this.range(start, end) };
    }
    declaration(tokens) {
        const start = this.next(tokens);
        const name = this.expect(tokens, "identifier");
        this.expectValue(tokens, "=");
        if (this.at(tokens, "new")) {
            this.next(tokens);
            const type = this.expect(tokens, "identifier");
            if (type.value === "Qubit") {
                this.expectValue(tokens, "[");
                const sizeToken = this.expect(tokens, "number");
                const size = Number(sizeToken.value || "0");
                this.consumeUntil(tokens, ";");
                return { kind: "QubitDeclaration", name: name.value, size, range: this.range(start, this.previous(tokens)) };
            }
        }
        this.consumeUntil(tokens, ";");
        return { kind: "Variable", name: name.value, range: this.range(start, this.previous(tokens)) };
    }
    gate(tokens) {
        const start = this.next(tokens);
        const gate = start.value.toLowerCase();
        this.consumeUntil(tokens, "(");
        const targets = [];
        while (!this.at(tokens, "eof") && !this.at(tokens, ")")) {
            if (this.peek(tokens).kind === "identifier") {
                targets.push(this.qubitRef(tokens));
            }
            else {
                this.next(tokens);
            }
        }
        if (this.at(tokens, ")"))
            this.next(tokens);
        const controls = [];
        if (this.at(tokens, ".")) {
            this.next(tokens);
            if (this.at(tokens, "controlled")) {
                this.next(tokens);
                this.consumeUntil(tokens, "(");
                if (this.peek(tokens).kind === "identifier") {
                    controls.push(this.qubitRef(tokens));
                }
                this.consumeUntil(tokens, ")");
                if (this.at(tokens, ")"))
                    this.next(tokens);
            }
        }
        this.consumeUntil(tokens, ";");
        return { kind: "Gate", gate, targets, controls, range: this.range(start, this.previous(tokens)) };
    }
    qubitRef(tokens) {
        const start = this.expect(tokens, "identifier");
        let index = 0;
        if (this.at(tokens, "[")) {
            this.next(tokens);
            const indexToken = this.expect(tokens, "number");
            index = Number(indexToken.value || "0");
            this.expectValue(tokens, "]");
        }
        return { name: start.value, index, range: this.range(start, this.previous(tokens)) };
    }
    consumeUntil(tokens, value) {
        while (!this.at(tokens, "eof") && !this.at(tokens, value)) {
            this.next(tokens);
        }
        if (this.at(tokens, value)) {
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
exports.Parser = Parser;
