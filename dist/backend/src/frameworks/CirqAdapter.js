"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cirqAdapter = exports.CirqAdapter = exports.CIRQ_EXAMPLES = void 0;
const QuantumFrameworkBridge_1 = require("./QuantumFrameworkBridge");
const types_1 = require("./types");
exports.CIRQ_EXAMPLES = [
    {
        id: "cirq-bell",
        name: "Cirq: Bell State",
        description: "Generates maximally entangled Einstein-Podolsky-Rosen pair |Φ+⟩ = (|00⟩ + |11⟩)/√2",
        code: `import cirq

# Initialize 2 qubits
qubits = cirq.LineQubit.range(2)
circuit = cirq.Circuit()

# Create Bell state |Φ+⟩
circuit.append(cirq.H(qubits[0]))
circuit.append(cirq.CNOT(qubits[0], qubits[1]))
circuit.append(cirq.measure(qubits[0]))
circuit.append(cirq.measure(qubits[1]))
`,
    },
    {
        id: "cirq-ghz",
        name: "Cirq: 3-Qubit GHZ State",
        description: "Generates Greenberger-Horne-Zeilinger state (|000⟩ + |111⟩)/√2",
        code: `import cirq

# Initialize 3 qubits
qubits = cirq.LineQubit.range(3)
circuit = cirq.Circuit()

# Prepare GHZ State
circuit.append(cirq.H(qubits[0]))
circuit.append(cirq.CNOT(qubits[0], qubits[1]))
circuit.append(cirq.CNOT(qubits[1], qubits[2]))
circuit.append(cirq.measure(qubits[0]))
circuit.append(cirq.measure(qubits[1]))
circuit.append(cirq.measure(qubits[2]))
`,
    },
    {
        id: "cirq-quantum-teleportation",
        name: "Cirq: Quantum Teleportation",
        description: "Shows the Bell-measurement stage only; classical feed-forward corrections are omitted and unsupported by QStudio's circuit model.",
        code: `import cirq

# Line qubits: 0: Message, 1: Alice, 2: Bob
qubits = cirq.LineQubit.range(3)
circuit = cirq.Circuit()

# 1. State preparation on qubit 0 (Message)
circuit.append(cirq.H(qubits[0]))

# 2. Entangled Bell pair between Alice (1) and Bob (2)
circuit.append(cirq.H(qubits[1]))
circuit.append(cirq.CNOT(qubits[1], qubits[2]))

# 3. Bell measurement by Alice
circuit.append(cirq.CNOT(qubits[0], qubits[1]))
circuit.append(cirq.H(qubits[0]))
circuit.append(cirq.measure(qubits[0]))
circuit.append(cirq.measure(qubits[1]))
`,
    },
];
class CirqAdapter {
    bridge;
    id = "cirq";
    name = "Google Cirq";
    extensions = [".cirq.py", ".cirq"];
    monacoLanguageId = "python";
    capabilities = {
        gates: ["H", "X", "Y", "Z", "S", "T", "CX", "CZ", "SWAP", "ISWAP", "RX", "RY", "RZ"],
        measurement: true,
        reset: true,
        controlledGates: true,
        multiQubitGates: true,
    };
    examplePrograms = exports.CIRQ_EXAMPLES;
    constructor(bridge = QuantumFrameworkBridge_1.defaultFrameworkBridge) {
        this.bridge = bridge;
    }
    getCompatibilityMatrix() {
        return types_1.CIRQ_COMPATIBILITY_MATRIX;
    }
    async compile(source) {
        const diagnostics = await this.diagnostics(source);
        const importRes = await this.importCircuit(source);
        return {
            tokens: [],
            ast: {
                kind: "Program",
                body: [],
                range: { start: 0, end: source.length, line: 1, column: 1 },
            },
            semantic: { symbols: new Map(), diagnostics },
            ir: importRes.ir,
            qasm: "",
            circuit: importRes.circuit,
            diagnostics,
        };
    }
    async diagnostics(source) {
        const diags = [];
        const lines = source.split("\n");
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.includes("cirq.DensityMatrixSimulator") || line.includes("cirq.NoiseModel")) {
                diags.push({
                    severity: "warning",
                    message: "Noisy density matrix channels are converted to pure state approximation in state-vector view.",
                    line: i + 1,
                    column: 1,
                });
            }
        }
        return diags;
    }
    async generateCircuit(source) {
        const res = await this.importCircuit(source);
        return res.circuit;
    }
    async generateIR(source) {
        const res = await this.importCircuit(source);
        return res.ir;
    }
    async exportCircuit(circuit) {
        return this.bridge.exportCirq(circuit);
    }
    async importCircuit(code) {
        return this.bridge.importCirq(code);
    }
    async simulate(circuit, shots = 1024, seed) {
        return this.bridge.simulateCirq(circuit, shots, seed);
    }
}
exports.CirqAdapter = CirqAdapter;
exports.cirqAdapter = new CirqAdapter();
