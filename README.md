# QStudio — Quantum Programming IDE

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Electron%20%7C%20Web-blueviolet.svg)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
<<<<<<< HEAD

**QStudio** is an interactive desktop and web-based Integrated Development Environment (IDE) designed for quantum computing algorithms, circuit synthesis, simulation, and step-by-step debugging.

Built with **React**, **TypeScript**, and **Electron**, QStudio provides a unified quantum intermediate representation (IR) supporting multiple quantum programming languages with real-time circuit visualization, state-vector simulation, and Monaco Editor integration.
=======
[![JAX](https://img.shields.io/badge/JAX-Quantum%20Engine-brightgreen.svg)](https://jax.readthedocs.io/)

**QStudio** is an interactive desktop and web-based Integrated Development Environment (IDE) designed for quantum computing algorithms, circuit synthesis, simulation, differentiable quantum machine learning (QML), and step-by-step debugging.

### Technology Stack
- **Frontend & UI Layer**: **React 18**, **TypeScript 5**, and **Monaco Editor**, packaged with **Electron** for cross-platform desktop execution and responsive web previews.
- **Quantum Numerical Computing & Autodiff Engine**: **JAX** and **jaxlib** (`jax.jit`, `jax.value_and_grad`, `jax.vmap`) powering hardware-accelerated state-vector simulation, automatic differentiation of parameterized quantum circuits (PQCs), and vectorized parameter sweeps.
- **IPC Architecture**: Type-safe Electron IPC context bridge connecting the TypeScript/Electron frontend to a persistent Python quantum worker (`qstudio_bridge.py`), eliminating per-invocation interpreter overhead.
- **Quantum Ecosystem Bridges**: Integrations with **Google Cirq**, **qsim** (`qsimcirq`), **OpenFermion**, **Qualtran**, and **JAX Quantum** (officially replacing legacy TensorFlow Quantum).
>>>>>>> 5066fb8c (feat: integrate JAX quantum simulation into QStudio)

---

## 🌟 Key Features

- **Multi-Language Quantum Compiler Pipeline**:
  - **Silq** (`.silq`) — High-level quantum language with automatic uncomputation.
  - **OpenQASM 3.0** (`.qasm`, `.qasm3`) — Extended Open Quantum Assembly Language.
  - **OpenQASM 2.0** (`.qasm`, `.qasm2`) — Standard circuit description language.
  - **Microsoft Q#** (`.qs`) — Quantum language for expressing quantum algorithms.
  - **Rigetti Quil** (`.quil`) — Quantum Instruction Language.
- **Interactive SVG Quantum Circuit Visualizer**:
  - Dynamic multi-qubit circuit rendering with gate boxes, control lines, CNOT targets, measurements, resets, and SWAP gates.
  - Supports zoom controls, panning, horizontal scrolling, and gate inspection.
- **Local State-Vector Simulator (1–12 Qubits)**:
  - Exact state-vector evolution using complex amplitude matrix transformations.
  - State vector amplitudes, probability distributions, phase angles, and Bloch Sphere vector calculations (X, Y, Z).
  - Configurable shot sampling (100 to 4096 shots).
- **Quantum Step Debugger**:
  - Step forward, step back, pause, and inspect state transitions operation-by-operation.
- **Monaco Editor Experience**:
  - Full syntax highlighting, error diagnostics, auto-completion, bracket matching, and hover tooltips for quantum semantics.
<<<<<<< HEAD
- **Cross-Framework Bridges**:
  - Adapters and export bridges for **Google Cirq**, **qsim**, **OpenFermion**, **Qualtran**, and **TensorFlow Quantum**.
=======
- **Cross-Framework Bridges & Differentiable QML**:
  - **JAX Quantum Engine**: Core high-performance numerical backend for exact state-vector simulation, reverse-mode automatic differentiation (`jax.value_and_grad`), and vectorized parameter sweeps (`jax.vmap`) across CPU and GPU/TPU accelerators.
  - **Google Cirq & qsim**: Circuit translation, high-performance Schrödinger full-wavefunction simulation via `qsimcirq`, and multi-framework benchmarking.
  - **OpenFermion & Qualtran**: Molecular Hamiltonian generation, Jordan-Wigner transformation, and fault-tolerant T-count/surface-code resource estimation.
  - **Legacy TensorFlow Quantum (TFQ) Status**: TensorFlow Quantum is deprecated and maintained in a legacy state due to rigid constraints (Python <= 3.10 and TensorFlow 2.x). QStudio replaces TFQ with JAX Quantum, delivering native support for modern Python environments (including Python 3.11–3.14+).
>>>>>>> 5066fb8c (feat: integrate JAX quantum simulation into QStudio)

---

## 📁 Repository Structure

```text
QStudio/
├── dist/
│   ├── backend/             # Compiled backend services & language parsers
│   │   ├── src/compiler/    # AST lowering, semantic analyzers, Silq compiler
│   │   ├── src/frameworks/  # Cirq, Qsim, Qualtran, OpenFermion bridges
│   │   ├── src/languages/   # OpenQASM 2/3, Q#, Quil, Silq adapters
│   │   └── src/security/    # WorkspaceGuard & TerminalGuard isolation
│   ├── extensions/          # Extension host runtime
│   ├── renderer/            # Pre-compiled React UI assets & Web Workers
│   │   └── index.html       # Web application entry point
│   └── simulator/           # StateVectorSimulator & QuantumDebugger engines
├── renderer/                # Source UI components & styles
└── tests/                   # Test specifications
```

---

## 🚀 Getting Started (Without pnpm)

This repository contains the pre-compiled, production-ready build in `dist/renderer`. You **do not need `pnpm` or `npm`** to run and explore the full QStudio interface.

Choose any of the following lightweight methods:

### Method 1: Using Python 3 (Web Browser — Zero Installation)

Python 3 has a built-in HTTP server with no package installations needed.

#### 🍎 macOS & 🐧 Linux
```bash
cd "/path/to/QStudio"
python3 -m http.server 5173 --directory dist/renderer
```

#### 🪟 Windows (Command Prompt / PowerShell)
```powershell
cd "C:\path\to\QStudio"
python -m http.server 5173 --directory dist\renderer
```

Then open your browser at:
👉 **[http://localhost:5173](http://localhost:5173)**

---

### Method 2: Using Node.js / npx (Zero Setup)

If you have Node.js installed, run a static server directly without installing local packages:

```bash
cd "/path/to/QStudio"
npx serve -l 5173 dist/renderer
```

---

### Method 3: Using PHP

#### 🍎 macOS & 🐧 Linux
```bash
cd "/path/to/QStudio/dist/renderer"
php -S localhost:5173
```

#### 🪟 Windows
```powershell
cd "C:\path\to\QStudio\dist\renderer"
php -S localhost:5173
```

---

### Method 4: Run as Desktop App via Electron (Native Window)

Launch QStudio directly inside a native desktop window using the bundled Electron binary without needing `pnpm dev`.

#### 🍎 macOS & 🐧 Linux
```bash
cd "/path/to/QStudio"
./node_modules/.bin/electron .
```

#### 🪟 Windows (Command Prompt / PowerShell)
```cmd
cd "C:\path\to\QStudio"
.\node_modules\.bin\electron.cmd .
```

---

## 🛠️ Developer Setup (When Source Files & Manifest Are Present)

If you are developing and editing the source code (`package.json`, `src/`, `vite.config.ts`), use `pnpm`:

```bash
pnpm install
pnpm run dev      # Starts Vite HMR dev server + Electron
pnpm run test     # Runs unit and quantum correctness tests
pnpm run build    # Compiles new dist/ bundles
```

<<<<<<< HEAD
=======
### Python Quantum Bridge & JAX Setup

QStudio's Python quantum bridge (`dist/backend/python/qstudio_bridge.py` and `jax_quantum.py`) integrates **JAX** (`jax.jit`, `jax.value_and_grad`, `jax.vmap`), **Cirq**, **qsim**, **OpenFermion**, and **Qualtran**.

#### Supported Python Environments
- **Supported Versions**: Python 3.9, 3.10, 3.11, 3.12, 3.13, and **Python 3.14+** on macOS (Apple Silicon / Intel), Linux (x86_64 / aarch64), and Windows.
- **Hardware Acceleration**: Automatic XLA compilation to CPU. CUDA/GPU acceleration is utilized automatically when a GPU-enabled JAX build is present.

#### Installation
```bash
python3 -m pip install -r requirements.txt
```

#### Frontend-to-Backend Architecture
```text
┌────────────────────────────────────────────────────────┐
│           TypeScript / Electron Frontend              │
│  (React UI, Monaco Editor, Interactive JAX Studio)     │
└───────────────────────────┬────────────────────────────┘
                            │ Electron IPC (preload.js)
┌───────────────────────────▼────────────────────────────┐
│      QuantumFrameworkBridge.js (TypeScript Service)    │
│  - Persistent NDJSON worker daemon process management  │
│  - Zero cold-start latency for repeated simulations    │
└───────────────────────────┬────────────────────────────┘
                            │ stdin / stdout (NDJSON protocol)
┌───────────────────────────▼────────────────────────────┐
│      qstudio_bridge.py / jax_quantum.py (Python)       │
│  - JAX complex128 state-vector evolution (jax.jit)     │
│  - Exact analytic gradients (jax.value_and_grad)       │
│  - Parallel batch parameter sweeps (jax.vmap)          │
│  - Trajectory simulation for mid-circuit RESET/MEASURE │
└────────────────────────────────────────────────────────┘
```

#### Testing the Bridge & Framework Adapters
Run the complete test suite verifying the persistent worker, JAX simulation, gradients, and UI integration:
```bash
node --test tests/jax_integration.test.js tests/ui_jax_studio.test.mjs
python3 -m pytest tests/test_jax_bridge.py -v
```

See [docs/JAX_INTEGRATION.md](docs/JAX_INTEGRATION.md) for supported gates, trajectory vs. unitary execution modes, autodiff limitations, and CPU/GPU backend details.

>>>>>>> 5066fb8c (feat: integrate JAX quantum simulation into QStudio)
---

## 🧪 Supported Language Examples

### OpenQASM 3.0 (Bell State)
```qasm
OPENQASM 3.0;
qubit[2] q;
bit[2] c;

h q[0];
cx q[0], q[1];
measure q[0] -> c[0];
measure q[1] -> c[1];
```

### Silq (Bell State)
```silq
fn bell() {
    let q = new Qubit[2];
    H(q[0]);
    X(q[1]).controlled(q[0]);
    return measure(q);
}
```

### Microsoft Q#
```qsharp
operation BellState() : Result[] {
    use q = Qubit[2];
    H(q[0]);
    CNOT(q[0], q[1]);
    return [M(q[0]), M(q[1])];
}
```

<<<<<<< HEAD
=======
### JAX Quantum Simulation & Autodiff Examples

#### 1. Differentiable Variational Ansatz with Analytic Gradient
Compute the exact expectation value $\langle \psi(\theta) | Z_0 | \psi(\theta) \rangle$ and its gradient $\nabla_\theta$ in Python via JAX:
```python
import jax
import jax.numpy as jnp

jax.config.update("jax_enable_x64", True)

# Rotation gate definition
def ry(theta):
    c, s = jnp.cos(theta / 2.0), jnp.sin(theta / 2.0)
    return jnp.array([[c, -s], [s, c]], dtype=jnp.complex128)

@jax.jit
def cost_function(theta):
    psi0 = jnp.array([1.0, 0.0], dtype=jnp.complex128)
    psi = ry(theta) @ psi0
    z_op = jnp.array([[1.0, 0.0], [0.0, -1.0]], dtype=jnp.complex128)
    return jnp.real(jnp.vdot(psi, z_op @ psi))

# Compute expectation and exact reverse-mode gradient in one pass
value, grad = jax.value_and_grad(cost_function)(jnp.pi / 4.0)
print(f"Expectation <Z>: {value:.6f}")       # 0.707107 (cos(pi/4))
print(f"Gradient d<Z>/dθ: {grad:.6f}")       # -0.707107 (-sin(pi/4))
```

#### 2. Vectorized Parameter Sweep (`jax.vmap`)
Evaluate an entire batch of parameter configurations in parallel with zero Python loop overhead:
```python
import jax
import jax.numpy as jnp

thetas = jnp.linspace(0.0, 2.0 * jnp.pi, 100)
batched_eval = jax.jit(jax.vmap(cost_function))
expectations = batched_eval(thetas)
print(f"Evaluated {len(expectations)} circuit configurations across active accelerator.")
```

>>>>>>> 5066fb8c (feat: integrate JAX quantum simulation into QStudio)
---

## 🛡️ Security & Sandboxing

QStudio runs with:
- **Workspace Guard**: Path validation preventing unauthorized file system access outside user-permitted workspace folders.
- **Terminal Guard**: Sanitization and command blocklists for integrated terminal executions.
- **Electron IPC Isolation**: Strict context isolation separating renderer processes from Node.js system calls.

---

## 📄 License

<<<<<<< HEAD
QStudio is licensed under the Apache License, Version 2.0.

See the LICENSE file for the full license text.

Copyright © 2026 Amarpreet Singh Cheema.
=======
This project is licensed under the Apache License 2.0.
>>>>>>> 5066fb8c (feat: integrate JAX quantum simulation into QStudio)
