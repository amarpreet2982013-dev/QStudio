"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Lexer = void 0;
const keywords = new Set(["fn", "let", "new", "return", "measure", "reset"]);
class Lexer {
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
        const advance = () => { const char = source[position++] ?? ""; if (char === "\n") {
            line++;
            column = 1;
        }
        else
            column++; return char; };
        while (position < source.length) {
            const char = source[position];
            if (/\s/.test(char)) {
                advance();
                continue;
            }
            const start = position, startLine = line, startColumn = column;
            if (char === "/" && source[position + 1] === "/") {
                let value = "";
                while (position < source.length && source[position] !== "\n")
                    value += advance();
                push("comment", value, start, startLine, startColumn);
                continue;
            }
            if (/[A-Za-z_]/.test(char)) {
                let value = "";
                while (/[A-Za-z0-9_]/.test(source[position] ?? ""))
                    value += advance();
                push(keywords.has(value) ? "keyword" : "identifier", value, start, startLine, startColumn);
                continue;
            }
            if (/\d/.test(char)) {
                let value = "";
                while (/\d/.test(source[position] ?? ""))
                    value += advance();
                push("number", value, start, startLine, startColumn);
                continue;
            }
            if (char === '"') {
                let value = advance();
                while (position < source.length && source[position] !== '"')
                    value += advance();
                if (source[position] === '"')
                    value += advance();
                push("string", value, start, startLine, startColumn);
                continue;
            }
            advance();
            push("symbol", char, start, startLine, startColumn);
        }
        tokens.push({ kind: "eof", value: "", start: position, end: position, line, column });
        return tokens;
    }
}
exports.Lexer = Lexer;
