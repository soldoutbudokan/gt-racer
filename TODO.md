# GT Racer - Detailed Implementation Plan

This is the prioritized, actionable task list. Each task includes the specific
files to edit, the root cause or rationale, and concrete implementation steps.

---

## Phase 1: Fix the Camera / Race-Start Bug (CRITICAL)

The camera shoots into the sky on Quick Race because of a race-condition between
Rapier physics initialization and the ChaseCamera's one-shot `initialized` flag.
On Frame 1, `useVehicleStore.position` is still `{0,0,0}` (the default) because
the RigidBody hasn't synced yet and `VehicleController.getState()` returns zeros
when `chassisBody` is null. The camera initializes to `(0, 5, -10)` targeting
`(0,0,0)`. On Frame 2 the real car position (~`(0, 0.5, startZ)`) appears and
the spring-damper overshoots wildly because `startZ` is far from 0.

### 1.1 — Defer ChaseCamera initialization until vehicle position is valid
- **File:** `src/rendering/cameras/ChaseCamera.tsx`
- **Steps:**
  1. Remove the `initialized` ref and the one-shot init block (lines 12, 21-26)
  2. Add a guard: if `pos.x === 0 && pos.y === 0 && pos.z === 0`, return early
     (do not update camera at all — let Three.js keep the default camera until
     the physics body reports a real position)
  3. Replace the `initialized` ref with a `hasValidPosition` ref that only
     flips to `true` once `pos` is non-zero
  4. When `hasValidPosition` first becomes true, *snap* posRef and lookRef to
     the correct behind-car position (no spring — hard set) and zero all
     velocities in velRef. Then mark initialized
  5. On subsequent frames, run the existing spring-damper logic as-is

### 1.2 — Also guard the Lighting follow-camera against zero position
- **File:** `src/rendering/components/Lighting.tsx`
- **Steps:**
  1. In the `useFrame`, add a similar guard: skip updating
     `dirLightRef.current.position` when `pos` is `{0,0,0}`
  2. This prevents the directional light shadow frustum from centering on the
     origin for one frame and then snapping to the track

### 1.3 — Ensure VehicleController reports the RigidBody position from frame 1
- **File:** `src/physics/VehicleController.ts`
- **Steps:**
  1. In `getState()` / `getPosition()`, when `chassisBody` is null, return a
     sentinel (e.g., `null`) instead of `{0,0,0}` so consumers can distinguish
     "not ready" from "actually at origin"
  2. Update `useVehicleStore.ts` position type to `{x,y,z} | null` and update
     consumers (ChaseCamera, Lighting, RaceHUD minimap) to handle null

### 1.4 — Fix race state not resetting between races
- **File:** `src/stores/useRaceStore.ts`, `src/stores/useGameStore.ts`
- **Steps:**
  1. In `useGameStore.setScene`, when transitioning TO 'menu' (from 'results'
     or 'racing'), call `useRaceStore.getState().resetRace()`
  2. Also reset `useVehicleStore` position/rotation/speed to defaults
  3. Test: Quick Race → finish or return to menu → Quick Race again. State
     should be fresh

### 1.5 — Fix countdown race-start ordering
- **File:** `src/rendering/scenes/RaceScene.tsx` (PlayerCar useFrame)
- **Steps:**
  1. The `useEffect(() => startRace(...), [])` runs *after* the first
     `useFrame` paint. During that first frame, `raceStore.racers` is empty
     and the countdown decrement runs on stale state
  2. Move `startRace()` to a synchronous `useMemo` or call it before the
     component mounts (in `RaceScene` itself, outside of `useEffect`)
  3. Alternatively, guard the countdown decrement in PlayerCar's `useFrame`:
     `if (!raceStore.started && raceStore.racers.length === 0) return;`

---

## Phase 2: Upgrade Environment (Biggest Visual Bang-for-Buck)

The environment is the main source of the "Minecraft" look. Trees are 8-segment
cylinders with flat-plane leaves, buildings are untextured boxes, grandstands
are stacked cubes, and the ground is a single 600x600 plane.

### 2.1 — Replace flat-plane trees with volumetric foliage
- **File:** `src/rendering/components/Environment.tsx` (`InstancedTrees`,
  `computeTreeInstances`)
