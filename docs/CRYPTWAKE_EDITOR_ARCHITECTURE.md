> **Design target, not implemented feature checklist.** For the currently running alpha and limitations see the repository README. The documents below describe the long-term intended game and editor systems.

# CRYPTWAKE — Unified World Workshop / Editor Architecture
Status: Full editor specification v0.1. Designed for integration; NOT yet implemented.
Related: CRYPTWAKE_GAME_DESIGN.md; CRYPTWAKE_TECHNICAL_ARCHITECTURE.md; examples/cryptwake-world.v2.json.

## 1. Product concept

**One world, one asset library, many focused editors.** Every panel edits the same loaded ProjectDocument. All game entities resolve through stable asset IDs. A painted stone texture updates walls in the 3D room preview; changing a weapon hit window updates its combat preview; changing a door trigger updates the room graph and playtest.

The current v1 editor's four modes (room, texture, enemy, prop) are a foundation, not the final architecture. Replace editor-specific duplicated states/history with one document model, scoped transactions, central validation, and live dependency tracking.

## 2. Main workspace

Desktop layout:
- Header: project name, Save status, Undo/Redo, Import/Export, Playtest selection, Build pack, settings.
- Left rail: Dungeon, Room, Textures, Characters, Props, Weapons, VFX, Encounters/AI, Logic/Secrets, Atmosphere, Audio, Assets.
- Asset browser: type filters, tags, search, thumbnails, warnings and dependency usages.
- Center workspace: 2D blueprint and live 3D preview as split view; switch to single viewport for art editors; timeline/graph pane docks below as appropriate.
- Right inspector: selected object properties with contextual sections, asset references, raw values, sliders and batch editing.
- Bottom: validation/errors, console, revision history, performance metrics and playtest events.

Responsive design: left rail collapses to tab drawer; inspector becomes bottom sheet; primary canvas keeps aspect/room zoom; touchscreen painting uses pen/draw touch and two-finger pan/zoom. Buttons never overlap the playtest viewport.

Core workflows:
- Select a room node in the dungeon graph -> edit room blueprint -> place 3D props -> assign pixel texture -> add encounter trigger -> Playtest Here, all without losing selection.
- Select a character from a room -> open Character editor in same workspace -> edit sprite/mesh, actions, hitboxes, AI references -> return directly to the room. Undo across panel switches remains valid.
- Clicking any texture on a wall can jump to texture editor, show material usage references, and preview changes in the originating room.

## 3. Shared document, asset registry and transactions

Definitions: ProjectDocument has version, projectId, asset dictionaries, chapters, worldFlags, metadata, and plugin/editor metadata. Asset IDs are stable, collision-resistant strings; *never* key by display name or array index.

Asset registry API design:
- resolve(type,id) -> typed definition or missing-asset sentinel with validation error.
- create(type,data) -> stable ID
- replaceProperties(type,id,patch) -> transactional update
- listReferences(id) -> all consumers including scenes, abilities, templates, presets and logic graphs
- duplicateWithDependencies(id,mode) -> shallow/deep copy with remapped IDs
- remove(id,policy) -> cancel / replace refs / remove orphaned refs
- getThumbnail(id) -> cached 2D/3D preview
- invalidateDependents(id) -> update material atlases, room geometry, UI and runtime previews

History uses reversible commands, NOT serializing the whole asset on every brush stroke:
- SetPropertyCommand, PixelStrokeCommand (sparse before/after), PlaceInstanceCommand, PaintCellsCommand, AddEdgeCommand, ChangeGraphCommand, ReparentCommand.
- Begin / commit transactions for brush strokes, drag operations, multi-object edits.
- Unified undo/redo across *all* editors, max memory budget, coalescing, clean/dirty indicator, and autosave checkpoints.
- Project session emits typed AssetChanged, RoomTopologyChanged, SelectionChanged, DocumentValidated, PlaytestStarted.
- Avoid stale listeners; editor tabs subscribe/unsubscribe on activation.

Stable data rules: no embedded mutable duplicates of shared assets, stable instance IDs, explicit dependency edges, forward-compatible optional fields, versioned migration, and deterministic serialization order where practical.

## 4. Dungeon Graph Editor

Purpose: author the *world graph* separately from individual room content.

