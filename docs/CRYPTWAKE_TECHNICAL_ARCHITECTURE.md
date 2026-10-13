> **Design target, not implemented feature checklist.** For the currently running alpha and limitations see the repository README. The documents below describe the long-term intended game and editor systems.

# CRYPTWAKE — Technical Architecture
Status: Target architecture v0.1; implementation plan, NOT deployed functionality.
Companion documents: CRYPTWAKE_GAME_DESIGN.md, CRYPTWAKE_EDITOR_ARCHITECTURE.md, CRYPTWAKE_DELIVERY_PLAN.md.

## 1. Verified baseline and migration strategy

The current main branch is a zero-build, Canvas 2D top-down game:
- data.js uses D.W=28, D.H=17, 16x16 pixel sprites, array collections named texture/enemy/prop/room, version:1, localStorage key dungeonrun.assets.v1.
- game.js contains a self-contained Game class with top-down collision, room-by-depth rotation, melee, dash, enemy AI, projectiles, particles and HUD.
- editor.js contains the Workshop class with tabs room/texture/enemy/prop, per-asset undo/redo, painting and local persistence.
- index.html and style.css include the app shell and HUD; .github/workflows/pages.yml publishes from main.

DO NOT pretend this is already a 3D game. Preserve the 2D site while a v2 3D entrypoint and content pipeline are developed. Migrate by importing/copying legacy packs; never destructively rewrite dungeonrun.assets.v1.

Migration v1 -> v2:
1. Read and validate old world pack through a separate v1 parser.
2. Convert tile[x,y] into floor cells[x,z] with unit scale. Mark wall tiles as solid voxel volumes or merge perimeter surfaces; avoid rendering buried faces.
3. Convert 16x16 texture sprites into nearest-filtered albedo sheets. Convert enemy/prop sprite pixels into 2D billboards as provisional art; later swap for 3D mesh archetypes while keeping asset IDs.
4. Translate room spawn/exit and enemy/prop positions to transforms on the new plane; generate door sockets or optional synthetic exit connector, with collision-safe placement.
5. Generate empty optional arrays for new schema categories; set room lighting/fog defaults.
6. Show migration report with warnings for unsupported 2D semantics (e.g. lava contact damage or unsupported obstacle topology). Preserve original world pack for export.
7. Save converted content in new IndexedDB database and versioned manifest. Re-running migration must be idempotent.

## 2. Runtime technology

Recommended stack for the new runtime: TypeScript + Vite + Three.js + WebGL2, lightweight physics/collision (custom capsule-vs-static colliders first, optional Rapier if needed), Web Audio for spatial sound, browser IndexedDB for editor saves. Optional WebGPU renderer only after WebGL2 feature parity. The output remains a static GitHub Pages site; GitHub Actions builds and publishes dist/ after cutover.

The current no-build files remain playable until the new entrypoint meets minimum parity. Pin dependency versions in package-lock.json. Do not load editor-only 3D gizmos, texture undo buffers, and graph UI in the production game bundle.

Proposed code organization:

~~~text
legacy/                     # snapshot of existing 2D version (during migration)
src/
  app/                      # view routing, settings, game/editor switch
  core/                     # clock, ECS-lite registry, events, input, ID, math
  content/                  # schema, validation, migration, asset index, import/export
  world/                    # graph, room meshes, doors, floors, props, portals, flags
  movement/                 # grid controller, free controller, locomotion orchestrator
  combat/                   # damage, hit shapes, weapons, stamina, magic, animation
  ai/                       # sensors, decisions, nav, encounters, boss phases
  render/                   # Three renderer, materials, fog, lights, decals, particles
  sound/                    # positional ambiences, impacts, clue acoustics
  ui/                       # HUD, journal, menu, inventory
  editor/
    shell/                  # workspace, panels, commands, project session
    common/                 # selection, transforms, asset picker, preview, undo
    dungeon/                # graph, room layout, topology, door connections
    texture/                # pixel paint, palettes, masks, atlas
    character/              # mesh/voxel tool, animations, AI preset refs
    prop/                   # meshes, states, sockets, physics, interaction
    weapon/                 # form, stats, hit windows, effect associations
    vfx/                    # particle graph, curves, preview, volume gizmos
    encounter/              # spawn waves, trigger regions, states, rewards
    logic/                  # safe node graph for secrets, doors, puzzles
    atmosphere/             # fog, lights, sounds, ambience
  tests/                    # schema, locomotion, dungeon graph, export roundtrip
public/content/             # sample seed world and low-res atlases
docs/
~~~