- **Steps:**
  1. Replace the single `cylinderGeometry args={[0.12, 0.22, 1, 8]}` trunk
     with `args={[0.12, 0.22, 1, 12]}` (12 segments minimum for rounder look)
  2. Replace the flat `planeGeometry` leaf instances with a **billboard cross**
     approach: for each tree, create 3 intersecting planes at 60-degree angles
     (like a snowflake from above). This creates volume from any viewing angle
     using only 6 triangles per tree crown
  3. Create a procedural leaf texture using canvas: draw semi-transparent green
     blob with darker edge variation, apply as `map` on an `alphaTest={0.3}`
     material to get organic-looking edges instead of sharp squares
  4. Vary tree height (already done) but also add random Y-rotation and slight
     lean (random X/Z rotation of ~5 degrees) per instance for natural feel
  5. Add a second tree type: shorter, bushier (palm-like or conifer) with
     different crown shape, mix 70/30 with the main type
  6. Increase tree density — currently 60 sample points with ~1.7 trees each
     (~100 trees). Increase to 120 sample points (~200+ trees) for a fuller
     treeline. Performance is fine with instancing

### 2.2 — Add procedural window/detail textures to buildings
- **File:** `src/rendering/components/Environment.tsx` (`InstancedBuildings`,
  `computeBuildingInstances`)
- **Steps:**
  1. Create a `createBuildingTexture()` function that draws a canvas texture:
     - Base color fill matching the building color
     - Grid of dark rectangles for windows (e.g., 4 columns x 8 rows)
     - Occasional lit (yellow-ish) windows for life
     - Subtle horizontal lines for floor separations
  2. Apply as `map` on the building material. Since buildings use
     `vertexColors`, generate UV coordinates on the boxGeometry or switch to
     a per-building color uniform approach
  3. Alternative simpler approach: use 6 different `CanvasTexture` building
     facades and assign them to buildings round-robin. Each texture is a 256x256
     canvas with drawn windows
  4. Add roof variation: some buildings get a slightly different colored top face
     (darker or with AC unit boxes)

### 2.3 — Improve grandstands with seating rows and structural detail
- **File:** `src/rendering/components/Environment.tsx` (`Grandstand`)
- **Steps:**
  1. Replace the 3 stacked boxes with angled seating tiers (use slightly rotated
     thin boxes to create a stepped/raked appearance)
  2. Add a procedural seats texture: canvas with rows of colored dots/rectangles
     to simulate individual seats. Apply to the tier faces
  3. Add thin horizontal railings between tiers (instanced cylinders or thin boxes)
  4. Add a "FINISH" or sponsor banner mesh across the front of the grandstand
     (a plane with a procedural canvas texture)
  5. Add a few vertical structural columns on the visible sides

### 2.4 — Add distant mountains/hills on the horizon
- **File:** `src/rendering/components/Environment.tsx`
- **Steps:**
  1. Create a `Mountains` component that generates a ring of low-poly mountain
     shapes at distance 300-400 from track center
  2. Use `LatheGeometry` or custom geometry with ~8 radial segments and a noisy
     height profile to create 4-6 mountain peaks
  3. Material: `meshStandardMaterial` with a muted blue-gray color, no shadows
     (too far away), fog will naturally fade them
  4. Place behind the tree line so they're visible above the treeline

### 2.5 — Add trackside fencing between barriers and environment
- **File:** `src/rendering/components/Environment.tsx`
- **Steps:**
  1. Sample the track spline at ~40 points
  2. At each point, place instanced fence posts (thin cylinders) just outside
     the barrier walls
  3. Connect posts with a semi-transparent plane mesh using a procedural
     chain-link or wire texture (`alphaTest` material)
  4. Use `InstancedMesh` for posts, and a single extruded geometry for the
     fence panels

### 2.6 — Improve the ground plane
- **File:** `src/rendering/components/Environment.tsx`
- **Steps:**
  1. Replace single 600x600 plane with 2-3 concentric ground rings:
     - Inner ring (0-20m from track): detailed grass with higher texture repeat
     - Middle ring (20-100m): standard grass
     - Outer ring (100-300m): faded/dusty terrain transitioning to horizon color
  2. Add a procedural normal map to the grass material for micro-surface detail
     (bumpy ground look) — generate via canvas with Perlin-like noise
  3. Add scattered ground detail: small instanced rocks/pebbles near track edges

---

## Phase 3: Upgrade Car Models

The cars are actually fairly detailed already (lofted body with 33 stations x 48
perimeter = ~1500 vertices, plus wheels, lights, interior). The improvements here
are about polish and differentiation.

