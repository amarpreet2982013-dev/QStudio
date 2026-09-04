# QStudio — Quantum Programming IDE

QStudio is a quantum development environment built with Electron, React, and TypeScript. It features live compilation, interactive circuit visualization, state-vector simulation, quantum debugging, Monaco editor diagnostics, and built-in quantum examples.

## Quick Start

```bash
pnpm install
pnpm dev
```

Run checks and tests:

```bash
pnpm exec tsc -p tsconfig.json --noEmit
pnpm exec vitest run
pnpm build
```

## Features

- **Monaco Editor Integration**: Full syntax highlighting, auto-completion, hover documentation, document symbols, bracket matching, formatting, and live diagnostic markers.
- **Compiler & Diagnostics**: Silq parser, AST generation, semantic analysis, Quantum IR lowering, and OpenQASM 3 generation. Emits detailed line/column/range error diagnostics.
- **Debounced Live Compilation**: 200ms debounced compilation pipeline updates AST Explorer and circuit visualization automatically while preserving last valid circuit state on syntax errors.
- **Interactive SVG Circuit Visualization**: Visualizes qubit wires, gate boxes, control dots, CNOT links, measurements, resets, and SWAP operations. Supports zoom in/out, horizontal scrolling, and gate selection.
- **State-Vector Quantum Simulator**: Simulates 1–12 qubits with exact state vectors, complex amplitudes, probability distributions, Bloch vector coordinates (X, Y, Z), and customizable shot sampling (100 to 4096 shots).
- **Step-by-Step Quantum Debugger**: Step forward, step back, continue, reset, and inspect operation-by-operation state evolution and probabilities.
- **Built-in Quantum Examples**: 10 runnable quantum programs (Hello Qubit, X Gate, H Gate, Bell State, S Phase, T Phase, CNOT, SWAP, Measurement, Reset) accessible directly from the Welcome Screen and repository `examples/` directory.
- **Security & AI Provider**: Context isolation, sandboxed Electron IPC, and local-first execution. AI Assistant provider abstraction works with optional environment credentials or operates entirely offline.

## Documentation

- [docs/Architecture.md](docs/Architecture.md): Architecture overview and dependency rules
- [docs/CompilerGuide.md](docs/CompilerGuide.md): Silq compiler pipeline & diagnostic specifications
- [docs/SimulatorGuide.md](docs/SimulatorGuide.md): State-vector simulator & quantum debugger guide
- [docs/DeveloperGuide.md](docs/DeveloperGuide.md): Development, testing, and security guide