Authorable:
- Chapter nodes, weighted room templates, manual room positions, 2D/3D preview footprints, connections, vertical floor layers.
- Door types (open, locked, barred, secret, magical, bell-controlled, one-way), key and flag gates, entrance/exit, shortcuts and boss route.
- Seeded branching rules, optional loops, category quotas, landmark frequency, secret quotas.
- Visited/discovered map overlays for test personas. Graph is authoring-only; it is never automatically displayed to a fresh player.

Validation:
- No dangling or duplicate door edges.
- Both door sockets exist, compatible widths/directions/heights.
- Entrance can reach goal when required items/flags are acquired; keys cannot be hidden beyond their own locks.
- No accidental isolated mandatory room; secret rooms remain optional.
- Difficulty and resource risk previews for main path and dead ends.

## 5. Room / Level Editor

**Two synchronized viewports**:
1. Blueprint: top-down editable cell grid with elevation layers, selectable edge walls and door sockets; separate overlays for collision, floor materials, secrets, encounter regions, nav, water and portals.
2. 3D: orbit/fly camera plus player-eye camera; live gameplay shader, realtime lights/fog, collision debug overlays, transforms/rotation snapping and precise gizmos.

Authoring operations:
- Draw floor cells and wall edges independently; paint solid wall blocks where appropriate. Drag wall runs, pillars, curved arch presets, trim, stairs, floor holes, pits, balconies and vaulted ceiling components.
- Per-cell floor height, ceiling height, material slots, collision flags; water/lava volumes and ramps.
- Add prefab instances of props, enemies, torches, decals, sound emitters, loot containers, gates, hidden switches and VFX anchors.
- Draw door socket at wall edge, validate against graph edge; show visual state open/locked/broken.
- Stamp reusable room fragments, reflect/mirror, rotate, align, snap and multi-select.
- Paint biome/atmosphere volumes and connect global presets.
- Set room tag category, tier, spawn rules, landmark level, secret clues and rest/camp flags.
- Live room randomization preview with deterministic seed. Playtest from a selected player spawn; test previous/current/next room route.

Collision and playability overlays: reachable cells, capsule sweeps, combat free-movement nav, LOS, enemy chase portals, trigger bounds, forbidden snap candidates, occlusion and fog visibility.

## 6. Pixel Texture and Material Editor

Capabilities:
- 16/32/64/128 pixel dimension presets (16–64 standard), arbitrary canvas size within safe limits, transparent pixels and alpha testing.
- Pencil, eraser, line, rectangle, ellipse, flood fill, dithering brushes, shade ramp, palette swap, mirror/symmetry and selection/lasso.
- Pixel layers: albedo, optional height/normal, roughness, emissive, alpha/opacity, damage/wear; customizable palette ramps and palette locks.
- Seamless tile preview and offset paint; UV preview mapped to existing 3D faces; adjacent-texel seam view.
- Variant generator for cracks, stains, moss and damage while keeping the same base composition; optional deterministic palette cycling.
- Nearest-neighbor in preview and exported texture arrays. Export PNG individual layer or atlas; reimport PNG without destroying metadata.
- Brush input matches touch/pen pressure only where meaningful; history coalesces strokes.

Material definitions refer to image asset IDs, tiling scales, emissive settings and physics surface sound IDs. Material preview shows unlit/pixel-lit/fog-lit side by side.

## 7. Character / Enemy Editor

Authoring:
- Low-poly piece-based character assembled from primitive boxes, wedges, planes and extruded pixel silhouettes; optional voxel mesh painting or imported glTF.
- Paint character texture/UV from integrated pixel editor; runtime animation could use simple bone hierarchy or transform animation (the tooling MUST NOT require complex skinning for every enemy).
- Rig/part hierarchy with pivots; clips: idle, movement, alert, wind-up, attack, recoil, block, stun, death and special.
- Timeline for transform keys, frame animations, effect events, hurtbox/hitbox windows and sound triggers. Onion skin/ghost previous pose.
- Stats: health, poise, resistances, speed, senses, reward and corpse/loot behavior.
- AI archetype references, decision-tree/behavior graph settings, patrol points, aggro radius, hearing, follow-portals flag.
- Preview: turntable, authored room light preset, animated combat target and controllable hit-test dummy.
- Reuse common procedural motion and attack libraries so enemy creation remains fast.

Validate animation references, missing part parents, negative hitbox dimensions, unsupported mesh budgets and behavior loops.

