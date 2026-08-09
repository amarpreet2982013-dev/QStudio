# Developer guide

Use Node 20+ and pnpm 9+. The development command compiles Electron’s main process before launching Vite and Electron.

The renderer cannot read the filesystem or run programs directly. Add trusted capabilities in `app/main.ts`, expose narrow typed methods from `app/preload.ts`, and consume them through `window.silq`. Integrated terminal execution accepts only `git`, `node`, `pnpm`, `python`, and `python3` from an opened workspace; it never invokes a shell.
