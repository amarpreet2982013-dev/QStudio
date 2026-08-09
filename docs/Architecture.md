# Architecture

Silq Studio uses a process boundary: Electron's main process owns filesystem dialogs and I/O; the renderer receives only a narrow, context-isolated preload API. React feature modules communicate through a Zustand store rather than Electron APIs directly.

The `backend`, `simulator`, `ai`, and `extensions` folders expose contracts, not vendor-specific integrations. Production adapters can be selected by composition at startup. This enables a Rust compiler bridge, cloud execution, and AI providers without changing UI modules.

## Compiler pipeline

`Lexer → Parser → AST → SemanticAnalyzer → QuantumIR → OpenQasmGenerator → CircuitGenerator` is fully composed by `SilqCompiler`. Each stage can be substituted independently. The parser produces a typed tree consumed by the Monaco outline and AST explorer.

The state-vector simulator consumes `QuantumIR`, retaining a normalized complex amplitude vector and deriving probabilities, sampled measurements, registers, and Bloch vectors. `QuantumDebugger` replays deterministic IR prefixes to support stepping and historic state inspection.

```text
Renderer (React / Monaco) → preload IPC → Electron main → workspace filesystem
            ↓
  compiler / simulator / AI / extension interfaces → concrete adapters
```

## Dependency rules

- UI depends on contracts and injected services, never remote implementation details.
- The main process has exclusive Node filesystem authority.
- Provider credentials are read at runtime from environment variables and never bundled into the renderer.
