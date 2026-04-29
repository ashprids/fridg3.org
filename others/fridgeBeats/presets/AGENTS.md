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

## Preset Style

A good preset should create a useful instrument palette with empty or minimal patterns:

- `bass`: usually a `source: "synth"` channel using `wave-oscillator`, `analog-mono`, or another bass-friendly synth.
- `drums`: usually a SoundFont channel using GM drum bank `128`.
- `synth`: use a `synthType` from `/others/fridgeBeats/synths/` when the preset needs a more specific sound.
- `pad`: usually a slower synth with longer attack/release.
- `lead`: usually a brighter synth with modest unison.

Use clear channel names, distinct colors, sane volume levels, and disabled playlist rows by default so users can decide where clips should go.

## Validation

After adding a preset:

```bash
php -l others/fridgeBeats/presets/index.php
node -c others/fridgeBeats/fridgebeats.js
```

Then load `/others/fridgeBeats/`, open the new project menu, and confirm the preset appears and loads without console errors.