### 3.1 — Increase body perimeter resolution
- **File:** `src/rendering/components/ProceduralCar.tsx`
- **Steps:**
  1. Change `PERIMETER_PTS` from 48 to 72 (line 35)
  2. Update `buildCrossSectionProfile` to output 37 half-points instead of 25
     (then 37 + 35 mirrored = 72)
  3. Add more interpolation points in the shoulder/fender area for smoother
     curves at the widest point of the car
  4. Update the window geometry indices (`beltIdx`, `roofIdx`) to match new
     profile point count

### 3.2 — Add environment map reflections to car paint
- **File:** `src/rendering/components/ProceduralCar.tsx`, `src/rendering/scenes/RaceScene.tsx`
- **Steps:**
  1. In `RaceScene`, add an `<Environment>` component from `@react-three/drei`
     with a preset (e.g., `"city"` or `"sunset"`) or generate a simple cube
     environment map from the Sky
  2. The `meshPhysicalMaterial` on the car body already has `envMapIntensity: 1.0`
     and high metalness — once an environment map exists in the scene, reflections
     will appear automatically
  3. Alternatively, use `useEnvironment()` from drei to create a PMREM env map
     and set it on the scene

### 3.3 — Add racing livery/decals via procedural canvas texture
- **File:** `src/rendering/components/ProceduralCar.tsx`
- **Steps:**
  1. Create a `createLiveryTexture(carColor, number, stripeColor)` function
     that returns a `CanvasTexture`
  2. Draw: base color fill, a racing stripe (2 parallel lines), a number
     circle on the door area, and subtle sponsor-style rectangles
  3. Generate UV coordinates for the lofted body geometry (longitudinal t
     mapped to U, perimeter angle mapped to V)
  4. Apply the texture as `map` on the body `meshPhysicalMaterial`

### 3.4 — Add brake glow effect
- **File:** `src/rendering/components/ProceduralCar.tsx` (Wheel component)
- **Steps:**
  1. Pass `braking` prop down to `Wheel`
  2. On the brake disc material, set `emissive="#ff3300"` and
     `emissiveIntensity` proportional to brake input (0 when not braking,
     up to 1.5 when fully braking)
  3. Add a small `<pointLight>` inside the wheel well that activates on braking
     for realistic glow bleed

### 3.5 — Add tire tread pattern via procedural normal map
- **File:** `src/rendering/components/ProceduralCar.tsx` (Wheel component)
- **Steps:**
  1. Create a `createTreadNormalMap()` function that draws a canvas-based
     normal map with horizontal grooves
  2. Apply to the tire `meshStandardMaterial` as `normalMap`
  3. This adds surface detail without increasing polygon count

### 3.6 — Animate steering wheel based on steering input
- **File:** `src/rendering/components/ProceduralCar.tsx` (`InteriorSilhouette`)
- **Steps:**
  1. Pass `steeringAngle` prop to `InteriorSilhouette`
  2. Apply rotation to the steering wheel `torusGeometry` mesh:
     `rotation={[0.35, 0, -steeringAngle * 1.5]}`

---

## Phase 4: Track Surface and Detail Improvements

### 4.1 — Add procedural normal map to asphalt
- **File:** `src/rendering/components/Track.tsx`
- **Steps:**
  1. Create `createAsphaltNormalMap()` using canvas: draw noise pattern,
     convert height map to normal map using Sobel-like filter
  2. Apply as `normalMap` on the track surface material
  3. This will make the road look textured/rough under lighting instead of flat

### 4.2 — Add track-side advertising boards
- **File:** `src/rendering/components/Track.tsx` or `Environment.tsx`
- **Steps:**
  1. Sample track spline at 10-15 strategic points (straights, not corners)
  2. Place billboard meshes (planes) facing inward toward the track
  3. Create 3-4 procedural ad textures via canvas (colored rectangles with
     "SPEED" / "TURBO" / brand-style text)
  4. Use `InstancedMesh` with different textures (or a texture atlas)

### 4.3 — Add run-off areas (gravel traps) at corners
- **File:** `src/rendering/components/Track.tsx` or `Environment.tsx`
- **Steps:**
  1. Identify corner sections of the spline (where curvature is high)
  2. Create gravel-colored strip geometry extending outward from the track edge
     at these sections
  3. Use a sandy/beige procedural texture distinct from grass
  4. Optionally add a different physics material for reduced grip

### 4.4 — Add elevation changes to track spline
- **File:** `src/data/tracks/azure-coast.json`
- **Steps:**
  1. Currently all Y values in `spline.points` are 0 (flat track)
  2. Add gentle elevation changes: hills of 2-5m height, a dip section, and
     a slight uphill on the back straight
  3. Ensure the car physics and camera handle non-zero Y correctly (they should,
     since the spline is 3D, but test for visual issues)
  4. Update `bankAngles` to complement the elevation for realistic cornering feel

