# QStudio

QStudio is a quantum programming environment for exploring quantum circuits, simulating their behavior, and experimenting with differentiable quantum workflows. The repository currently contains a compiled Electron/React application bundle, JavaScript backend modules, and a Python quantum-framework bridge.

[![License: Apache 2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

## What’s included

- **Circuit simulation:** a built-in state-vector simulator and a JAX-backed simulator for circuits of up to 12 qubits.
- **JAX workflows:** unitary simulation, mid-circuit measurement and reset trajectories, analytic gradients for parameterized circuits, and vectorized parameter sweeps.
- **Quantum ecosystem integrations:** adapters for Cirq and qsim, plus OpenFermion and Qualtran operations through the Python bridge.
- **Language tooling:** bundled support for working with Silq, OpenQASM 2 and 3, Q#, and Quil.
- **Desktop interface:** a compiled Electron renderer bundle with Monaco Editor assets.

The JAX bridge supports `H`, `X`, `Y`, `Z`, `S`, `T`, `RX`, `RY`, `RZ`, `CX`/`CNOT`, `CZ`, `SWAP`, `ISWAP`, `CCX`/`TOFFOLI`, measurement, reset, and barrier operations. Gradients are for expectation values of parameterized unitary circuits; discrete shot sampling and mid-circuit measurement/reset are not differentiable.

## Repository layout

```text
dist/
  ai/                         AI provider modules
  app/                        Electron main and preload bundles
  backend/
    python/                   JAX engine and Python framework bridge
    src/                      Compiled JavaScript backend modules
  extensions/                 Extension host bundle
  renderer/                   Compiled application UI and assets
  simulator/                  Native simulator and debugger
docs/
  JAX_INTEGRATION.md          JAX bridge details and limitations
tests/                        JavaScript and Python tests
requirements.txt              Python bridge dependencies
```

This checkout contains compiled application files rather than the original frontend source tree. It does not include a `package.json` or frontend build configuration, so the bundled UI cannot be rebuilt from this repository as-is.

## Preview the interface

With Python 3 installed, serve the compiled renderer:

```bash
python3 -m http.server 5173 --directory dist/renderer
```

Open [http://localhost:5173](http://localhost:5173) in a browser. This serves a static UI preview; Electron-only features such as native project access and IPC-backed framework operations require the desktop host.

## Set up the Python bridge

Use Python 3 and install the dependencies listed in `requirements.txt`:

```bash
python3 -m pip install -r requirements.txt
```

Check the Python runtime and available quantum frameworks:

```bash
python3 dist/backend/python/qstudio_bridge.py probe
```

The bridge reads JSON from standard input and writes a JSON response to standard output. For example, simulate a two-qubit Bell circuit:

```bash
echo '{"circuit":{"name":"Bell","qubits":2,"operations":[{"gate":"H","targets":[0]},{"gate":"CX","targets":[0,1]}]},"shots":1000,"seed":7}' \
  | python3 dist/backend/python/qstudio_bridge.py jax:simulate
```

The JAX simulator uses the available JAX backend (CPU by default; GPU/TPU when supported by the installed JAX build). State-vector memory grows exponentially with qubit count, and trajectory simulation has a lower shot limit than unitary simulation.

See [docs/JAX_INTEGRATION.md](docs/JAX_INTEGRATION.md) for bridge commands, execution modes, supported operations, and differentiation limitations.

## Run tests

Run the JavaScript integration and UI tests with Node.js:

```bash
node --test tests/jax_integration.test.js tests/ui_jax_studio.test.mjs
```

Run the Python bridge tests with pytest:

```bash
python3 -m pytest tests/test_jax_bridge.py -v
```

The tests require the Python dependencies used by the bridge. The JavaScript integration tests also invoke the Python quantum bridge.

## License

QStudio is licensed under the [Apache License, Version 2.0](LICENSE).
