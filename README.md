# QStudio — Quantum Programming IDE

[![License: Apache 2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![JAX](https://img.shields.io/badge/JAX-quantum%20simulation-brightgreen.svg)](https://jax.readthedocs.io/)

**QStudio** is a quantum programming IDE for writing and exploring quantum programs, visualizing circuits, and simulating quantum algorithms. Its architecture combines an Electron desktop shell, a React-based renderer, JavaScript compiler and simulation modules, and a Python bridge whose primary differentiable simulation engine is built with JAX.

> **Repository note:** This checkout contains compiled application bundles, not the original frontend source tree. There is no `package.json` or frontend build configuration here, so the UI can be previewed as static files but cannot be rebuilt or packaged as a desktop app from this checkout.

## ✨ Features

- **Quantum language tooling:** bundled adapters for Silq, OpenQASM 2 and 3, Microsoft Q#, and Rigetti Quil.
- **Circuit visualization:** interactive JAX Studio views for circuits, Bloch spheres, and parameter-sweep results.
- **Local simulation and debugging:** a native state-vector simulator and a step-based quantum debugger.
- **JAX quantum engine:** JIT-compiled state-vector simulation, analytic expectation-value gradients, and vectorized parameter sweeps.
- **Mid-circuit operations:** JAX trajectory simulation supports projective measurement and reset.
- **Framework integrations:** Python bridge adapters for Google Cirq and qsim, OpenFermion, and Qualtran.
- **Desktop integration:** bundled Electron main/preload modules with a context-isolated renderer bridge.

## 🧰 Technology stack

| Layer | Technology | Role in QStudio |
|---|---|---|
| Desktop shell | Electron | Creates the application window and handles operating-system features such as project dialogs and IPC requests. |
| User interface | React, JavaScript, and bundled CSS | Renders the IDE and JAX Studio interface. The renderer bundle includes Monaco Editor assets and web workers. |
| Desktop bridge | Electron preload and IPC | Exposes a limited API to the renderer through `contextBridge`; the renderer does not receive direct Node.js access. |
| Language and circuit services | JavaScript modules | Provide language adapters, parsing/compilation, framework adapters, circuit conversion, and the native simulator/debugger. |
| Quantum numeric engine | Python, JAX, and jaxlib | Runs state-vector operations, XLA compilation, automatic differentiation, vectorized sweeps, and measurement trajectories. |
| Optional quantum ecosystem | Cirq, qsimcirq, OpenFermion, Qualtran | Supplies additional circuit simulation, export, chemistry, and resource-estimation integrations when installed. |
| Verification | Node.js test runner and pytest | Exercises the JavaScript integration/UI and Python bridge. |

The UI and Electron files in this repository are compiled bundles. The React and Electron stack describes how the application is structured; it does not mean the original React source or a complete Electron packaging/build setup is included here.

## 🏗️ How the application fits together

```text
┌──────────────────────────────────────────────────────────┐
│ React renderer                                           │
│ IDE interface · Monaco assets · JAX Studio visualizations│
└────────────────────────────┬─────────────────────────────┘
                             │ limited API exposed by preload
┌────────────────────────────▼─────────────────────────────┐
│ Electron main process                                     │
│ IPC handlers · project/file access · simulation routing   │
└───────────────┬───────────────────────────┬───────────────┘
                │                           │
     JavaScript services             Python framework bridge
     native simulator,               persistent JSON-lines worker
     debugger, compilers                        │
                                         ┌──────▼───────┐
                                         │ JAX / jaxlib │
                                         │ Cirq, qsim,  │
                                         │ OpenFermion, │
                                         │ Qualtran     │
                                         └──────────────┘
```

In the desktop flow, the renderer requests operations through the preload API. Electron’s main process validates and routes framework requests. Native simulation and compiler services run in JavaScript; Python-backed operations are sent to the framework bridge. The bridge can keep a Python worker alive between requests, using newline-delimited JSON over standard input/output. This avoids launching a new Python interpreter for each operation.

The static browser preview skips the Electron main/preload layer. It is useful for viewing the bundled renderer, but cannot provide desktop IPC, native project access, or a live Python simulation bridge.

## ⚙️ How JAX is used

QStudio’s JAX engine is an implementation of state-vector simulation using JAX arrays and `jax.numpy`; it is not a dependency on a separate package named “JAX Quantum.” The bridge enables 64-bit precision for complex state vectors and uses:

- **`jax.jit`** to compile unitary circuit and expectation-value computations through XLA.
- **`jax.value_and_grad`** to calculate expectation values and gradients for supported parameterized unitary circuits.
- **`jax.vmap`** to evaluate batches of parameter sets and vectorize trajectory work.
- **`jax.random`** for seeded sampling and projective measurement trajectories.

Exact unitary simulation returns state-vector and probability results; measurement counts are sampled according to the requested shot count. Circuits with mid-circuit measurement or reset use trajectory simulation, whose probabilities are empirical. The engine is bounded to 1–12 qubits, and trajectory runs are limited to 4,096 shots. Gradients and vectorized sweeps reject non-unitary operations such as reset and mid-circuit measurement.

JAX selects an installed backend. CPU is the standard setup; accelerator use requires a compatible JAX/jaxlib build and available device. See [docs/JAX_INTEGRATION.md](docs/JAX_INTEGRATION.md) for supported operations, output modes, and limitations.

### JAX operation support

The JAX simulator supports the following gate and circuit operations:

| Category | Operations |
|---|---|
| Single-qubit | `H`, `X`, `Y`, `Z`, `S`, `T`, `RX`, `RY`, `RZ` |
| Two-qubit | `CX` / `CNOT`, `CZ`, `SWAP`, `ISWAP` |
| Three-qubit | `CCX` / `TOFFOLI` |
| Circuit operations | `MEASURE` / `M`, `RESET`, `BARRIER` |

## 🗂️ Repository layout

```text
QStudio/
├── dist/                      # Compiled application and backend bundles
│   ├── ai/                   # AI provider modules
│   ├── app/                  # Electron main and preload bundles
│   ├── backend/
│   │   ├── python/           # JAX engine and Python framework bridge
│   │   └── src/              # Compiled JavaScript compiler and adapters
│   ├── extensions/           # Extension host
│   ├── renderer/             # Compiled UI, Monaco assets, and JAX Studio
│   └── simulator/            # State-vector simulator and debugger
├── docs/
│   └── JAX_INTEGRATION.md    # JAX commands, modes, and limitations
├── tests/                     # JavaScript and Python tests
├── requirements.txt           # Python bridge dependencies
├── LICENSE
└── NOTICE
```

## 🚀 Quick start

### 1. Preview the bundled interface

Requires Python 3; no frontend package installation is needed for this static preview:

```bash
python3 -m http.server 5173 --directory dist/renderer
```

Open [http://localhost:5173](http://localhost:5173). This serves the renderer as static files. Features that depend on Electron IPC or native desktop access are not available in a browser-only preview.

### 2. Install Python bridge dependencies

Use a Python environment for the bridge and install its dependencies:

```bash
python3 -m pip install -r requirements.txt
```

The requirements include JAX, NumPy, and SciPy, plus Cirq, qsimcirq, OpenFermion, and Qualtran. JAX uses the available backend; CPU is the typical default, while GPU or TPU use depends on the installed JAX build and hardware.

## ⚛️ Use the Python quantum bridge

The bridge accepts a command as its final argument, reads an optional JSON payload from standard input, and writes a JSON response to standard output. It can be used directly from a terminal or called by the JavaScript framework adapters.

Probe the Python runtime and available frameworks:

```bash
python3 dist/backend/python/qstudio_bridge.py probe
```

Run a two-qubit Bell-state circuit with JAX:

```bash
echo '{"circuit":{"name":"Bell","qubits":2,"operations":[{"gate":"H","targets":[0]},{"gate":"CX","targets":[0,1]}]},"shots":1000,"seed":7}' \
  | python3 dist/backend/python/qstudio_bridge.py jax:simulate
```

Available bridge commands include `probe`, `jax:probe`, `jax:simulate`, `jax:gradient`, `jax:vmap_sweep`, `cirq:simulate`, `cirq:export`, `qsim:simulate`, `qualtran:estimate`, and `openfermion:hamiltonian`. Optional frameworks are reported by the probe and require their Python dependencies to be installed.

For execution modes, request payloads, and differentiation constraints, see [docs/JAX_INTEGRATION.md](docs/JAX_INTEGRATION.md).

## 🧪 Run tests

With Node.js, Python, the Python bridge dependencies, and pytest installed, run the JavaScript integration and UI tests:

```bash
node --test tests/jax_integration.test.js tests/ui_jax_studio.test.mjs
```

With the Python bridge dependencies and pytest installed, run:

```bash
python3 -m pytest tests/test_jax_bridge.py -v
```

The JavaScript integration tests also call into the Python bridge, so they require a working Python/JAX environment. The repository does not include npm scripts or a frontend build command.

## 📄 License

QStudio is licensed under the [Apache License, Version 2.0](LICENSE).

Copyright © 2026 Amarpreet Singh Cheema.
