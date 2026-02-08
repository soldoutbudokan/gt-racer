# GT Racer - CLAUDE.md

## Project Overview
Hyperrealistic browser racing game inspired by GT Racing 2 (Gameloft, 2013).

## Tech Stack
- Vite + React + TypeScript
- Three.js via React Three Fiber (R3F)
- Rapier.js physics via @react-three/rapier
- Zustand for state management
- Tailwind CSS for UI overlay
- Web Audio API for procedural audio

## Architecture
- Pure SPA (no SSR) - Vite, not Next.js
- Raycast vehicle physics (no rigid body wheels)
- Fixed-timestep physics at 60Hz, variable render
- HTML overlay HUD (not 3D text)
- Zustand persist → localStorage for saves

## Key Patterns
- Physics: Simplified Pacejka tire model, spring-damper suspension
- Camera: Spring-damper chase camera
- AI: Racing line following with PD controller + rubber banding
- Audio: Procedural oscillator-based engine synthesis (no sample files)

## Commands
- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run preview` — preview production build

## File Organization
- `src/physics/` — Vehicle dynamics (most critical system)
- `src/rendering/` — R3F scenes, components, effects, cameras
- `src/engine/` — Game loop, input, events, asset loading
- `src/stores/` — Zustand state management
- `src/ui/` — HTML/CSS overlay (HUD, menus, screens)
- `src/audio/` — Procedural audio systems
- `src/ai/` — AI opponent system
- `src/data/` — Static JSON configs (cars, tracks, career)
- `src/utils/` — Math helpers, spline, constants

## Conventions
- TypeScript strict mode
- snake_case files, PascalCase components/classes, camelCase functions
- # %% markers for code sections in non-component files
- Type hints via TypeScript interfaces in types.ts files
