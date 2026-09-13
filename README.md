# QStudio — Quantum Programming IDE

QStudio is a quantum development environment built with Electron, React, and TypeScript. It features a modular compiler pipeline supporting **Silq**, **OpenQASM 3.0**, **Microsoft Q#**, **Quil**, and **OpenQASM 2.0**, live interactive circuit visualization, state-vector simulation, step-by-step quantum debugging, Monaco editor diagnostics, and built-in quantum examples.

## Quick Start

```bash
pnpm install
pnpm dev
```

Run checks, test suite, and production build:

```bash
pnpm exec tsc -p tsconfig.json --noEmit
pnpm exec vitest run
pnpm build
```

## Features

- **Multi-Quantum-Language Architecture**: Native compiler adapters for Silq (`.silq`), OpenQASM 3.0 (`.qasm`, `.qasm3`), Microsoft Q# (`.qs`), Quil (`.quil`), and OpenQASM 2.0 (`.qasm`, `.qasm2`).
- **Monaco Editor Integration**: Full syntax highlighting, auto-completion, hover documentation, bracket matching, formatting, and live diagnostic markers for all supported quantum languages.
- **Automatic Language Detection & Manual Selection**: Automatic detection by file extension and source code headers, with manual language selection available from the editor toolbar.
- **Shared Quantum IR**: Unidirectional compilation lowers each language AST into a common `QuantumIR` containing linear operations and qubit registers.
- **Interactive SVG Circuit Visualization**: Visualizes qubit wires, gate boxes, control dots, CNOT links, measurements, resets, and SWAP operations. Supports zoom in/out, horizontal scrolling, and gate selection.
- **Shared State-Vector Quantum Simulator**: Simulates 1–12 qubits with exact state vectors, complex amplitudes, probability distributions, Bloch vector coordinates (X, Y, Z), and customizable shot sampling (100 to 4096 shots).
- **Step-by-Step Quantum Debugger**: Step forward, step back, continue, reset, and inspect operation-by-operation state evolution and probabilities across all languages.
- **Built-in Quantum Examples**: Multi-language Bell state benchmarks and canonical quantum programs runnable directly from the Welcome Screen.
- **Security & Sandboxing**: Context isolation, sandboxed Electron IPC, and local-first execution.

## Supported Quantum Languages & Grammar Subsets

| Language | Extensions | Monaco ID | Sample Syntax |
| :--- | :--- | :--- | :--- |
| **Silq** (Original) | `.silq` | `silq` | `fn bell() { let q = new Qubit[2]; H(q[0]); X(q[1]).controlled(q[0]); return measure(q); }` |
| **OpenQASM 3.0** | `.qasm`, `.qasm3` | `openqasm3` | `OPENQASM 3.0; qubit[2] q; bit[2] c; h q[0]; cx q[0], q[1]; measure q[0] -> c[0];` |
| **Microsoft Q#** | `.qs` | `qsharp` | `operation BellState() : Result[] { use q = Qubit[2]; H(q[0]); CNOT(q[0], q[1]); ResetAll(q); }` |
| **Quil** | `.quil` | `quil` | `DECLARE ro BIT[2] \n H 0 \n CNOT 0 1 \n MEASURE 0 ro[0]` |
| **OpenQASM 2.0** | `.qasm`, `.qasm2` | `openqasm2` | `OPENQASM 2.0; include "qelib1.inc"; qreg q[2]; creg c[2]; h q[0]; cx q[0],q[1];` |

> *Note: QStudio implements documented subsets of each quantum language for local IDE tooling. It does not claim full specification compliance with third-party language runtimes.*

## Documentation

- [docs/MultiLanguageArchitecture.md](docs/MultiLanguageArchitecture.md): Architecture audit, Quantum Language Adapter pattern, and guide for adding languages
- [docs/CompilerGuide.md](docs/CompilerGuide.md): Compiler pipeline, supported grammar subsets, and diagnostics specifications
- [docs/SimulatorGuide.md](docs/SimulatorGuide.md): Shared state-vector simulator & quantum debugger guide
- [docs/API.md](docs/API.md): API contracts for adapters, registries, simulators, and extensions
- [docs/DeveloperGuide.md](docs/DeveloperGuide.md): Development, testing, and security guide
