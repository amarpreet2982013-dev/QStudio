import type { Diagnostic } from "../contracts";
import type { ProgramNode, Range, SemanticModel, StatementNode } from "./types";

export class SemanticAnalyzer {
  analyze(ast: ProgramNode): SemanticModel {
    const symbols = new Map<string, { kind: "function" | "qubit" | "variable"; size?: number; range: Range; references: Range[] }>();
    const diagnostics: Diagnostic[] = [];

    const visit = (node: StatementNode): void => {
      if (node.kind === "Function") {
        this.define(symbols, diagnostics, node.name, "function", node.range);
        node.body.forEach(visit);
        return;
      }
      if (node.kind === "QubitDeclaration") {
        if (node.size < 1 || node.size > 12) {
          diagnostics.push({
            severity: "error",
            message: "The local state-vector simulator supports 1–12 qubits.",
            line: node.range.line,
            column: node.range.column,
            endLine: node.range.line,
            endColumn: node.range.column + node.name.length,
            range: node.range,
          });
        }
        this.define(symbols, diagnostics, node.name, "qubit", node.range, node.size);
        return;
      }
      if (node.kind === "Variable") {
        this.define(symbols, diagnostics, node.name, "variable", node.range);
        return;
      }
      if (node.kind === "Gate") {
        const refs = [...node.targets, ...node.controls];
        for (const reference of refs) {
          const symbol = symbols.get(reference.name);
          if (!symbol) {
            diagnostics.push({
              severity: "error",
              message: `Unknown quantum register '${reference.name}'.`,
              line: reference.range.line,
              column: reference.range.column,
              endLine: reference.range.line,
              endColumn: reference.range.column + reference.name.length,
              range: reference.range,
            });
          } else if (symbol.kind !== "qubit") {
            diagnostics.push({
              severity: "error",
              message: `'${reference.name}' is not a quantum register.`,
              line: reference.range.line,
              column: reference.range.column,
              endLine: reference.range.line,
              endColumn: reference.range.column + reference.name.length,
              range: reference.range,
            });
          } else {
            symbol.references.push(reference.range);
            if (symbol.size !== undefined && (reference.index < 0 || reference.index >= symbol.size)) {
              diagnostics.push({
                severity: "error",
                message: `Invalid qubit index ${reference.index} for register '${reference.name}' (size ${symbol.size}).`,
                line: reference.range.line,
                column: reference.range.column,
                endLine: reference.range.line,
                endColumn: reference.range.column + reference.name.length + 3,
                range: reference.range,
              });
            }
          }
        }
      }
    };

    ast.body.forEach(visit);
    return { symbols, diagnostics };
  }

  private define(
    symbols: SemanticModel["symbols"],
    diagnostics: Diagnostic[],
    name: string,
    kind: "function" | "qubit" | "variable",
    range: Range,
    size?: number
  ): void {
    if (symbols.has(name)) {
      diagnostics.push({
        severity: "error",
        message: `Duplicate declaration '${name}'.`,
        line: range.line,
        column: range.column,
        endLine: range.line,
        endColumn: range.column + name.length,
        range,
      });
    } else {
      symbols.set(name, { kind, size, range, references: [] });
    }
  }
}