### 4.5 — Add start/finish gantry structure
- **File:** `src/rendering/components/Environment.tsx` or `Track.tsx`
- **Steps:**
  1. Create a gantry (archway) over the start/finish line
  2. Two vertical pillars (cylinders or boxes) on each side of the track
  3. A horizontal beam across the top
  4. Add a timing screen (plane with emissive material) and a checkered flag
     pattern texture
  5. Position using the existing `startLine` data from Track.tsx

---

## Phase 5: Lighting, Atmosphere, and Post-Processing Polish

### 5.1 — Add environment map for global reflections
- **File:** `src/rendering/scenes/RaceScene.tsx`
- **Steps:**
  1. Add `<Environment preset="sunset" background={false} />` from
     `@react-three/drei` — this provides a cube map that all
     `meshPhysicalMaterial` / `meshStandardMaterial` surfaces will reflect
  2. This single change dramatically improves the look of the car paint,
     chrome, and glass materials already in the scene
  3. Tune `envMapIntensity` on key materials (car paint: 1.5, chrome: 2.0,
     glass: 1.0)

### 5.2 — Add speed-dependent motion blur
- **File:** `src/rendering/effects/PostProcessing.tsx`
- **Steps:**
  1. Import `MotionBlur` from `@react-three/postprocessing` (or use the
     `N8AO` motion-blur alternative)
  2. Make intensity proportional to `useVehicleStore.speedKmh`:
     0 at standstill, max at 200+ km/h
  3. Be conservative with intensity to avoid nausea — max 0.3

### 5.3 — Add subtle depth of field
- **File:** `src/rendering/effects/PostProcessing.tsx`
- **Steps:**
  1. Add `DepthOfField` effect from `@react-three/postprocessing`
  2. Focus on the car (distance = camera-to-car distance, ~8-10 units)
  3. Use very mild bokeh (focalLength: 0.05, bokehScale: 2) so it's barely
     noticeable but adds cinematic quality to distant objects

### 5.4 — Improve fog for atmospheric depth
- **File:** `src/rendering/scenes/RaceScene.tsx`
- **Steps:**
  1. Current fog is `['#c8dff5', 150, 500]` — the near plane of 150 is too
     far, making the environment feel "flat" in the middle distance
  2. Change to `['#c8dff5', 80, 400]` for more atmospheric haze
  3. Consider `<FogExp2>` for a more natural exponential falloff

---

## Phase 6: Audio (Engine, Tires, Collisions)

### 6.1 — Procedural engine audio synthesis
- **File:** `src/audio/EngineAudio.ts` (new file)
- **Steps:**
  1. Create `EngineAudio` class using Web Audio API
  2. Use 3-4 `OscillatorNode`s at harmonic frequencies based on RPM:
     - Base frequency: `rpm / 60 * cylinderCount / 2`
     - Harmonics at 2x, 3x, 4x with decreasing gain
  3. Add a `GainNode` envelope controlled by throttle input
  4. Add a low-pass filter that opens with RPM (higher RPM = brighter sound)
  5. Connect to AudioContext destination
  6. Call `update(rpm, throttle)` from PlayerCar's `useFrame`
  7. Add an `AudioManager` singleton that handles AudioContext creation
     on first user interaction (required by browsers)

### 6.2 — Tire screech audio
- **File:** `src/audio/TireAudio.ts` (new file)
- **Steps:**
  1. Use white noise (`AudioBuffer` filled with random values) through a
     `BiquadFilterNode` (bandpass, ~2000-6000 Hz)
  2. Gain controlled by slip angle/ratio from vehicle state — louder when
     wheels are sliding
  3. Add slight pitch modulation based on speed

### 6.3 — Wind noise
- **File:** `src/audio/WindAudio.ts` (new file)
- **Steps:**
  1. Low-passed white noise with gain proportional to speed
  2. Filter cutoff increases with speed (higher speed = more high-frequency
     wind noise)

### 6.4 — Impact/collision sounds
- **File:** `src/audio/CollisionAudio.ts` (new file)
- **Steps:**
  1. On collision events from Rapier, trigger a short noise burst
  2. Use filtered noise with a fast exponential decay envelope
  3. Intensity based on collision impulse magnitude

---

## Phase 7: Gameplay Features

### 7.1 — Add working pause menu with resume
- **File:** `src/ui/components/PauseMenu.tsx`, `src/engine/InputManager.ts`
- **Steps:**
  1. Ensure Escape key toggles pause state (already partially implemented)
  2. PauseMenu should show Resume, Restart Race, and Quit to Menu buttons
  3. Resume unpauses, Restart resets race state and repositions car, Quit
     goes to menu and resets state (Phase 1.4)