This layout describes the destination, not directories already present on main.

## 3. World coordinates and authoritative model

World up is +Y. Ground plane is XZ. One navigable logical cell = 1.8 world units (configurable by world pack but fixed per chapter). Room grid coordinates (x,z,level) map to centers ((x+0.5)*cellSize, level*floorHeight, (z+0.5)*cellSize). Default floorHeight 3.2 units, eye height 1.62 units, player capsule radius 0.28 units, standing height 1.72 units. Room footprints need NOT all be the same dimensions.

Maintain three distinct data layers:
- Definition: immutable imported/referenced asset definitions (textures, room prefabs, enemies, weapons, props, triggers).
- Chapter instance: generated or hand-placed room instances with world transform, door graph, random seed and authored overrides.
- Run state: dynamic door state, broken props, enemy health, loot, visited rooms, world flags, fog discoveries, bell phase, checkpoint, player resources.

Never mutate asset definitions during gameplay; instance state and run saves are separate.

World graph: rooms are nodes and doors/stairs/lifts/secret tunnels are edges with validated endpoint sockets and vertical alignment. Every edge references stable IDs. Room boundaries may be visible simultaneously; room is a *streaming/encounter unit*, not a required loading screen or forced lock. Active simulation region = current room + neighboring open room(s), expanded for pursuing enemies.

## 4. Fixed-step runtime and scheduling

Use a 60 Hz fixed simulation timestep (16.667ms) with accumulated time and interpolation for camera/meshes. Clamp catch-up and handle tab/background pause. Render at requestAnimationFrame cadence. Store positions and rotations in engine/world units, not pixels. Shared systems update order:
1. Input snapshot
2. Threat perception/events
3. Locomotion state and player motor
4. AI intent and nav path
5. Physics/collision integration
6. Weapons, spells, collisions, damage and death
7. Triggers, interactables, doors, room and world flags
8. Run-state changes and save debounce
9. Sound/particles presentation events
10. Render interpolation and post effects

One authoritative combat clock and one source of truth for player resources; editor preview sim can create an isolated runtime instance without mutating author data.

Prefer a typed event queue: EnemySpotted, CombatStarted, DamageApplied, DoorChanged, FlagSet, BellRang, SecretDiscovered, RoomVisited, ItemCollected, ResourceSpent. Events include instanceId, tick, sourceId, and payload. Avoid ad-hoc script dependencies across editors.

## 5. Hybrid movement implementation contract

Locomotion model: ExploreGrid | Alert | CombatFree | Settle (refer to game design for player behavior).

Internal state:
- position, yaw, pitch, velocity, grounded
- current cell coordinate, target cell, queued grid command
- active motor mode, timeSinceThreat, lastMovementInput, collision shape
- nearby threats and recent attack/projectile counters
- return-to-grid candidate, line-of-movement validation result

Grid motor starts motion only if occupancy and transition are legal (tile collision, vertical transition, closed doors, enemy blockers); use swept capsule collision along interpolated path. Rotate with eased yaw; do not move the camera model differently from collider position. If attacked during a step, finish/cancel safely, then transfer final transform unchanged to CombatFree.

Free motor uses acceleration/deceleration, camera-relative movement, slope handling, narrow-door collision, stamina-limited dodge and optional sprint. Aim orientation is continuous. Player weapon hit arcs use colliders + swept samples across animation intervals; spell rays use same collision data.

Settle evaluates threats first. Grid re-entry succeeds only if an unobstructed capsule sweep to the nearest valid cell exists within configured tolerance. Otherwise remain free until safe. This prevents correction through walls, unexpected teleports, and possible exploit of enemy AI. Use the *same* door and room collision in both modes.

## 6. Scene construction and rendering

Render path:
- Resolve referenced definition IDs via asset registry.
- Generate room slabs, walls, thresholds, floors, arches, ceilings, stairs and side openings with instancing/merged geometry where possible.
- Use low-poly mesh archetypes for props/characters; billboards are a legacy fallback.
- Generate or update static colliders and graph portals separately from visual triangles.
- Build light probes / ambient values for dark rooms; limit and prioritize shadow-casting lights.
- Upload texture atlas with nearest filtering and authored UV islands; no linear blur. Include optional normal, emissive, roughness and alpha layers at identical pixel dimensions.

Suggested presentation baseline: 640x360 internal resolution with optional dynamic scale, integer-ish upscale where possible, nearest or nearest-mipmap sample settings according to material. Avoid over-aggressive pixel grid snapping on geometry because it creates temporal shimmer on camera movement. Typical floor/wall materials should use one material variant with palette + UV and low texture dimensions.

