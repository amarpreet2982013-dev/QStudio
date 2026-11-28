"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jaxAdapter = exports.JaxQuantumAdapter = void 0;
const QuantumFrameworkBridge_1 = require("./QuantumFrameworkBridge");
class JaxQuantumAdapter {
    bridge;
    constructor(bridge = QuantumFrameworkBridge_1.defaultFrameworkBridge) {
        this.bridge = bridge;
    }
    async probe() {
        return this.bridge.probeJax();
    }
    async simulate(circuit, shots = 1024, seed) {
        return this.bridge.simulateJax(circuit, shots, seed);
    }
    async gradient(circuit, params, observable) {
        return this.bridge.gradientJax(circuit, params, observable);
    }
    async vmapSweep(circuit, paramBatch, observable) {
        return this.bridge.vmapSweepJax(circuit, paramBatch, observable);
    }
    getDocumentation() {
        return {
            title: "JAX Quantum (Differentiable QML & VQE)",
            summary: "JAX provides JIT-compiled, hardware-accelerated (CPU/GPU/TPU) automatic differentiation and vectorized parameter sweeps for hybrid quantum-classical workflows.",
            workflowArchitecture: [
                "1. Pure-Functional State Evolution: Represent parameterized quantum circuits as pure functions mapping parameters θ -> |ψ(θ)⟩ in jax.numpy.",
                "2. XLA Compilation (jax.jit): Compile unitary tensor contractions into fused XLA kernels for low-latency execution.",
                "3. Exact Analytic Gradients (jax.value_and_grad): Compute exact gradients ∇θ ⟨ψ(θ)|H|ψ(θ)⟩ via reverse-mode autodiff in a single backward pass.",
                "4. Vectorized Sweeps (jax.vmap): Evaluate batches of circuit parameters simultaneously across CPU/GPU/TPU.",
            ],
            sampleSnippet: `import jax
import jax.numpy as jnp

jax.config.update("jax_enable_x64", True)

def rx(theta):
    c, s = jnp.cos(theta / 2.0), -1.0j * jnp.sin(theta / 2.0)
    return jnp.array([[c, s], [s, c]], dtype=jnp.complex128)

@jax.jit
def expectation_z(theta):
    psi0 = jnp.array([1.0, 0.0], dtype=jnp.complex128)
    psi = rx(theta) @ psi0
    z_op = jnp.array([[1.0, 0.0], [0.0, -1.0]], dtype=jnp.complex128)
    return jnp.real(jnp.vdot(psi, z_op @ psi))

val, grad = jax.value_and_grad(expectation_z)(jnp.pi / 3.0)
print(f"<Z> = {val:.6f}, d<Z>/dtheta = {grad:.6f}")
`,
            docsUrl: "https://jax.readthedocs.io",
        };
    }
}
exports.JaxQuantumAdapter = JaxQuantumAdapter;
exports.jaxAdapter = new JaxQuantumAdapter();
