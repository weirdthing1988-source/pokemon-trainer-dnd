# Trainer Field Sheet — Playtest v0.1

A dependency-free static web prototype for the Pokémon Trainer D&D class concept.

## Included in v0.1

- Six editable Pokémon slots.
- Exactly one active Pokémon at a time.
- Fainted Pokémon (0 HP) cannot be switched in or use moves.
- Four editable moves per Pokémon.
- Physical, Special and Status move categories.
- Sure Hit moves bypass attack rolls.
- Independent Pokémon HP pools.
- Short Rest heals one Pokémon; a setting can restrict this to the active Pokémon.
- Full Rest fully restores all six Pokémon.
- Trainer level controls standard D&D Proficiency Bonus.
- Editable target Physical Defence / Special Defence for quick combat testing.
- Move attack rolls, damage rolls and combat log.
- Local browser saving plus JSON import/export.
- No build step and no external dependencies.

## Current playtest formulae

### Stat Rank

`round(Base Stat / 17)`, with `.5` rounding upward. Default minimum Rank is 1.

### Stat Modifier

`floor((Rank - 5) / 2)`

### Max HP

At Level 1, Max HP equals the raw Base HP.

Each later level adds:

`ceil(Base HP / 2) + 1`

So:

`Max HP = Base HP + (Level - 1) * (ceil(Base HP / 2) + 1)`

### Move Accuracy

`Accuracy Score = round(8 + Accuracy% / 20)`

`Accuracy Modifier = Accuracy Score - 10`

Sure Hit moves skip the attack roll.

### Attack Roll

`d20 + Trainer Proficiency Bonus + Offensive Stat Modifier + Accuracy Modifier`

Physical moves use Attack. Special moves use Special Attack.

### Base Damage Dice

`ceil(Offensive Rank / 2)`

The move supplies the die size (`d4`, `d6`, `d8`, `d10`, or `d12`).

The current optional milestone rule adds the Trainer's current Proficiency Bonus in damage dice at Pokémon levels 5, 10, and 15. This can be disabled in Rules & Settings while playtesting.

## Cloudflare Pages deployment

This is a plain static site. Deploy the contents of this folder with `index.html` at the project root.

For a Git-based Cloudflare Pages project:

- Framework preset: None
- Build command: `exit 0`
- Build output directory: `.` when these files are at the repository root

For Direct Upload, Cloudflare Pages accepts a folder or ZIP through dashboard drag-and-drop. Wrangler Direct Upload expects a folder, for example `npx wrangler pages deploy .`. No server code or environment variables are required.

## Files

- `index.html` — application shell
- `styles.css` — responsive UI
- `app.js` — rules, state, rolling, rests and save/import/export
- `_headers` — basic static security headers

## Purpose

The numbers are intentionally easy to revise. This is a playtest harness first, not a declaration that every current formula is final.