Atmosphere:
1. Distance fog + height fog in a world-space shader: density increases below configurable waterline/ground reference, with height falloff and color by atmosphere zone.
2. Low-cost fake volumetric shafts: softly animated cones/volumes with depth occlusion for torch beams and light leaks.
3. Optional high-quality volumetrics: half/quarter-resolution ray-marching around selected lights, blue-noise jitter, temporal filtering, reprojection fallback. Disable if GPU cost exceeds budget.
4. Particle fog motes, dust, dripping water, subtle torch flame sprites/meshes.
5. Per-region atmosphere presets (Sandstone Amber, Drowned Teal, Bone Grey, Cathedral Dawn), with local editor overrides.

All fog is a visibility/atmospheric effect. Gameplay visibility, line-of-sight, secret clue fairness, and enemy perception must derive from explicit world rules and vision rays rather than arbitrary frame-based fog appearance.

## 7. Rendering budgets and performance

Targets: desktop mid-range 1080p display at 60 FPS with low internal pixel resolution; mid-range mobile 30 FPS at reduced quality. Use profiling, not guarantees.

Initial budgets (tunable, verify in game):
- 1 active full room plus 1–3 neighboring portals.
- ~100–150 draw calls for typical room view; aggressively batch repeated masonry, stairs, candles.
- 1 shadow-casting main local light with optional second for hero/boss; other lights non-shadowed/faked.
- Fog raymarch 0/8/12 steps for Low/Medium/High, half or quarter res.
- Particles capped by preset with priority-based dropping.
- Texture resolution small and atlas managed; make GPU memory footprint measurable.

Add frame capture metrics: simulation ms, rendering ms, draw calls, active lights, triangle count, fog pass ms, loaded rooms, entity count. Profiling toggles in both game and editor.

## 8. Input, presentation, accessibility

Desktop:
Explore: W/S step, A/D strafe, Q/E turn, F interact, Tab journal (if found), Esc pause.
Combat: WASD movement, mouse look, LMB light strike, R heavy strike, RMB guard/parry, Shift dodge/sprint contextually, 1–4 equipped spells, F interact.
Display state transition only via animation/audio/hud nuance, not disruptive popups. Allow remapping.

Touch: large exploration step/turn UI, context-sensitive combat thumbsticks + attack/guard/dodge/spell buttons, responsive editor UI with separate side panels/drawers. Controller support in later pass.

## 9. Content schema, storage, importing and builds

Content pack format is defined in CRYPTWAKE_EDITOR_ARCHITECTURE.md and the JSON example. Required: version=2, id, manifest, asset indexes/collections, dungeon graphs, room prefabs and optional instance seed. Every authored object has a stable unique ID. Foreign-key validation rejects missing dependencies. Runtime treats pack data as untrusted.

Save authoring sessions in IndexedDB (projects, assets, thumbnail blobs, autosave revisions); use localStorage only for small UI preferences. Support versioned .cryptwake pack export/import (ZIP of manifest + JSON definitions + PNG layers + audio). JSON-only export remains useful for debugging. Content validation happens on import, save, build, and playtest; provide actionable line/path errors.

Do not evaluate script strings imported from packs or place user-authored data directly into HTML. Build logic uses a whitelist typed node graph with whitelisted actions, bounded repeaters and execution budgets.

Tests:
- Schema roundtrip import/export for every asset kind.
- Reference integrity and deletions across editor panels.
- v1 conversion snapshot and no original-data overwrite.
- Door socket alignment, key/lock and dungeon goal reachability.
- Grid step collision and CombatFree -> Settle state transitions.
- Fixed timestep deterministic combat/AI where feasible.
- Performance smoke scene for torches/fog/particles.
- Playtest entering via editor with no full app reload.

## 10. Cutover plan

Phase A: Document and add v2 schema + migration and tests; keep old game unchanged.
Phase B: Build separate /cryptwake/ preview with one 3D room, grid exploration, fog and door.
Phase C: Add same-world free combat and weapons/AI/resources.
Phase D: Create editor shell and shared asset registry/commands, starting room + texture.
Phase E: Expand all editor tabs and level graph, secure logic editor, VFX, character/prop/weapon pipelines.
Phase F: Integrate secrets, journal, bell, multi-floor slice, pack publishing and final UI.
Phase G: Switch main playable entrypoint when new version meets acceptance tests, keep a legacy link/route.
