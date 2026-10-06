# SpaceHarrier

A free, retro sci-fi rail shooter in chunky pixel art with 8-bit music, a head nod to the classic arcade "into the screen" shooters. You are a jet-pack astronaut flying over alien plains, through space-station tunnels and across the asteroid belt, blasting an invasion that rushes at you out of the horizon.

**Play it in your browser:** https://nbwillcox.github.io/SpaceHarrier/

Everything is generated in code: the floor and tunnels are drawn per scanline in perspective, all sprites are pixel art built at start-up by a tiny software rasteriser, and all sound effects and music are synthesized with the Web Audio API. There are no image or audio files and no build step. A sibling of [SpaceContra](https://github.com/nbwillcox/SpaceContra), [FSpaceZero](https://github.com/nbwillcox/FSpaceZero), [SpaceBobble](https://github.com/nbwillcox/SpaceBobble) and the rest of the Space series, with the same look and feel.

## Controls

| Action | Keyboard + mouse | Gamepad |
| --- | --- | --- |
| Fly | `WASD` or arrow keys | left stick / d-pad |
| Aim the crosshair | mouse (with no mouse, shots fly straight ahead) | right stick |
| Cannon | tap left click, or hold `Space` / `X` / right click to auto-fire | `A` / left trigger |
| Lock-on | hold left click (or `Shift` / `C`) and sweep the crosshair over enemies, release to launch homing missiles | hold right trigger / bumper, release to fire |
| Bomb | `Q` / `E` / `B` / middle click | `B` / `X` / `Y` |
| Pause | `P` or `Esc` | `Start` |

Menus work with the arrow keys and `Enter`, the mouse, or a gamepad. On ultrawide windows the view simply gets wider, so you see (and fight) more of the battlefield.

## Playing

- **Modes:** Campaign (18 stages in 6 worlds, a boss at the end of every world), Boss Rush (all six bosses back to back, unlocked at stage 12 or after finishing the game) and Endless Run (a seeded run that gets harder every stage). Pick Easy, Normal or Hard.
- **Shield and lives:** each life has a three-pip shield; get hit with no pips left and you lose the life (and one cannon level). Continues and a top-10 score table with three-letter initials are kept in your browser.
- **Upgrade slots:** pickups drop from marked enemies. **P** raises the cannon (single, twin, triple, piercing), **L** raises the lock-on capacity (3, 5, 8, 12 targets), **B** adds a bomb, **S** restores a shield pip, **D** gives you two option drones for a while, and rare 1UPs appear too.
- **Chain and ranks:** destroying things in quick succession builds a chain multiplier (up to x4.5). Each stage ends with an S, A, B or C rank from your hit rate and damage taken, plus a score bonus.
- **Worlds:** Emerald Plains, Orbital Station (tunnels with barriers to thread), Frost Moon, Magma Rift, Asteroid Belt and Void Nebula, with six bosses: the Emerald Wyrm, Warden Mech, Frost Golem, Magma Wyrm, Dreadnought and the Abyss.

## Run locally

It is plain HTML/CSS/JS. Either open `index.html` directly, or serve the folder:

```bash
python -m http.server 8000
```

then visit http://localhost:8000. Handy URL parameters: `?play=1` skips the title and starts a Normal campaign (0 Easy, 1 Normal, 2 Hard), `&stage=N` starts at stage N (1-18), `&mode=bossrush` or `&mode=endless` picks a mode, `&god=1` makes you invulnerable and `?unlock=1` unlocks Boss Rush.

## License and attribution

Licensed under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/): free to play, share and remix **non-commercially**, as long as you give credit and **link back to this repository**: https://github.com/nbwillcox/SpaceHarrier

This is an original game inspired by classic arcade shooters. It uses no assets, names or code from any existing game.
