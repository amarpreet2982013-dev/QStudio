import type { Diagnostic } from "../contracts";
import type { FunctionNode, GateNode, ProgramNode, QubitDeclarationNode, QubitRef, Range, StatementNode, Token, VariableNode } from "./types";

export class Parser {
  private cursor = 0;
  private diagnostics: Diagnostic[] = [];

  parse(tokens: Token[]): { ast: ProgramNode; diagnostics: Diagnostic[] } {
    this.cursor = 0;
    this.diagnostics = [];
    const body: StatementNode[] = [];
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

  private statement(tokens: Token[]): StatementNode | undefined {
    const current = this.peek(tokens);
    if (current.kind === "eof") return undefined;
    if (current.kind === "comment" || current.value === ";") {
      this.next(tokens);
      return undefined;
    }
    if (current.value === "fn") return this.functionDeclaration(tokens);
    if (current.value === "let") return this.declaration(tokens);
    if (current.value === "return") {
      const start = this.next(tokens);
      this.consumeUntil(tokens, ";");
      return { kind: "Return", range: this.range(start, this.previous(tokens)) };
    }
    if (/^(H|X|Y|Z|S|T|CNOT|CZ|SWAP|Measure|measure|Reset|reset)$/i.test(current.value)) {
      return this.gate(tokens);
    }
    if (current.value === "}") {
      this.error(current, "Unexpected closing brace.");
      this.next(tokens);
      return undefined;
    }

    this.error(current, `Invalid syntax or statement '${current.value}'`);
    this.next(tokens);
    return undefined;
  }

  private functionDeclaration(tokens: Token[]): FunctionNode {
    const start = this.next(tokens);
    const name = this.expect(tokens, "identifier");
    this.consumeUntil(tokens, "{");
    const body: StatementNode[] = [];
    while (!this.at(tokens, "eof") && !this.at(tokens, "}")) {
      const node = this.statement(tokens);
      if (node) body.push(node);
    }
    const end = this.at(tokens, "}") ? this.next(tokens) : this.previous(tokens);
    return { kind: "Function", name: name.value, body, range: this.range(start, end) };
  }

  private declaration(tokens: Token[]): QubitDeclarationNode | VariableNode {
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

  private gate(tokens: Token[]): GateNode {
    const start = this.next(tokens);
    const gate = start.value.toLowerCase();
    this.consumeUntil(tokens, "(");
    const targets: QubitRef[] = [];
    while (!this.at(tokens, "eof") && !this.at(tokens, ")")) {
      if (this.peek(tokens).kind === "identifier") {
        targets.push(this.qubitRef(tokens));
      } else {
        this.next(tokens);
      }
    }
    if (this.at(tokens, ")")) this.next(tokens);

    const controls: QubitRef[] = [];
    if (this.at(tokens, ".")) {
      this.next(tokens);
      if (this.at(tokens, "controlled")) {
        this.next(tokens);
        this.consumeUntil(tokens, "(");
        if (this.peek(tokens).kind === "identifier") {
          controls.push(this.qubitRef(tokens));
        }
        this.consumeUntil(tokens, ")");
        if (this.at(tokens, ")")) this.next(tokens);
      }
    }
    this.consumeUntil(tokens, ";");
    return { kind: "Gate", gate, targets, controls, range: this.range(start, this.previous(tokens)) };
  }

  private qubitRef(tokens: Token[]): QubitRef {
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

  private consumeUntil(tokens: Token[], value: string): void {
    while (!this.at(tokens, "eof") && !this.at(tokens, value)) {
      this.next(tokens);
    }
    if (this.at(tokens, value)) {
      this.next(tokens);
    }
  }

  private expect(tokens: Token[], kind: Token["kind"]): Token {
    const token = this.peek(tokens);
    if (token.kind !== kind) {
      this.error(token, `Expected ${kind}, received '${token.value || "end of file"}'`);
    } else {
      this.next(tokens);
    }
    return token;
  }

  private expectValue(tokens: Token[], value: string): void {
    const token = this.peek(tokens);
    if (token.value !== value) {
      this.error(token, `Expected '${value}', received '${token.value || "end of file"}'`);
    } else {
      this.next(tokens);
    }
  }

  private error(token: Token, message: string): void {
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

  private peek(tokens: Token[]): Token {
    return tokens[this.cursor] ?? tokens[tokens.length - 1];
  }

  private next(tokens: Token[]): Token {
    return tokens[this.cursor++] ?? tokens[tokens.length - 1];
  }

  private previous(tokens: Token[]): Token {
    return tokens[Math.max(0, this.cursor - 1)];
  }

  private at(tokens: Token[], value: string): boolean {
    const token = this.peek(tokens);
    return token.kind === value || token.value === value;
  }

  private range(start: Token, end: Token): Range {
    return { start: start.start, end: end.end, line: start.line, column: start.column };
  }
}
