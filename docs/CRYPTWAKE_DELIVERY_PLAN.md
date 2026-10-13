> **Design target, not implemented feature checklist.** For the currently running alpha and limitations see the repository README. The documents below describe the long-term intended game and editor systems.

# CRYPTWAKE — Implementation and Acceptance Plan
Status: Roadmap, not an implementation progress report.
This document is intentionally practical: deliver small playable slices rather than replacing every old game module in one risky commit.

## Existing code to preserve

- data.js: v1 assets, palette and 16x16 sprite utility. Keep compatible and build an explicit converter.
- game.js: v1 2D gameplay and room code. Retain in a legacy route rather than adding incompatible 3D branches to every function.
- editor.js: v1 Workshop interactions and pixel-brush UX. Reuse design patterns, not its global per-mode state model.
- index.html and style.css: can share colors, responsive affordances, typography and navigation; v2 must use a separate editor state tree.
- GitHub Pages main deployment workflow: adapt to building Vite dist after preview is ready. Do not break current Pages in early phases.

## Milestone 0 — Baseline safety / repository structure

Deliver:
- Ensure existing GitHub Pages project still loads.
- Snapshot/legacy route for 2D game and v1 edit mode.
- Establish TypeScript/Vite/Three.js v2 app under dedicated route, pinned dependencies and a build job.
- Add smoke checks for build, import failures, and missing assets.

Acceptance: v1 runs unchanged; v2 shows a boot screen and error overlay; no localStorage key migration is destructive.

## Milestone 1 — Walkable crypt / strongest visual first

Deliver:
- 3D first-person scene with material palette, one small crypt, an arch, multiple torches, an urn, one locked door.
- Cell-based floor/wall/ceiling generation, independent 3D collision, discrete exploration steps and 90-degree turns.
- First atmosphere presets and controls for distance fog, low-lying height fog, fake light shafts, color grading, dynamic internal resolution.
- First-person interactions and door state changes.

Acceptance: W/S step, A/D strafe, Q/E turn, F inspect and doors; no moving through closed geometry; atmospheric teal and amber presets demonstrably distinct; 60 FPS target measured on desktop, lower-quality fallback available.

## Milestone 2 — Combat-free controller and enemy encounter

Deliver:
- One continuous player transform controlled by ExploreGrid / Alert / CombatFree / Settle state machine.
- Camera free-look, camera-relative WASD combat motor, stamina dodge, guard, melee arc and hit reaction.
- One bone sentry enemy with perception/telegraph/attack/search and pursuit through open door.
- Health/stamina/magic UI, one basic spell and one cursed/heavy weapon placeholder.

Acceptance: enemy aggro exits grid into free mode without teleport or camera cut. After 2.5 sec clear, re-entry occurs only via legal collision-tested grid center; enemies can follow through an open doorway; all combat actions consume appropriate resources.

## Milestone 3 — Unified document and foundational editors

Deliver:
- ProjectDocument v2 loader/saver and safe v1 converter.
- Asset registry, reference validation, dependency tracking, reversible transaction command stack.
- Responsive common workspace, asset browser, inspector, 2D room blueprint + live 3D panel.
- Reimplemented pixel paint material editor with 16/32/64 layers and nearest rendered preview.
- Playtest This Room with isolated save/game state.

Acceptance: paint a brick texture, place on room wall, see live 3D update; undo/redo across tab changes; create room and door sockets; export/import into clean browser with identical scene and no dangling IDs.

## Milestone 4 — Full creation tools

Deliver:
- Dungeon Graph editor (connections, loops, verticality, gates/keys, validation).
- Character creator (primitive parts, pixels, animation states/timeline, AI archetype).
- Prop editor (multi-state meshes, interaction anchors, destructibility).
- Weapon builder (geometry, timings, stats, trail sockets, combat dummy).
- VFX graph editor (emitters, curves, flipbooks, trails, blood/ash), atmosphere/fog tools.
- Encounter authoring (waves, patrols, triggers) and Logic/Secret graph editor.
- Audio asset/ambient placement editor.

Acceptance: independently create one new asset of each kind, put it into a room, use during playtest, close/reopen app, export/import pack and get matching behavior. Every editor must participate in shared undo, autosave, dependency checking and validation.

## Milestone 5 — Playable chapter: The Forgotten Entrance

Deliver:
- Authored 15–20 room interconnected chapter with 2 elevation levels and clear landmarks.
- No opening map, optional discoverable cartography tool, physical clue system and 4 fair secrets.
- Shrine, sanctuary, loot, three enemy archetypes, two spells, three weapon classes, first boss.
- Bell global-state events, optional shortcut and secret route; quick chapter reload.
- Mobile touch tuning and accessible feedback for navigational audio clues.

Acceptance: complete an entire run, uncover a secret via a visible/audible clue, use another route to bypass or return, defeat boss, and recover after death. Save/load restores flags, visited rooms, broken props, door states and found items.

## Milestone 6 — Optimization and release gate

Deliver:
- Runtime frame/fog/draw call profiler; quality presets low/medium/high.
- More robust collision/nav and asset-validation suite; content pack recovery.
- UI/HUD final pass, first-person hit feedback, gore slider, sound quality and captions.
- Browser compatibility and touch/desktop QA.
- Main route v2 after quality gate; legacy 2D retained as alternate route.

Acceptance: no blocker errors in smoke tests, import/export/reference tests pass, target performance measured, no inaccessible mandatory chapters, crash-safe autosaves, and direct link to legacy version.

## Cross-module dependency rules

- content/schema and asset registry are prerequisites for new workshop modules.
- world geometry and collision are prerequisites for locomotion and nav.
- locomotion and combat use the same world model and player entity.
- weapons/characters/VFX/encounters reference common asset IDs and events.
- world logic never directly manipulates UI components; UI subscribes to events.
- editor preview and game runtime instantiate the same scene compiler, never maintain duplicate renderers that disagree about geometry.
- art edits update compiled preview dependency graphs; gameplay edits are versioned and activate on restart of playtest or safe hot reload.

## Tests that should fail if a regression is introduced

1. Player's explore step intersects a wall or locked gate.
2. Attack during a half-completed grid step changes world coordinates discontinuously.
3. Combat settle correction passes through an obstruction or teleports across floors.
4. Door graph reports traversable when 3D passage is physically blocked.
5. Mandatory key is behind its own required lock.
6. A clue has no accessible source or a critical puzzle has no valid solved state.
7. Removing a texture leaves an undisclosed broken material dependency.
8. Cross-editor undo edits the wrong asset after changing tab.
9. Exporting then importing a world changes room topology or weapon attack values.
10. V1 import overwrites the user's v1 saves.
11. High-quality fog causes budget overruns without adaptive preset fallback.
12. A malicious pack contains arbitrary script expressions or huge resource counts.

## Suggested development sequence for first code PRs

PR 1: new v2 app skeleton + legacy preservation + versioned schema.
PR 2: single 3D room + material atlas + fog/torch presets.
PR 3: grid navigation + collision + door sockets.
PR 4: seamless hybrid state machine + one enemy + stamina/magic.
PR 5: unified editor document + room + pixel texture editors.
PR 6: graph/secret tools and vertical slice.
PR 7+: remaining editors, visual polish, tests, content.

The acceptance tests above are the definition of done for features. Designs/documentation, preview-only gizmos and placeholder screenshots must NOT be reported as a finished playable release.
