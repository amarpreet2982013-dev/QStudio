# Compiler guide

The Silq compiler accepts function declarations, quantum-register declarations, and H, X, Y, Z, S, T, CNOT, CZ, SWAP, Measure, and Reset operations. Controlled X and Z syntax is represented as `X(target).controlled(control)` and `Z(target).controlled(control)`.

The compiler emits diagnostics without throwing, then produces QuantumIR, OpenQASM 3, and a circuit model. `SilqCompiler.analyze(source)` is the complete public compilation entry point.
