> **Design target, not implemented feature checklist.** For the currently running alpha and limitations see the repository README. The documents below describe the long-term intended game and editor systems.

# CRYPTWAKE — Game Design Document
Status: Design specification v0.1 (not a claim of implemented gameplay)
Project: joramvanloenen/CRIPT
Target: First-person dark-fantasy dungeon crawler, desktop browser first, touch-compatible second.

## 1. Creative pillars

1. **Lost by design.** The player enters without a map. Discover routes through landmarks, scratched symbols, silhouettes, sounds, found diagrams, and player-placed marks. No automatic all-seeing minimap.
2. **Slow exploration; fast violence.** Grid-centered navigation encourages inspection; threats trigger seamless free locomotion in the same 3D space. The world never changes to a separate arena.
3. **Physical weapon escalation.** Rusty blades become huge cleavers, hammers, cursed polearms, and grotesque relics. Mass changes timing, arcs, knockback, recovery, and stamina; not simply DPS.
4. **Rooms with authored meaning.** Mini Rogue-inspired branching categories provide structure while 3D architecture, verticality, and world-state interactions prevent generic corridor repetition.
5. **Discoverable systemic secrets.** Hints exist in textures, audio, architecture, NPC dialogue, material reactions, and the layout itself.
6. **Mysterious, cohesive crypt atmosphere.** Low-resolution hand-painted textures, carved architecture, darkness, torch pools, low-lying fog, dust, and occasional huge vaulted spaces.

## 2. Game loop

- Enter a chapter with a simple weapon, lantern, limited provisions, and no map.
- Explore room by room. Read physical clues, listen through doors, inspect props, mark discoveries, and decide which branch to take.
- Fight or evade monsters in fast free-movement combat. Spend health, stamina, magic, consumables, and equipment durability wisely.
- Recover keys, grimoires, relics, weapon parts, and fragments of the dungeon's history. Reveal shortcuts and optional secrets.
- Find a sanctuary, shrine, merchant, or chapter guardian; build toward the next crypt region.
- On death: end the run, retain journal discoveries and selected meta-unlocks, and offer a fresh seeded expedition. Preserve a separate handcrafted campaign option in future.

For the first release, favor carefully authored interconnected floors with lightweight procedural encounter/loot variation. A purely randomized maze would undermine the landmark-based navigation pillar.

## 3. Hybrid locomotion (non-negotiable)

**EXPLORE_GRID**: When safe, the first-person player is centered on navigable cells in a continuous 3D room. W/S step forward/back, A/D strafe, Q/E rotate 90 degrees, F interact. A step takes about 0.24 s with easing; turns about 0.15 s. Buffer one input so keyboard stepping feels quick rather than laggy. Camera bob and limited optional mouse-look are visual only. Stairs, door thresholds, diagonal decor, and height layers are explicit authored connections.

**ALERT**: Trigger when an aggressive enemy sees/hears the player, a trap launches, a weapon/spell is used, damage occurs, or a scripted encounter demands action. Preserve exact camera pose, world transform, velocity, and current room simulation. If mid-step, finish or cancel via collision-safe interpolation; never teleport to a battle zone.

**COMBAT_FREE**: Full WASD camera-relative locomotion, mouse-look, free dodging, circle-strafing, jumping only when explicitly allowed by environment design, guarding, weapon swings, spells, and enemy physical behaviors. Room doors *may* seal for specific encounters, but not by default. Pursuit can span open connected rooms subject to navigation/streaming budget. All combat and exploration share the same collision/nav geometry and stamina/magic resources.

**SETTLE**: Enter after 2.5 seconds with no hostile target in perception range, incoming projectile, recent damage, player attack, or environmental danger. Find the nearest walkable grid center on the *same connected floor*, within 0.45 cell and accessible by swept collision. Blend visually toward that center only if unobstructed; otherwise stay in COMBAT_FREE with an unobtrusive "return to path" hint. Re-align compass facing only when the player releases mouse input; never rotate or move by surprise. Resume EXPLORE_GRID when centered and grounded.

