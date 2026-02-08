# GT Racer

A hyperrealistic browser-based racing game inspired by GT Racing 2, built with Three.js, React Three Fiber, and Rapier physics.

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## Features

- Realistic vehicle physics (Pacejka tire model, spring-damper suspension)
- Procedural car geometry with PBR materials
- AI opponents with racing line following
- Procedural audio engine (no external audio files)
- Career mode with progression
- Multiple camera views
- Post-processing effects (bloom, SSAO, vignette)

## Tech Stack

- **Rendering**: Three.js via React Three Fiber
- **Physics**: Rapier.js (WASM)
- **State**: Zustand
- **UI**: React + Tailwind CSS
- **Build**: Vite + TypeScript

## Controls

| Key | Action |
|-----|--------|
| W / Up Arrow | Accelerate |
| S / Down Arrow | Brake / Reverse |
| A / Left Arrow | Steer Left |
| D / Right Arrow | Steer Right |
| Space | Handbrake |
| C | Change Camera |
| Escape | Pause |

## Development

See [CLAUDE.md](./CLAUDE.md) for development guidelines.
