"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircuitGenerator = void 0;
exports.circuitModelToIR = circuitModelToIR;
class CircuitGenerator {
    generate(ir) {
        return {
            name: "Compiled circuit",
            qubits: ir.qubits,
            ...(ir.classicalBits === undefined ? {} : { classicalBits: ir.classicalBits }),
            operations: ir.operations.map((operation, moment) => ({
                gate: operation.opcode.toUpperCase(),
                targets: [...operation.controls, ...operation.targets],
                moment,
                ...(operation.classicalTarget === undefined ? {} : { classicalTarget: operation.classicalTarget }),
                ...(operation.condition === undefined ? {} : { condition: operation.condition }),
            })),
        };
    }
}
exports.CircuitGenerator = CircuitGenerator;
const CIRCUIT_GATE_OPCODES = {
    H: "h",
    X: "x",
    Y: "y",
    Z: "z",
    S: "s",
    T: "t",
    CX: "cx",
    CNOT: "cx",
    CZ: "cz",
    SWAP: "swap",
    MEASURE: "measure",
    M: "measure",
    RESET: "reset",
};
function circuitModelToIR(circuit) {
    return {
        qubits: circuit.qubits,
        ...(circuit.classicalBits === undefined ? {} : { classicalBits: circuit.classicalBits }),
        operations: circuit.operations.map((operation, index) => {
            const opcode = CIRCUIT_GATE_OPCODES[operation.gate.toUpperCase()];
            if (!opcode)
                throw new Error(`Unsupported native simulator gate '${operation.gate}'.`);
            return {
                opcode,
                targets: operation.targets,
                controls: [],
                source: { start: 0, end: 0, line: 1, column: index + 1 },
                ...(operation.classicalTarget === undefined ? {} : { classicalTarget: operation.classicalTarget }),
                ...(operation.condition === undefined ? {} : { condition: operation.condition }),
            };
        }),
    };
}