A deliberate temporary free-look key may be added for inspecting high ceilings without entering combat. On mobile, provide separate discrete explore arrows and two virtual sticks during combat.

State transitions: EXPLORE_GRID -> ALERT -> COMBAT_FREE -> SETTLE -> EXPLORE_GRID, with SETTLE -> COMBAT_FREE on any renewed threat. Door interactions and cutscenes are states above locomotion, not substitutes for it.

## 4. Room and dungeon composition

Adopt the eight Mini Rogue-type encounter intentions, **not** its tabletop movement mechanics:

| Family | Typical room | Special behaviors |
| --- | --- | --- |
| Combat | Ossuary, guard room, collapsed chapel | Patrol, horde, ambush, timed waves |
| Trap | Guillotine hall, pendulum crypt | Detect, disarm, redirect, bypass |
| Treasure | Vault, sarcophagus chamber | Optional risk, puzzle, mimic |
| Item | Apothecary, lost armory | Consumables, crafting, equipment |
| Shrine | Idol alcove, blood font | Blessings, curses, resource trades |
| Sanctuary | Cold hearth, abandoned cell | Healing, checkpoint, repairs |
| Tomb | Family mausoleum, memorial | Lore, riddles, undead, heirlooms |
| Merchant | Undertaker, blind archivist | Bargain, trade, limited stocks |

Add Mystery, Secret, Boss, Transition, Landmark, and Empty as overlays or specialized families. A room may be Tomb + Trap + Secret, rather than having exactly one role.

Dungeon graph rules:
- A chapter is an interconnected graph of 12–25 main rooms, 3–7 optional rooms, 2+ loops, and at least one recognizable shortcut; no required path should depend on a secret.
- Chapters include horizontal and vertical travel, with stairs and upper galleries using integer elevation indices and authored ramps/transitions.
- Doors are explicit graph edges with two sockets; each edge may be open, barred, locked, hidden, one-way, or world-state dependent.
- At least one visually distinctive landmark every 3–5 rooms, and a distinct material/light palette per region.
- Generate the critical progression path first, then branches, secrets, encounters, keys, and finally decorations. Validate all locks/keys and return paths with a graph solver.
- Seed controls procedural decisions. Rooms should load from authored prefabs with variations, not random unconstrained blocks.

## 5. Player progression

Resources: Health; Stamina (regen after a short delay, reduced while blocking or sprinting); Magic/Focus (slow regeneration or recover through actions, items, shrines). Attacks consume stamina; spells consume magic; some artifacts consume both.

Weapons have mass class, damage type, stamina cost, wind-up, active frames, recovery, reach, attack arc, guard properties, stagger, armor penetration, and on-hit effects. Suggested classes:
- I: Rusty short sword, hatchet, knife — agile and forgiving.
- II: Longsword, mace, spear — balanced melee.
- III: Battle axe, warhammer, greatsword — weighty arcs and punish windows.
- IV: Executioner's cleaver, spiked maul, hooked halberd — severe stagger and destruction.
- V: Cursed relics with evolving forms, dismemberment bonuses, and costly supernatural abilities.

Gore scales with the fiction and weapon tier, but should depend on hit type/body part/enemy anatomy rather than arbitrary particles. Supply a reduced-gore setting.

Magic schools for initial design:
- Ember: ignition, oil interactions, close-area bursts.
- Frost: slows, brittle armor, temporary platforms across shallow water.
- Veil: reveal hidden runes, project misleading sounds, obscure vision.
- Grave: lifesteal at a cost, bind undead, awaken or pacify crypt mechanisms.
Spells should work on dungeon systems as well as enemies.

Enemy archetypes: bone sentry (telegraphed melee), grave rat swarm (quick low threat), censer cultist (ranged area denial), hollow knight (guard and counter), wisp (magic response), bloated corpse (explodes when overkilled), stone mourner (slow heavy stagger), Bell Keeper (first guardian). AI: idle/listen -> investigate -> telegraph -> attack -> recover -> search -> disengage, driven by authored senses and navmesh/grid portals.

