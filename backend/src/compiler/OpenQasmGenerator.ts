import type { QuantumIR } from "./types";

export class OpenQasmGenerator {
  generate(ir: QuantumIR): string { const lines = ["OPENQASM 3.0;", `qubit[${ir.qubits}] q;`, `bit[${ir.qubits}] c;`]; for (const operation of ir.operations) lines.push(this.emit(operation)); return lines.join("\n"); }
  private emit(operation: QuantumIR["operations"][number]): string { const q = (index: number) => `q[${index}]`; if (operation.opcode === "measure") return `${operation.targets.map((target) => `c[${target}] = measure ${q(target)};`).join(" ")}`; if (operation.opcode === "reset") return `reset ${operation.targets.map(q).join(", ")};`; if (operation.opcode === "cx" || operation.opcode === "cz") { const pair = [...operation.controls, ...operation.targets].slice(0, 2); return `${operation.opcode} ${pair.map(q).join(", ")};`; } return `${operation.opcode} ${operation.targets.map(q).join(", ")};`; }
}
