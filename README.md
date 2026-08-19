# Trainer Field Sheet — Playtest v0.4

A dependency-free static web prototype for a Pokémon Trainer D&D class. It is designed for Cloudflare Pages and now uses PokéAPI in the browser for Pokémon, base stats, types, artwork, abilities and legal move data.

## v0.4 changes

- Mega Evolutions are filtered out of the Team Setup Pokémon list and cannot be added directly as team members.
- Pokémon species with Mega varieties gain a **Mega Evolution** control on the Battle Sheet. Pokémon with multiple Mega forms, such as Charizard, also receive a form selector.
- Activating Mega Evolution loads that Mega form's PokéAPI stats, types, artwork and abilities for combat calculations while retaining the base Pokémon's moves, level and HP pool.
- The move-selection panel now includes an editable **D&D Pokémon Level** field so legal/locked moves update without leaving Team Setup.
- If a Pokémon's level is reduced below an equipped level-up move's requirement, the move remains visible but becomes locked and cannot be used until permitted again.


## v0.3 learnset fix

- Fixed level-up moves being incorrectly compared against D&D levels 1–20 using their original Pokémon-game levels 1–100.
- Pokémon level-up requirements now map at **5 Pokémon levels = 1 D&D level** (`ceil(game level / 5)`).
- Locked level-up moves remain visible in the move selectors with their converted requirement instead of disappearing.
- Example: Heatmor's Fire Lash at Pokémon level 35 maps to D&D Pokémon level 7.

## v0.2 changes

- Added a dedicated **Team Setup** tab.
- PokéAPI supplies the searchable Pokémon list and selected Pokémon data.
- Any loaded Pokémon can replace one of the six team slots at a chosen D&D Pokémon level (1–20).
- Four moves can be swapped from that Pokémon's PokéAPI-listed learnset.
- Level-up moves above the Pokémon's current level are filtered out; non-level methods such as machines/tutors remain eligible because item/source restrictions are not yet modelled.
- New Pokémon default to **Trainer not proficient** unless explicitly marked proficient.
- Trainer Proficiency Bonus applies to attack rolls only when that Pokémon is marked proficient.
- PB-based Level 5/10/15 damage milestones also require Trainer proficiency.
- Added PokéAPI artwork and abilities to team setup.
- HP scaling was reduced to the earlier **average + 1** rule.

## Core team rules

- Six team slots.
- Exactly one Pokémon is normally active.
- Only the active Pokémon can use a move.
- Each Pokémon has exactly four equipped moves.
- Each Pokémon keeps its own HP pool.
- At 0 HP a Pokémon is Fainted and cannot be switched in or act.
- Short Rest heals one eligible Pokémon.
- Full Rest fully restores the entire team.

## Current playtest formulae

### Stat Rank

`round(Base Stat / 17)`, with `.5` rounding upward. Default minimum Rank is 1.

### Stat Modifier

`floor((Rank - 5) / 2)`

### Max HP

Level 1 uses the raw Pokémon Base HP.

Each level after Level 1 adds:

`round(Base HP / 10) + 1`

So:

`Max HP = Base HP + (Level - 1) * (round(Base HP / 10) + 1)`

Examples:

- Charizard Base HP 78 → +9 HP per later level.
- Pikachu Base HP 35 → +5 HP per later level.
- Blissey Base HP 255 → +27 HP per later level.

### Move Accuracy

`Accuracy Score = round(8 + Accuracy% / 20)`

`Accuracy Modifier = Accuracy Score - 10`

Damaging moves with no PokéAPI accuracy value are treated as Sure Hit in this prototype. Status moves are resolved manually and do not make a normal attack roll.

### Attack Roll

`d20 + eligible Trainer PB + Offensive Stat Modifier + Accuracy Modifier`

Physical moves use Attack. Special moves use Special Attack.

**Eligible Trainer PB is zero unless the Trainer is marked proficient with that Pokémon.**

### Base Damage Dice

`ceil(Offensive Rank / 2)`

PokéAPI move power is provisionally mapped to die size:

- Power 1–40 → d4
- Power 41–60 → d6
- Power 61–90 → d8
- Power 91–120 → d10
- Power 121+ → d12
- Damaging moves without a conventional power value currently default to d6 and may need bespoke rules later.

The optional milestone rule adds the **eligible** Trainer PB in damage dice at Pokémon Levels 5, 10 and 15. An untrained Pokémon receives no PB milestone dice.

## PokéAPI behaviour

The site requests data directly from `https://pokeapi.co/api/v2` in the user's browser. There is no API key or backend.

The Pokémon endpoint supplies base stats, types, abilities, sprites and move learnsets. The Move endpoint supplies move type, damage class, power, accuracy and effect text. The sheet then converts those values into the homebrew D&D rules above.

The current learnset filter deliberately treats PokéAPI's complete cross-version learnset as the legal pool. Level-up moves are blocked if their listed learn level is above the Pokémon's current D&D level; machine, tutor, egg and similar methods are currently allowed. A later rules pass can add campaign/version restrictions.

If PokéAPI is unavailable, an already-saved team continues to function, but searching/replacing Pokémon or loading new moves requires connectivity.

## Cloudflare Pages deployment

This remains a plain static site. Deploy the contents of this folder with `index.html` at the project root.

For a Git-based Cloudflare Pages project:

- Framework preset: None
- Build command: `exit 0`
- Build output directory: `.`
- Environment variables: none

No Node build, server code, database, API key or Cloudflare Function is required.

## Files

- `index.html` — application shell and tabs
- `styles.css` — responsive UI
- `app.js` — rules, PokéAPI integration, team setup, combat, rests and saves
- `_headers` — basic static security headers

## Playtest note

Trainer proficiency is currently a manual per-Pokémon flag. That is intentional: the class still needs a progression rule defining exactly which species/power tiers a Trainer is proficient commanding at each level. The toggle lets that future rule be tested without hard-coding it prematurely.
