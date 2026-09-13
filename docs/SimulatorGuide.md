# Simulator & Debugger Guide

## Shared State-Vector Simulator

`StateVectorSimulator` performs exact state-vector quantum simulation for 1 through 12 qubits using a normalized complex float amplitude array ($2^N$ complex numbers).

Because all language adapters (Silq, OpenQASM 3, Q#, Quil, OpenQASM 2.0) compile into the unified `QuantumIR`, a single high-performance simulation engine is shared across all languages.

### Supported Operations
- **Single-qubit gates**: Hadamard (`H`), Pauli-X (`X`), Pauli-Y (`Y`), Pauli-Z (`Z`), `S` (π/2 phase), `T` (π/4 phase).
- **Two-qubit gates**: `CNOT` / `CX`, `CZ`, `SWAP`.
- **Quantum measurement & reset**: Z-basis projection with state vector collapse (`measure`), reset to ground state |0⟩ (`reset`).

### Simulation Outputs
- **Probability Distribution**: Exact state probabilities calculated from complex amplitude norms $|a_i|^2 + |b_i|^2$.
- **State Vector**: Formatted complex amplitude representation per basis state (e.g. `0.707 + 0.000i |00⟩`).
- **Measurement Sampling**: Monte Carlo sampling according to probability distribution across user-selected shots (100, 512, 1024, 2048, 4096).
- **Bloch Coordinates**: Per-qubit Bloch vector expectation values $(x, y, z)$.

### Multi-Language Invocation
```ts
import { StateVectorSimulator } from "./simulator/StateVectorSimulator";

const simulator = new StateVectorSimulator();

// Automatic language detection by source code or explicit languageId:
const resultSilq = await simulator.run(silqSource, 1024, "silq");
const resultQasm3 = await simulator.run(qasm3Source, 1024, "openqasm3");
const resultQSharp = await simulator.run(qsharpSource, 1024, "qsharp");
const resultQuil = await simulator.run(quilSource, 1024, "quil");
const resultQasm2 = await simulator.run(qasm2Source, 1024, "openqasm2");
```

---

## QuantumDebugger

`QuantumDebugger` provides step-by-step historic state inspection over compiled `QuantumIR` operations:

- **Breakpoint management**: Toggle breakpoints by operation index.
- **Stepping controls**: `stepForward()`, `stepBack()`, `continue()`, `reset()`.
- **State snapshots**: Inspect exact `StateVectorResult` at any intermediate operation index.
- **Multi-language support**: Works transparently with circuits authored in Silq, OpenQASM 3, Microsoft Q#, Quil, or OpenQASM 2.0.
- **Disclaimer**: Operates purely on local state-vector simulator IR execution. Does not connect to real quantum hardware.
