import type { CircuitModel } from "../contracts";
import type { QuantumIR } from "./types";
export class CircuitGenerator { generate(ir: QuantumIR): CircuitModel { return { name: "Compiled circuit", qubits: ir.qubits, operations: ir.operations.map((operation, moment) => ({ gate: operation.opcode.toUpperCase(), targets: [...operation.controls, ...operation.targets], moment })) }; } }
