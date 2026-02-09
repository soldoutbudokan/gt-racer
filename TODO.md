# GT Racer - TODO

## Bugs (High Priority)

- [ ] **Quick Race doesn't start properly** — Scene transitions from menu to racing but something breaks during initialization. Possible causes:
  - Suspense boundary in App.tsx wraps SceneRouter with `fallback={null}` — the Sky component (drei) may trigger Suspense during shader compilation, causing a black flash or failed mount
  - Physics world (`@react-three/rapier`) may not be ready when the first `useFrame` fires, causing null refs on chassis bodies
  - `useEffect` for `startRace()` runs after first paint — there's a single frame where racers array is empty, which could crash components that depend on it
  - Countdown logic in PlayerCar `useFrame` decrements countdown before `startRace()` effect fires, potentially setting `started: true` on stale state
- [ ] **Race state not reset between races** — `resetRace()` is never called when navigating back to menu; stale race state persists

## Visual Improvements (Medium Priority)

### Car Models
- [ ] **Cars still look blocky/Minecrafty** — Procedural car geometry uses lofted cross-sections but only 48 perimeter points; needs smoother curves
- [ ] Add per-car liveries/decals (racing numbers, sponsor stripes) via procedural canvas textures
- [ ] Add per-car unique wheel designs (different spoke counts/styles per tier)
- [ ] Add visible suspension geometry (A-arms, springs) connecting wheels to body
- [ ] Add tire tread pattern via normal/bump map on tire material
- [ ] Add brake glow effect (emissive material on brake disc based on brake input intensity)
- [ ] Animate steering wheel in interior silhouette based on steering input

### Track
- [ ] Add procedural normal map to asphalt for micro-surface detail
- [ ] Add pit lane geometry and markings
- [ ] Add track-side advertising boards/banners along barriers
- [ ] Add run-off areas (gravel traps) at corners with different material
- [ ] Add elevation changes to track spline (currently all Y=0)
- [ ] Add more track layouts beyond azure-coast

### Environment
- [ ] Replace flat-plane trees with 3D foliage (billboarded quads at multiple angles or low-poly 3D crowns)
- [ ] Add windows/doors/architectural detail to buildings (via procedural texture)
- [ ] Add trackside fencing (instanced thin posts + plane mesh for chain-link)
- [ ] Add marshalling posts / flag stations around the track
- [ ] Add spectator figures (instanced simple shapes) in grandstands
- [ ] Add distant mountains/hills on horizon
- [ ] Add animated flags/banners

### Lighting & Atmosphere
- [ ] Add time-of-day variations (morning, afternoon, sunset, night)
- [ ] Add dynamic shadow quality settings (low/medium/high)
- [ ] Add environment map / reflection probe for car paint reflections
- [ ] Add light probes for more accurate indirect lighting

### Effects
- [ ] Add motion blur post-processing (speed-dependent)
- [ ] Add depth of field (subtle, focused on car)
- [ ] Add heat haze effect on track surface
- [ ] Add spark particles on car-barrier collisions
- [ ] Add rain/weather particle system
- [ ] Improve skid marks to render as textured strips instead of line pairs

## Gameplay (Lower Priority)

- [ ] Add working career mode progression
- [ ] Add garage screen with car selection and upgrades
- [ ] Add track selection screen
- [ ] Add multiple camera views (cockpit, hood, bumper, helicopter)
- [ ] Add rear-view mirror
- [ ] Add minimap on HUD
- [ ] Add split times and delta display
- [ ] Add replay system
- [ ] Add procedural engine audio (Web Audio API oscillator synthesis)
- [ ] Add tire screech audio
- [ ] Add collision audio
- [ ] Add gamepad/controller support
- [ ] Add touch controls for mobile

## Performance

- [ ] Profile GPU draw calls and identify remaining bottlenecks
- [ ] Add LOD (Level of Detail) for distant objects
- [ ] Add frustum culling hints for off-screen environment objects
- [ ] Consider WebGPU renderer path for modern browsers
- [ ] Add quality presets (Low/Medium/High/Ultra) controlling shadow map size, particle count, post-processing
