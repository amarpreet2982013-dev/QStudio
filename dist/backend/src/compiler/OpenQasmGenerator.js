"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenQasmGenerator = void 0;
class OpenQasmGenerator {
    generate(ir) {
        const lines = ["OPENQASM 3.0;", `qubit[${ir.qubits}] q;`];
        if (ir.classicalBits !== undefined)
            lines.push(`bit[${ir.classicalBits}] c;`);
        for (const operation of ir.operations)
            lines.push(this.emit(operation));
        return lines.join("\n");
    }
    emit(operation) {
        const q = (index) => `q[${index}]`;
        let statement;
        if (operation.opcode === "measure") {
            const target = operation.targets[0];
            statement = operation.classicalTarget === undefined
                ? `measure ${q(target)};`
                : `c[${operation.classicalTarget}] = measure ${q(target)};`;
        }
        else if (operation.opcode === "reset") {
            statement = `reset ${operation.targets.map(q).join(", ")};`;
        }
        else if (operation.opcode === "cx" || operation.opcode === "cz") {
            const pair = [...operation.controls, ...operation.targets].slice(0, 2);
            statement = `${operation.opcode} ${pair.map(q).join(", ")};`;
        }
        else {
            statement = `${operation.opcode} ${operation.targets.map(q).join(", ")};`;
        }
        if (!operation.condition)
            return statement;
        const condition = operation.condition.bits
            .map((bit, index) => `c[${bit}] == ${operation.condition.equals[index]}`)
            .join(" && ");
        return `if (${condition}) { ${statement} }`;
    }
}
exports.OpenQasmGenerator = OpenQasmGenerator;
