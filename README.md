# QStudio — Quantum Programming IDE

[![License: Apache 2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![JAX](https://img.shields.io/badge/JAX-quantum%20simulation-brightgreen.svg)](https://jax.readthedocs.io/)

**QStudio** is an environment for writing and exploring quantum programs, visualizing circuits, and simulating quantum algorithms. It combines a bundled Electron/React interface with JavaScript simulator and compiler modules and an optional Python bridge to quantum-computing frameworks.

> **Repository note:** This checkout contains compiled application bundles, not the original frontend source tree. There is no `package.json` or frontend build configuration here, so the UI can be previewed as static files but cannot be rebuilt from this checkout.

## ✨ Features

- **Quantum language tooling:** bundled adapters for Silq, OpenQASM 2 and 3, Microsoft Q#, and Rigetti Quil.
- **Circuit visualization:** interactive JAX Studio views for circuits, Bloch spheres, and parameter-sweep results.
- **Local simulation and debugging:** a native state-vector simulator and a step-based quantum debugger.
- **JAX quantum engine:** JIT-compiled state-vector simulation, analytic expectation-value gradients, and vectorized parameter sweeps.
- **Mid-circuit operations:** JAX trajectory simulation supports projective measurement and reset.
- **Framework integrations:** Python bridge adapters for Google Cirq and qsim, OpenFermion, and Qualtran.
- **Desktop integration:** bundled Electron main/preload modules with a context-isolated renderer bridge.

### JAX operation support

The JAX simulator supports the following gate and circuit operations:

| Category | Operations |
|---|---|
| Single-qubit | `H`, `X`, `Y`, `Z`, `S`, `T`, `RX`, `RY`, `RZ` |
| Two-qubit | `CX` / `CNOT`, `CZ`, `SWAP`, `ISWAP` |
| Three-qubit | `CCX` / `TOFFOLI` |
| Circuit operations | `MEASURE` / `M`, `RESET`, `BARRIER` |

Simulation is limited to 1–12 qubits because state-vector memory grows exponentially. Mid-circuit measurement and reset use trajectory simulation and are not supported by gradient or parameter-sweep operations. Gradients are for expectation values of parameterized unitary circuits; discrete shot sampling is not differentiable.

## 🗂️ Repository layout

```text
QStudio/
├── dist/
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
├── tests/                    # JavaScript and Python tests
└── requirements.txt          # Python bridge dependencies
```

## 🚀 Quick start

### Preview the bundled interface

Requires Python 3; no frontend package installation is needed for this static preview:

```bash
python3 -m http.server 5173 --directory dist/renderer
```

Open [http://localhost:5173](http://localhost:5173). This serves the renderer as static files. Features that depend on Electron IPC or native desktop access are not available in a browser-only preview.

### Install Python bridge dependencies

Use a Python environment for the bridge and install its dependencies:

```bash
python3 -m pip install -r requirements.txt
```

The bridge includes JAX and NumPy/SciPy dependencies, with Cirq, qsimcirq, OpenFermion, and Qualtran integrations. JAX uses the available backend; CPU is the typical default, while GPU or TPU use depends on the installed JAX build and hardware.

## ⚛️ Use the Python bridge

The bridge accepts a command as its final argument, reads an optional JSON payload from standard input, and writes a JSON response to standard output.

Probe the Python runtime and available frameworks:

```bash
python3 dist/backend/python/qstudio_bridge.py probe
```

Run a two-qubit Bell-state circuit with JAX:

```bash
echo '{"circuit":{"name":"Bell","qubits":2,"operations":[{"gate":"H","targets":[0]},{"gate":"CX","targets":[0,1]}]},"shots":1000,"seed":7}' \
  | python3 dist/backend/python/qstudio_bridge.py jax:simulate
```

Available bridge commands include `jax:probe`, `jax:simulate`, `jax:gradient`, `jax:vmap_sweep`, `cirq:simulate`, `cirq:export`, `qsim:simulate`, `qualtran:estimate`, and `openfermion:hamiltonian`. Optional frameworks are reported by the probe and require their Python dependencies to be installed.

For execution modes, request payloads, and differentiation constraints, see [docs/JAX_INTEGRATION.md](docs/JAX_INTEGRATION.md).

## 🧪 Run tests

With Node.js installed, run the JavaScript integration and UI tests:

```bash
node --test tests/jax_integration.test.js tests/ui_jax_studio.test.mjs
```

With the Python bridge dependencies and pytest installed, run:

```bash
python3 -m pytest tests/test_jax_bridge.py -v
```

The JavaScript integration tests also call into the Python bridge, so they require a working Python/JAX environment.

## 📄 License

QStudio is licensed under the [Apache License, Version 2.0](LICENSE).

Copyright © 2026 Amarpreet Singh Cheema.
