# Contributing

Use Node 20+ and pnpm 9+. Keep TypeScript strict, format with Prettier, and run `pnpm lint && pnpm test && pnpm build` before submitting changes.

Place new capabilities in a focused module and depend on public contracts. Do not import Electron or Node APIs into renderer components; expand the preload API deliberately instead.
