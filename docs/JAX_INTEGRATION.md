# QStudio JAX Quantum Integration

## Overview
QStudio integrates **JAX** (`jax` + `jaxlib`) via its Python framework bridge (`dist/backend/python/qstudio_bridge.py` and `dist/backend/python/jax_quantum.py`), replacing the legacy TensorFlow Quantum (TFQ) stub.

## Installation
```bash
python3 -m pip install -r requirements.txt
```
This installs `jax`, `numpy`, `scipy`, and the Google Quantum AI ecosystem packages (`cirq`, `qsimcirq`, `openfermion`, `qualtran`).

## Supported Operations
- **Single-qubit gates**: `H`, `X`, `Y`, `Z`, `S`, `T`, `RX`, `RY`, `RZ`
- **Two-qubit gates**: `CX` / `CNOT`, `CZ`, `SWAP`, `ISWAP`
- **Three-qubit gates**: `CCX` / `TOFFOLI`
- **Non-unitary operations**: `MEASURE` / `M`, `RESET`, `BARRIER`

## Execution & Differentiation Modes
1. **Unitary Simulation (`jax:simulate`)**:
   - Uses `jax.jit` with `complex128` precision (`jax_enable_x64=True`).
   - Returns exact `stateVector`, `probabilities`, and `counts` sampled via `jax.random.choice`.
2. **Projective Trajectory Simulation (`jax:simulate` with `RESET` or mid-circuit `MEASURE`)**:
   - Switches to `executionMode: "trajectory"` (`probabilitiesAreEmpirical: true`, up to 4,096 shots).
   - Performs per-shot projective collapse and renormalization via `jax.vmap` + `jax.lax.cond`.
3. **Analytic Gradients (`jax:gradient`)**:
   - Computes $\langle \psi(\theta) | O | \psi(\theta) \rangle$ and $\nabla_\theta \langle \psi(\theta) | O | \psi(\theta) \rangle$ via `jax.jit(jax.value_and_grad(...))`.
   - **Differentiable**: `RX`, `RY`, `RZ` parameters with respect to Pauli expectation values.
   - **Non-differentiable (explicitly rejected)**: `RESET`, mid-circuit `MEASURE`, and discrete shot sampling.
4. **Vectorized Parameter Sweeps (`jax:vmap_sweep`)**:
   - Evaluates a batch of parameter vectors in a single compiled XLA call via `jax.jit(jax.vmap(...))`.

## CPU / GPU Backend Availability
- `jax_quantum.probe_jax()` queries `jax.default_backend()` and `jax.devices()`.
- **CPU** is available out of the box on macOS, Linux, and Windows.
- **GPU (CUDA)** is used automatically if a CUDA-enabled `jaxlib` build and NVIDIA GPU are present; otherwise QStudio falls back to CPU.

## Limitations & Architecture Note
- State-vector simulation is bounded to **1–12 qubits** in the bridge.
- This repository currently distributes pre-compiled `dist/` bundles without upstream `src/`, `renderer/`, `package.json`, or `vite.config.ts` source files; long-term UI development should restore the upstream source tree rather than editing `dist/renderer/assets/index-BMDMhKob.js`.
