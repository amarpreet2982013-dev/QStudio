# API contracts

## `SilqCompiler`

`parse(source)`, `compile(source)`, `diagnostics(source)`, and `generateCircuit(source)` form the compiler boundary. `SilqCompiler` composes the lexer, parser, semantic analyzer, IR, OpenQASM, and circuit stages.

## `QuantumSimulator`

`compile(source)`, `run(source, shots)`, `measure(qubit)`, and `stop()` abstract simulators. `StateVectorSimulator` is the local implementation.

## `AIProvider`

`complete({ prompt, context })` returns a provider response. Provider implementations must obtain secrets from process environment at the trusted backend boundary.

The included OpenAI-compatible adapter requires `SILQ_AI_BASE_URL`, `SILQ_AI_API_KEY`, and `SILQ_AI_MODEL` only in the Electron main-process environment. None of these values are exposed to renderer code.

## `HardwareBackend`

Adapters identify their vendor as IBM Quantum, Google Quantum AI, IonQ, Quantinuum, or Rigetti. The interface specifies execution, status, and cancellation only; no provider credentials or transport details are coupled to the IDE.

## Extension API

Extensions receive `commands`, `languages`, `themes`, `snippets`, and `panels` registries during `activate(api)`.