### 7.2 — Add multiple camera views
- **File:** `src/rendering/cameras/ChaseCamera.tsx` (rename to `CameraSystem.tsx`)
- **Steps:**
  1. Add a `cameraMode` to game store: 'chase' | 'hood' | 'bumper' | 'cockpit'
  2. 'chase': existing spring-damper behind car
  3. 'hood': fixed position on hood, looking forward (pos offset [0, bodyH+0.1, halfLen*0.3])
  4. 'bumper': fixed low position at front bumper
  5. 'cockpit': driver eye position inside cabin, slightly off-center left
  6. Cycle through modes with C key (add to InputManager)
  7. On mode switch, snap camera to new position (no spring transition)

### 7.3 — Add working minimap to HUD
- **File:** `src/ui/hud/Minimap.tsx`
- **Steps:**
  1. Render track spline as an SVG path in a fixed-size container
  2. Show player dot (colored) and AI dots on the path
  3. Use `useRaceStore` racer `distanceAlongTrack` (t value) to position dots
     along the SVG path
  4. Rotate minimap so player's forward direction points up (optional)

### 7.4 — Add gamepad/controller support
- **File:** `src/engine/InputManager.ts`
- **Steps:**
  1. Add `Gamepad API` polling in `InputManager.update()`
  2. Map left stick X to steering, right trigger to throttle, left trigger
     to brake
  3. Add deadzone handling (0.15 default)
  4. Button mappings: A = nitro (future), B = handbrake, Start = pause
  5. Add a `controllerConnected` state to settings store for UI feedback

### 7.5 — Add race results screen with stats
- **File:** `src/ui/screens/ResultsScreen.tsx`
- **Steps:**
  1. Show final position, total time, best lap, all lap times
  2. Show AI racer results in a table sorted by position
  3. Add "Restart" and "Back to Menu" buttons
  4. Add a simple animation for the results reveal (fade-in, slide-up)

---

## Phase 8: Performance Optimization

### 8.1 — Add LOD (Level of Detail) for environment objects
- **File:** `src/rendering/components/Environment.tsx`
- **Steps:**
  1. Use `<Detailed>` from drei (or manually with `useFrame` distance check)
  2. Trees: full detail < 50m, simplified (single plane) 50-150m, hidden > 150m
  3. Buildings: full detail < 100m, simplified box > 100m
  4. This reduces draw calls and vertex processing for distant objects

### 8.2 — Add quality presets
- **File:** `src/stores/useSettingsStore.ts`, all rendering components
- **Steps:**
  1. Define presets: Low, Medium, High, Ultra
  2. Each preset controls: shadow map size (1024/2048/4096/4096), post-processing
     (off/basic/full/full), particle count (50%/75%/100%/100%), tree/building
     density (50%/75%/100%/120%)
  3. Add preset selector to SettingsScreen
  4. Pass settings values as props to rendering components

### 8.3 — Reduce material/geometry duplication
- **File:** `src/rendering/components/ProceduralCar.tsx`
- **Steps:**
  1. Many sub-components create identical materials (e.g., `PLASTIC_PROPS` is
     used in ~6 separate `<meshStandardMaterial>` declarations)
  2. Hoist shared materials to module-level `useMemo`/refs so Three.js can
     batch draw calls using the same material reference
  3. Same for repeated geometries (e.g., cylinder for exhaust, door handles)

---

## Recommended Execution Order

For maximum impact in the shortest time:

1. **Phase 1** (camera/race-start bugs) — fixes the broken game start, ~1-2 hours
2. **Phase 5.1** (environment map) — single biggest visual improvement, ~15 min
3. **Phase 2.1** (trees) — removes the most "Minecraft" element, ~1-2 hours
4. **Phase 2.2** (building textures) — second most "Minecraft" element, ~1 hour
5. **Phase 2.4** (mountains) — adds depth to the horizon, ~30 min
6. **Phase 4.1** (asphalt normal map) — makes road look real, ~30 min
7. **Phase 2.3** (grandstands) — improves the start/finish area, ~1 hour
8. **Phase 3.2** (car env reflections) — cars look dramatically better, ~15 min
9. **Phase 6.1** (engine audio) — adds the most impactful missing sense, ~2 hours
10. **Phase 2.6** (ground improvement) — polishes the grass/terrain, ~1 hour
11. Everything else in phase order
