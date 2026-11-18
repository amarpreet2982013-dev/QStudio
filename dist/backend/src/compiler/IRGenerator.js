"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IRGenerator = void 0;
const opcodes = { h: "h", x: "x", y: "y", z: "z", s: "s", t: "t", cnot: "cx", cx: "cx", cz: "cz", swap: "swap", measure: "measure", reset: "reset" };
class IRGenerator {
    generate(ast, _semantic) {
        const diagnostics = [];
        let qubits = 0;
        const operations = [];
        const visit = (node) => { if (node.kind === "QubitDeclaration")
            qubits = Math.max(qubits, node.size);
        else if (node.kind === "Function")
            node.body.forEach(visit);
        else if (node.kind === "Gate")
            this.operation(node, operations, diagnostics); };
        ast.body.forEach(visit);
        return { ir: { qubits, operations }, diagnostics };
    }
    operation(node, operations, diagnostics) {
        const baseOpcode = opcodes[node.gate];
        const opcode = node.controls.length > 0 && baseOpcode === "x" ? "cx" : node.controls.length > 0 && baseOpcode === "z" ? "cz" : baseOpcode;
        if (!opcode) {
            diagnostics.push({ severity: "error", message: `Unsupported gate '${node.gate}'.`, line: node.range.line, column: node.range.column, endLine: node.range.line, endColumn: node.range.column + node.gate.length, range: node.range });
            return;
        }
        const targets = node.targets.map((target) => target.index);
        const controls = node.controls.map((control) => control.index);
        if ((opcode === "cx" || opcode === "cz" || opcode === "swap") && targets.length + controls.length < 2)
            diagnostics.push({ severity: "error", message: `${node.gate.toUpperCase()} requires two qubits.`, line: node.range.line, column: node.range.column, endLine: node.range.line, endColumn: node.range.column + node.gate.length, range: node.range });
        operations.push({ opcode, targets, controls, source: node.range });
    }
}
exports.IRGenerator = IRGenerator;