## 8. Prop Editor

Geometry: boxes, extrusions, cylinders, trims, modular primitive meshes, glTF import; texture/UV edit in shared Pixel Texture editor.
States: intact, open, closed, broken, locked, hidden, cursed, lit; each state can switch meshes/materials/collision and invoke VFX/SFX.
Interaction sockets: hand point, hinge, lid pivot, loot spawn, break fracture parts, trigger collider, wall/floor attachment anchors.
Logic: can be consumed, pushed, damaged, lit, inspected, hidden/revealed, or signal linked puzzle triggers. Define state transition graphs without arbitrary JS.
Preview the interaction in first person with caption, hand ray, collider debug, and camera.
Examples: urn, torch bracket, iron gate, sarcophagus, rotating statue, bell rope, bookshelf, barrel, vault lever.

## 9. Weapon Editor

Visual construction: low-poly primitives, editable silhouette/extrusion, pixel texture assignment, hands/attachment grips, equip perspective and swing trail anchors.
Combat definition: type, mass, damage, damage type, stamina cost, poise damage, windup/active/recovery windows, reach, attack cone, guard stability, combo branch graph, charged strikes, critical/dismemberment eligibility, durability, enchantments.
Animation/timing preview includes 60 Hz event timeline with collision sweep, camera shake, hitstop, impact, blood/decal VFX and sound.
Dummy targets with armor and anatomical hit zones; damage audit report helps avoid broken balance. Use data-driven attack clips, not logic embedded in weapon mesh files.
Weapons can refer to an ability or curse effect; unknown references should surface immediately in the inspector.

## 10. VFX / Fog / Atmosphere Editor

VFX graph uses typed nodes and curves:
- Emitters: point, cone, box, surface, bone/part anchor, impact normal.
- Modules: spawn rate/burst, lifetime, velocity, drag, gravity, rotation, size over life, color ramp, animation flipbook, collision, spawn child, lighting contribution, decal.
- Emit geometry: pixel sprite, billboard, mesh shard, ribbon/trail, cone/beam.
- Presets: torch flame, ash, frost burst, weapon trail, impact spray, dripping ceiling, magical glyph.
- Preview with timeline scrub, restart, pause, repeat, single-step and simulated stress count.
- Safety: cap particle counts, event recursion, blend/overdraw, dynamic lights and GPU budget; validate invalid graph cycles.

Atmosphere tab:
- Chapter and room presets for height/distance fog, vertical falloff, fog color, near/far density, noise scale/scroll, exposure, ambient color, torch temperature/flicker, glow and shadow quality.
- Gizmos for local fog volumes, light shafts, color fog pockets, dust and ambient sounds.
- Toggle game-quality low/med/high preview and show fog render cost.
- Fog transitions blend continuously across portals; never suddenly pop at room boundaries.

## 11. Encounters and AI Editor

Place enemy spawn groups, waves, patrol routes, zones of interest, sight/hearing radii, guard posts and arena/door policies.
Author trigger patterns: onEnter, onDoorOpen, onLootTaken, onBellPhase, onTimer, onNoise, onFlagChanged.
Spawn table includes weights, tier, max alive, cooldown, team, elite modifier, despawn rules; preview seeded outcome.
Visualize threat/AI perception cones, nav portals, pursuit routes and escape potential. Simulate single encounters or wave sequences in room playtest.

## 12. Logic / Secret / Puzzle Graph Editor

No arbitrary JavaScript execution from authored packs. Use event-condition-action graph:
- Events: OnInteract, OnEnterVolume, OnDamage, OnDoorState, OnItemUsed, OnFlagChanged, OnBellRang, OnSpellHit, OnTimer.
- Conditions: HasItem, FlagEquals, ResourceAtLeast, EnemyCount, BellPhaseEquals, RandomSeeded, PropState, PlayerPosition, VisitedRoom.
- Actions: SetFlag, AnimateProp, ChangeDoor, RevealSecret, SpawnEncounter, GiveLoot, ConsumeResource, PlaySound, TriggerVFX, MovePlatform, ShowLore, RingBell.

Typed sockets and finite local variables; explicit cross-room references. Mark clues and rewards, display dependency diagram. Allow only bounded loops/timers, enforce step budget and detect impossible or cyclic quest dependencies.

