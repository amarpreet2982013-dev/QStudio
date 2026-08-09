# Silq Studio

Silq Studio is a desktop IDE foundation for the Silq quantum programming language. It combines a Monaco-based editor, workspace explorer, circuit view, simulation console, and AI-ready assistant in a modular Electron application.

## Quick start

```bash
pnpm install
pnpm dev
```

Run checks with `pnpm lint`, `pnpm test`, and `pnpm build`.

## Included MVP

- Monaco editor with Silq tokenization, completion, minimap, search/replace, themes, and tabs.
- Secure Electron project opening, file reads/writes, and recursive explorer tree.
- Live compiler-derived SVG circuit view and local state-vector simulation (1–12 qubits; H, X, Y, Z, S, T, CNOT, CZ, SWAP, measure, and reset).
- Silq language tooling: diagnostics, completion, hover, definitions, rename, formatting, folding, bracket matching, outline, and AST explorer.
- Console, Problems, Terminal, and Simulation Output panels.
- Local AI assistant UI; implement an `AIProvider` with environment-provided credentials before enabling a hosted provider.
- Extension host contracts for commands, languages, themes, snippets, and panels.

See [docs/Architecture.md](docs/Architecture.md), [docs/API.md](docs/API.md), and [docs/Contributing.md](docs/Contributing.md).
