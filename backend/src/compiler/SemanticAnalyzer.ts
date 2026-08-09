import type { Diagnostic } from "../contracts";
import type { ProgramNode, Range, SemanticModel, StatementNode } from "./types";

export class SemanticAnalyzer {
  analyze(ast: ProgramNode): SemanticModel {
    const symbols = new Map<string, { kind: "function" | "qubit" | "variable"; range: Range; references: Range[] }>(); const diagnostics: Diagnostic[] = [];
    const visit = (node: StatementNode): void => {
      if (node.kind === "Function") { this.define(symbols, diagnostics, node.name, "function", node.range); node.body.forEach(visit); return; }
      if (node.kind === "QubitDeclaration") { if (node.size < 1 || node.size > 12) diagnostics.push({ severity: "error", message: "The local state-vector simulator supports 1–12 qubits.", line: node.range.line, column: node.range.column }); this.define(symbols, diagnostics, node.name, "qubit", node.range); return; }
      if (node.kind === "Variable") { this.define(symbols, diagnostics, node.name, "variable", node.range); return; }
      if (node.kind === "Gate") node.targets.concat(node.controls).forEach((reference) => { const symbol = symbols.get(reference.name); if (!symbol) diagnostics.push({ severity: "error", message: `Unknown quantum register '${reference.name}'.`, line: reference.range.line, column: reference.range.column }); else if (symbol.kind !== "qubit") diagnostics.push({ severity: "error", message: `'${reference.name}' is not a quantum register.`, line: reference.range.line, column: reference.range.column }); else symbol.references.push(reference.range); });
    };
    ast.body.forEach(visit); return { symbols, diagnostics };
  }
  private define(symbols: SemanticModel["symbols"], diagnostics: Diagnostic[], name: string, kind: "function" | "qubit" | "variable", range: Range): void { if (symbols.has(name)) diagnostics.push({ severity: "error", message: `Duplicate declaration '${name}'.`, line: range.line, column: range.column }); else symbols.set(name, { kind, range, references: [] }); }
}