Secret authoring workflow: choose concealed wall -> add collision-safe reveal transition -> place clue decals/sounds -> specify discovery/interaction conditions -> test spoiler/unsolved states -> validate reachable reward.

## 13. Audio, content library and localization

Audio panel: spatial ambient loops, occlusion/underwater filters, impacts, footstep surfaces, threat stingers, magical spell sounds, clue sounds and Bell global state. Import compressed audio with metadata and pitch/volume variance.
Asset library: tags, folders/collections, license/source, thumbnails, bulk palette swaps, usage heatmap, cross-project import, safe rename/duplicate/delete, asset dependency inspector.
Texts and clue descriptions go through loc keys and subtitles; do not bake crucial hint words into textures without alternate subtitle/transcription.

## 14. v2 project pack: normalized data contract

Top-level recommended shape:

~~~json
{
  "version": 2,
  "projectId": "cryptwake-demo",
  "name": "The Forgotten Entrance",
  "manifest": { "engine": "cryptwake", "minEngineVersion": "0.2.0" },
  "assets": {
    "textures": {},
    "materials": {},
    "meshes": {},
    "characters": {},
    "props": {},
    "weapons": {},
    "spells": {},
    "vfx": {},
    "sounds": {},
    "roomPrefabs": {},
    "encounters": {},
    "logicGraphs": {},
    "atmospheres": {}
  },
  "chapters": {},
  "worldFlags": {},
  "editor": { "lastOpenAssetId": null }
}
~~~

An asset dictionary is keyed by unique ID, storing objects that include id, name and type-specific data. Scene objects are **instances referencing assets**, not copies. A room prefab provides size, cellSize, elevation, cell surfaces/colliders, wall edges, sockets, placement transforms, local conditions and atmosphere overrides. A chapter graph contains instance nodes and edges joining socket references. A world save refers to chapter ID, seed, visited room instance IDs, instance state overrides, inventory/resources, quest flags and Bell phase.

External PNG/audio content is stored in pack media/ with hash-named files referenced by stable asset IDs; do not stuff multi-megabyte base64 PNG data inside scene JSON. The example pack in examples/ demonstrates topology and a basic clue/secret.

## 15. Validation, build and safety

Validation severities: error (cannot publish), warning (playable but likely unintended), note (optimization/authoring help).
- Schema shape/ranges and unique IDs.
- Missing references, unused/duplicate assets, incompatible texture sizes, invalid UVs.
- Reachability, door alignment, key-before-lock and inter-room traversal.
- Stairs and player capsule continuity between floor heights.
- Secret clue/reward availability and puzzle event graph liveness.
- Out-of-range fog/light parameters, particle caps and active shadow budgets.
- V1 import migration warnings and v2 backward compatibility.

World pack import is untrusted. Strip unsafe fields, reject unknown executable scripts and path traversal in archives, validate ZIP resource sizes, do not inject asset names as HTML, restrict file types, and time-bound graph evaluations. Autosave must keep multiple prior valid revisions, with recovery UI after corrupt data or failed migration.

Build flow: Validate -> resolve dependencies -> pack texture atlases -> prepare static room geometry/LODs -> generate preview thumbnails -> serialize and compress content -> report build stats -> playable URL or downloadable world pack.

## 16. Playtest and debug integration

**Play This Room** launches game engine in isolated run context using currently authored assets. Player spawn may be placed on blueprint. Editor stays one click away; returning from play retains selection and camera.
Debug overlays: nav cells, actual physical collision, threat LOS, room graph links, secret triggers, fog volume boundaries, hitbox events, current resources, combat state transitions, world flags.
Every playable world pack must pass an editor-created run through combat, a door transition, a secret interaction and save/reload.

## 17. Implementation order for the workshop

1. Shared document store, versioned schema, registry, commands, importer/exporter, diagnostics.
2. Room/dungeon graph editing with working 3D preview and correct collision.
3. Pixel texture/material editing integrated with scene UV and thumbnail updates.
4. Place/edit props, enemies and encounter triggers directly in room.
5. Character, weapon and VFX authoring with preview, timelines and asset references.
6. Logic/secret graph, dungeon generator, atmosphere/audio editors, polish and mobile authoring.
7. Publish and test sample world pack, final audit for circular references and exports.

No editor should be considered feature-complete until it can make a new asset from scratch, save, undo, preview in-room, export, import, and use that asset during real gameplay.
