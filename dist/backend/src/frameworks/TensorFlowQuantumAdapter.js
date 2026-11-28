"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tfqAdapter = exports.TensorFlowQuantumAdapter = void 0;
const QuantumFrameworkBridge_1 = require("./QuantumFrameworkBridge");
class TensorFlowQuantumAdapter {
    bridge;
    constructor(bridge = QuantumFrameworkBridge_1.defaultFrameworkBridge) {
        this.bridge = bridge;
    }
    async probe() {
        return this.bridge.probeTfq();
    }
    getDocumentation() {
        return {
            title: "Google TensorFlow Quantum (TFQ) [Legacy — Replaced by JAX Quantum]",
            summary: "TensorFlow Quantum is a legacy library for hybrid quantum-classical machine learning that requires Python <= 3.10 and TensorFlow 2.x. QStudio now recommends JAX Quantum (JaxQuantumAdapter) for differentiable QML, jax.jit, and jax.vmap.",
            workflowArchitecture: [
                "1. Classical Input Pipeline: Prepare classical or quantum batch datasets via tf.data.",
                "2. Parameterized Quantum Circuit (PQC): Build parameterized Cirq ansatz with sympy.Symbol parameters.",
                "3. Quantum Layer: tfq.layers.PQC executes quantum circuits on CPU/GPU/QPU simulators and extracts expectation values <psi|O|psi>.",
                "4. Hybrid Optimization: Automatic differentiation via Parameter Shift Rule or adjoint gradients propagates loss through classical layers (Keras/Adam).",
            ],
            sampleSnippet: `import cirq
import sympy
import tensorflow as tf
# import tensorflow_quantum as tfq (requires Python <= 3.10)

# 1. Parameterized Cirq circuit
q = cirq.GridQubit(0, 0)
theta = sympy.Symbol('theta')
circuit = cirq.Circuit(cirq.rx(theta)(q))

# 2. Measurement Operator
readout = cirq.Z(q)

# 3. Hybrid Keras Model Architecture
# model = tf.keras.Sequential([
#     tf.keras.layers.Input(shape=(), dtype=tf.string),
#     tfq.layers.PQC(circuit, readout),
#     tf.keras.layers.Dense(2, activation='softmax')
# ])
`,
            docsUrl: "https://www.tensorflow.org/quantum",
        };
    }
}
exports.TensorFlowQuantumAdapter = TensorFlowQuantumAdapter;
exports.tfqAdapter = new TensorFlowQuantumAdapter();
