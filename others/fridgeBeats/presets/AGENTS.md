# fridgeBeats Preset Authoring Guide

This folder stores starter project presets for fridgeBeats. Presets must end in `.frdgbeats`; `index.php` lists them in the in-app new project menu after the built-in `blank project` option.

Presets are JSON fridgeBeats projects. Keep them lightweight and focused on starting points, not full demo songs. For full showcases, use `/others/fridgeBeats/demos/`.

## Requirements

- Use valid JSON only, no comments.
- Include `format`, `version`, `projectName`, `bpm`, `octave`, `steps`, `barCount`, `assets`, `clips`, `selectedId`, and `channels`.
- Set project-wide `steps` to `16` or `32`; starter presets should usually use `16` unless the preset needs a longer pattern grid.
- Keep `barCount` small unless the preset specifically needs a longer starter arrangement. `4` is the default.
- Set playlist `clips` to `-1` when the row should display disabled pattern `0`.
- Avoid embedded base64 assets unless the preset truly needs them.
- Prefer bundled SoundFonts via `assets.soundfontUrl`, usually `/others/fridgeBeats/soundfonts/Roland_SC-55.sf2`.
- Channels may include `automation`, but starter presets should keep automation empty unless the preset is specifically teaching a moving sound.

## Preset Style

A good preset should create a useful instrument palette with empty or minimal patterns:

- `bass`: usually a `source: "synth"` channel using `wave-oscillator`, `analog-mono`, or another bass-friendly synth.
- `drums`: usually a SoundFont channel using GM drum bank `128`.
- `synth`: use a `synthType` from `/others/fridgeBeats/synths/` when the preset needs a more specific sound.
- `pad`: usually a slower synth with longer attack/release.
- `lead`: usually a brighter synth with modest unison.

Use clear channel names, distinct colors, sane volume levels, and disabled playlist rows by default so users can decide where clips should go.

## Automation

fridgeBeats automation lives on each channel as an `automation` array. Each lane targets channel `volume`/`pan`, a numeric synth param, or a numeric effect param. It stores `targetType`, `effectId`, `paramId`, `enabled`, `mode` (`step` or `smooth`), and `valuesByPattern`, an object keyed by zero-based pattern index. Each pattern's value array must match the project `steps` length.

For presets:

- Use `automation: []` for most channels. Starter presets should feel editable, not pre-baked to death.
- If automation is the point of the preset, keep it obvious: one or two lanes with sparse values.
- Automation must apply only to the pattern whose key appears in `valuesByPattern`; never author one global lane-level value grid for every pattern.
- Use `targetType: "synth"` for synth param motion, `targetType: "effect"` with the matching effect `id` for effect motion, or `targetType: "channel"` for volume/pan.
- Only automate numeric `range`/`number` params declared in synth/effect `params`; select/dropdown params are not automation targets.
- Keep lane ids stable and readable, like `automation-pad-cutoff`.

## Validation

After adding a preset:

```bash
php -l others/fridgeBeats/presets/index.php
node -c others/fridgeBeats/fridgebeats.js
```

Then load `/others/fridgeBeats/`, open the new project menu, and confirm the preset appears and loads without console errors.