Combat goals: 60 Hz simulation with animation-cancel rules explicitly authored; readable wind-ups; hitstop around 40–90 ms on heavy impact without globally freezing physics; short directional dodge with stamina/invulnerability window; guard/parry timings; environmental collisions and destructible props.

## 6. Discovery and map progression

There is **no starting map or minimap**. Navigation aids unlock diegetically:
- Chalk marks, dropped torches, banners, moved furniture, and custom symbols persist in the current run.
- A found cartographer's journal records only visited rooms and observed links; reveal unexplored edges only if player has a clue.
- Compasses may point toward a theme (noise, magic, shrine) rather than north.
- A spectral mapping spell temporarily illuminates nearby geometry, with a magic cost.

Secret types:
1. Architecture: loose stones, fake walls, crawl spaces, movable tombs.
2. Perception: air drafts, alternate footstep acoustics, colored flame, inscriptions.
3. Mechanisms: pressure plates, rotating statues, synchronized bells.
4. Spell interactions: magical locks, ward removal, reflections.
5. Campaign mysteries: clues and keys across multiple regions.

Every major secret must have at least one fair clue; crucial progression never requires pixel-hunting. Give secrets tags: clueIds, triggerIds, rewards, repeatability, and worldFlags. Analytics/debug view can show secret reachability and discovery conditions.

## 7. The Bell — global dungeon state system

A distant bell occasionally tolls, triggering an authored world-state pulse. Possible consequences: certain doors open, patrol routes alter, cold flames appear, shrines invert, or an undead hunt begins. This is deterministic from chapter seed + bells rung + quest flags, not random uncommunicated punishment. The editor displays active bell phase and can simulate phase transitions.

## 8. Visual and audio direction

Architecture: broad silhouettes and low-poly masonry, stairs and balconies with strong readability, height contrast between cramped passages and monumental halls. Textures: 16x16, 32x32 or 64x64 pixel art, palette constrained, nearest filtering; optional hand-painted roughness/emissive masks. Material accents: amber sandstone, rust and bone, drowned turquoise, black-blue catacombs, pale cathedral shafts.

Atmosphere: dense near-floor height fog, near-black recesses, flickering local flames, 3D volumetric-shaft approximations, dust motes, wet stone, faint distance haze. Avoid excessive bloom and screen noise. Music is sparse; spatial sounds give navigational information. Silence is a mechanic.

Accessibility: configurable motion/head bob, mouse sensitivity, subtitles for sound-based clues, readable UI scaling, reduced gore, colorblind clue redundancy, optional soft navigation assistance after repeated failures, controller remapping.

## 9. Proposed first playable slice

**The Forgotten Entrance**: 15–20 connected rooms; 2 vertical levels; 3 notable landmarks; 4 secrets; 1 sanctuary; 1 shrine; 1 merchant or lore NPC; 3 enemy archetypes; 3 weapon classes; 2 spells; a multi-step drain-water puzzle; The Bell Keeper boss.

Acceptance criteria:
- Zero map at start; optional journal found during play.
- Grid steps and turns feel precise and quick; combat freely moves within the same geometry; settle state never teleports through walls.
- At least two enemies can pursue across an open room doorway.
- Weapon choice clearly changes hit timing, stamina, and impact.
- Fog/lighting remain readable at mobile low settings and convincing at desktop high settings.
- Author one new room, weapon, and secret entirely in the integrated workshop, export the world, import into clean storage, and complete the room in playtest.

## 10. Non-goals for first milestone

Do not initially build network co-op, infinite fully procedural architecture, full-body physics ragdolls, unrestricted script execution in asset packs, complex crafting trees, photoreal volumetrics, or hundreds of weapons. Focus on traversal/combat feel, authored mystery, atmosphere, and integrated editing.
