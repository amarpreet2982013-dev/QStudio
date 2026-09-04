# Developer Guide

## Environment & Build

- **Node.js**: v20+
- **Package Manager**: `pnpm` 9+

### Commands

- `pnpm dev`: Compiles TypeScript app code, starts Vite dev server, and launches Electron.
- `pnpm exec tsc -p tsconfig.json --noEmit`: Runs TypeScript strict typecheck across main and renderer processes.
- `pnpm exec vitest run`: Executes unit test suite for compiler, simulator, and performance benchmarks.
- `pnpm build`: Compiles production bundle.

## Security Architecture

1. **Electron Sandboxing**: Renderer windows run with `contextIsolation: true` and `sandbox: true`.
2. **Path Restrictions**: Main process IPC handlers validate that file access targets paths within active open workspace roots (`assertWorkspace`).
3. **Terminal Sandbox**: Integrated terminal spawning only permits explicit binaries (`git`, `node`, `pnpm`, `python`, `python3`) with `shell: false` and length-restricted string arguments.
4. **Local-First & Offline Support**: AI credentials remain in main process environment variables (`SILQ_AI_BASE_URL`, `SILQ_AI_API_KEY`, `SILQ_AI_MODEL`). All quantum compilation, visualization, simulation, debugging, and example features execute 100% locally without AI credentials.

