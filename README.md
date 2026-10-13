# CRIPT — The Undercrypt

A low-resolution first-person dungeon crawler with grid-based exploration, seamless real-time combat and a built-in world workshop.

**Play:** https://joramvanloenen.github.io/CRIPT/

## Current status — alpha 0.2

CRIPТ now contains an actual 3D browser game and integrated asset editing tools. This is a **functional early prototype**, not yet the complete full-featured game outlined in the Cryptwake design. The page uses the pinned Three.js renderer from a public CDN, so the first load needs internet access.

### In-game now

- Sixteen connected dungeon rooms arranged in four regions, with old crypt walls and floors and a fixed first-person camera.
- Deliberate grid-stepped exploration using W/S, A/D and Q/E for turns; combat switches seamlessly to freely moving WASD.
- Three enemy archetypes with pursuit, attack/health handling, hit reactions and deaths.
- Four weapons with different mass, damage, stamina cost, reach and timing; normal and heavy attacks.
- Health, stamina and magic; dodge, ember spell, veil sight, loot and a hidden secret.
- Torch lighting, distance fog, layered low-height mist, stone columns and capitals, pixelated textures, floating sprites, and the first Bell Keeper encounter.
- Procedural Web Audio footsteps, combat, magic and Bell ambience with a sound toggle.
- No map at first. Discover the cartographer's journal and view only visited rooms. Mark locations with chalk.

### The integrated World Workshop

Use the **WORLD WORKSHOP** tab. These editors write to a shared version-2 project and can be tested without reauthoring assets:

| Editor | What works in alpha |
| --- | --- |
| Dungeon | Select connected rooms and see their links |
| Level / Room | Paint walls and floors; place enemies and props; toggle door sockets; adjust atmosphere |
| Pixel Textures | Pencil, brush size, palette, mirror, fill, eraser, pixel size and PNG export |
| Characters | Paint enemy sprite and edit health, attack, speed, aggro and behavior |
| Props | Paint props and edit collision/destructibility/loot metadata |
| Weapons | Edit mass, damage, reach, stamina, speed and blade color |
| VFX | Configure a particle burst's color, life, size, count and gravity |
| Encounters | Define waves, difficulty multiplier and door sealing preferences |
| Secrets / Logic | Edit condition, trigger, reward and hint data |
| Atmosphere | Edit fog color/density, ambient and torch strength |

Undo/redo, browser autosave, validated JSON world export/import, and **PLAYTEST** are provided.

### Limitations still to build

This is not yet a finished "all tools complete" product: no arbitrary expandable dungeon graphs or multiple physical height levels; no full character rigging/animation timeline or mesh modeling; no layered texture/UV mapping; no complete node-based custom logic execution or VFX particle graph; no realistic volumetric raymarching; no detailed gore dismemberment or advanced weapon animations; limited enemy pathfinding; and no fully authored spatial sound effects yet.

The current rooms use a fixed 4×4 graph. The fog uses exponential distance fog and low-lying translucent mist approximations, **not** true ray-marched volumetrics. Additional editor logic/encounter definitions are saved as data but the runtime implements only the starter behaviors. These areas are the planned next development stages.

## Controls

Exploration: **W/S** step, **A/D** strafe, **Q/E** turn 90°, **F** interact, **C** chalk, **M** journal (after finding it).
Combat: **WASD** free movement, mouse look, **left click / Space** strike, **right click** heavy, **Shift** dodge, **1** ember, **2** veil.
**Escape** pauses. Touchscreens have basic on-screen controls.

## Run locally

Open index.html in a browser. If local browser security interferes, from the repository directory run:

    python -m http.server 8080

Then open http://localhost:8080/.

## Files

- index.html — game shell and editor UI
- style.css — atmospheric layouts and responsive controls
- data.js — v2 world content, pixel assets, validation and local persistence
- game.js — Three.js renderer, hybrid movement, combat and world interactions
- audio.js — procedural sound, ambience and interface toggle
- editor.js — shared workshop and pixel paint tools
- tests/world.test.cjs — automated topology and asset consistency checks
- .github/workflows/pages.yml — deployment from main
- .github/workflows/checks.yml — Node syntax/data checks

All user edits are stored locally in the browser under **cript.project.v2**. Export a JSON file before clearing browser data. Sharing between devices requires exporting/importing the world pack.

## Next releases

1. More expressive room editing with overlapping vertical floors and a truly editable room graph.
2. Collision-safe enemy pathfinding and free-combat polish.
3. Pixel material layers, custom low-poly mesh authoring and character animation.
4. VFX timeline, full logic graphs, authorable secrets and encounter scripts.
5. Deeper bosses, environmental puzzles, escalating gore, spatial audio and higher-quality fog.
6. Browser usability/performance checks, mobile optimization and user-facing content tutorials.

## Design documents (planned feature targets)

- [Gameplay and mechanics](docs/CRYPTWAKE_GAME_DESIGN.md)
- [3D technical architecture](docs/CRYPTWAKE_TECHNICAL_ARCHITECTURE.md)
- [Integrated editor design](docs/CRYPTWAKE_EDITOR_ARCHITECTURE.md)
- [Milestones and acceptance gates](docs/CRYPTWAKE_DELIVERY_PLAN.md)

These documents define the intended completed version. The current alpha is only the first implementation phase.
