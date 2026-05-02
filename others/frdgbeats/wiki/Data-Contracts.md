# Data Contracts

This page is mostly for people who want to understand what a `.frdgbeats` project stores. You do not need this to make music, but it helps if you are editing files, building presets, or debugging imports.

![Screenshot of a text editor showing a formatted .frdgbeats JSON file beside the frdgBeats import menu](placeholder:data-contract-json)

## Project Shape

`.frdgbeats` files are JSON.

The exported top-level object includes:

```json
{
  "format": "frdgbeats",
  "version": 1,
  "bpm": 128,
  "projectName": "Untitled",
  "steps": 16,
  "barCount": 4,
  "clips": {},
  "channels": []
}
```

## Important Top-Level Fields

- `format`: should be `frdgbeats`.
- `version`: project format version.
- `bpm`: project tempo.
- `projectName`: display and export name.
- `octave`: current piano roll octave page.
- `noteSnap`: note length snap value.
- `masterVolume`: final output volume.
- `steps`: `16` or `32`.
- `barCount`: playlist row count.
- `loopRange`: playlist loop range or `null`.
- `assets`: embedded or bundled asset references.
- `clips`: playlist clip map by channel id.
- `selectedId`: selected channel id.
- `channels`: channel array.

## Channel Fields

Channels store:

- `id`
- `name`
- `source`
- `color`
- `muted`
- `solo`
- `collapsed`
- `volume`
- `pan`
- `activePattern`
- `patterns`
- `effects`
- `automation`

Source-specific fields are included too.

## Pattern Data

Each channel has up to 128 patterns.

Each pattern is an array of steps. Each step contains zero or more note events.

```json
{
  "note": "C4",
  "length": 1,
  "velocity": 1,
  "slideTo": "D4"
}
```

`slideTo` is optional.

## Playlist Clips

`clips` is keyed by channel id. Each value is an array matching playlist rows.

- `null`: empty cell.
- `-1`: disabled cell, displayed as `0`.
- `0` or higher: pattern index.

The UI displays pattern indexes as one-based numbers, so stored `0` appears as pattern `1`.

## Assets

The `assets` object can include:

- `soundfont`: embedded custom SoundFont asset.
- `soundfontUrl`: bundled SoundFont URL.

Sample channels can also carry `sampleAsset` for embedded custom audio.

Embedded assets use:

```json
{
  "name": "file.wav",
  "type": "audio/wav",
  "data": "base64..."
}
```

## Effects

Effects store:

- `id`: unique effect instance id.
- `type`: registered effect type.
- `enabled`: whether it runs.
- `collapsed`: UI state.
- `settings`: parameter values.

Effect type ids come from `/others/frdgbeats/effects/`.

## Automation

Automation lives on each channel in `automation`.

Each lane stores:

- `id`
- `targetType`
- `effectId`
- `paramId`
- `enabled`
- `mode`
- `valuesByPattern`

`targetType` can be `channel`, `synth`, or `effect`.

`mode` is `step` or `smooth`.

`valuesByPattern` is keyed by zero-based pattern index. Each value array matches the project step count.

Automation must apply only to the currently selected or playing pattern, not every pattern globally.

## Stable IDs Matter

Synth and effect parameter ids are saved in projects and automation lanes. Changing parameter ids will break old projects. If you are authoring synths or effects, keep ids stable unless you also write migration logic.
