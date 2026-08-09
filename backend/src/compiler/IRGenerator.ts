import type { Diagnostic } from "../contracts";
import type { GateNode, IROperation, ProgramNode, QuantumIR, SemanticModel, StatementNode } from "./types";

const opcodes: Record<string, IROperation["opcode"]> = { h: "h", x: "x", y: "y", z: "z", s: "s", t: "t", cnot: "cx", cx: "cx", cz: "cz", swap: "swap", measure: "measure", reset: "reset" };
export class IRGenerator {
  generate(ast: ProgramNode, semantic: SemanticModel): { ir: QuantumIR; diagnostics: Diagnostic[] } {
    const diagnostics: Diagnostic[] = []; let qubits = 0; const operations: IROperation[] = [];
    const visit = (node: StatementNode): void => { if (node.kind === "QubitDeclaration") qubits = Math.max(qubits, node.size); else if (node.kind === "Function") node.body.forEach(visit); else if (node.kind === "Gate") this.operation(node, operations, diagnostics, semantic); };
    ast.body.forEach(visit); return { ir: { qubits, operations }, diagnostics };
  }
  private operation(node: GateNode, operations: IROperation[], diagnostics: Diagnostic[], semantic: SemanticModel): void {
    const baseOpcode = opcodes[node.gate]; const opcode = node.controls.length > 0 && baseOpcode === "x" ? "cx" : node.controls.length > 0 && baseOpcode === "z" ? "cz" : baseOpcode; if (!opcode) { diagnostics.push({ severity: "error", message: `Unsupported gate '${node.gate}'.`, line: node.range.line, column: node.range.column }); return; }
    const targets = node.targets.map((target) => target.index); const controls = node.controls.map((control) => control.index);
    if ((opcode === "cx" || opcode === "cz" || opcode === "swap") && targets.length + controls.length < 2) diagnostics.push({ severity: "error", message: `${node.gate.toUpperCase()} requires two qubits.`, line: node.range.line, column: node.range.column });
    operations.push({ opcode, targets, controls, source: node.range });
  }
}
