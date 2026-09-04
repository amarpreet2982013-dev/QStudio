# Compiler Guide

The QStudio Silq compiler accepts function declarations, quantum-register declarations (`let q = new Qubit[N];`), and quantum gate operations (`H`, `X`, `Y`, `Z`, `S`, `T`, `CNOT`, `CZ`, `SWAP`, `measure`, and `reset`).

Controlled gate syntax is supported via `.controlled(control)` (e.g. `X(q[1]).controlled(q[0])`).

## Pipeline & Diagnostics

1. **Lexer**: Tokenizes source into typed tokens (`keyword`, `identifier`, `number`, `symbol`, `comment`) with start/end character offsets, line numbers, and column numbers.
2. **Parser**: Parses tokens into a typed Abstract Syntax Tree (`ProgramNode`, `FunctionNode`, `QubitDeclarationNode`, `GateNode`, `ReturnNode`, `VariableNode`). Emits structured `Diagnostic` objects containing `severity`, `message`, `line`, `column`, `endLine`, `endColumn`, and `range`.
3. **Semantic Analyzer**: Validates register names, symbol references, qubit range limits (1–12 qubits), register sizes, and target/control index bounds.
4. **IR Generator**: Lowers AST to `QuantumIR` containing linear operations and qubit counts.
5. **Generators**: Emits OpenQASM 3 format string (`OpenQasmGenerator`) and SVG-compatible circuit model (`CircuitGenerator`).

`SilqCompiler.analyze(source)` executes the complete compilation pipeline asynchronously and returns `CompilationResult`.
