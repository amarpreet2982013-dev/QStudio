# QStudio — Quantum Programming IDE

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Electron%20%7C%20Web-blueviolet.svg)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)

**QStudio** is an interactive desktop and web-based Integrated Development Environment (IDE) designed for quantum computing algorithms, circuit synthesis, simulation, and step-by-step debugging.

Built with **React**, **TypeScript**, and **Electron**, QStudio provides a unified quantum intermediate representation (IR) supporting multiple quantum programming languages with real-time circuit visualization, state-vector simulation, and Monaco Editor integration.

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
- **Cross-Framework Bridges**:
  - Adapters and export bridges for **Google Cirq**, **qsim**, **OpenFermion**, **Qualtran**, and **TensorFlow Quantum**.

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

---

## 🛡️ Security & Sandboxing

QStudio runs with:
- **Workspace Guard**: Path validation preventing unauthorized file system access outside user-permitted workspace folders.
- **Terminal Guard**: Sanitization and command blocklists for integrated terminal executions.
- **Electron IPC Isolation**: Strict context isolation separating renderer processes from Node.js system calls.

---

## 📄 License

This project is licensed under the Apache License 2.0.
