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
  "activePattern": 0,
  "playlistTrackCount": 8,
  "playlistPatternClips": [],
  "clips": {},
  "playlistAudioClips": [],
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
- `barCount`: playlist bar count.
- `activePattern`: selected global pattern index.
- `loopRange`: playlist loop range or `null`.
- `playlistTrackCount`: number of FL-style playlist lanes.
- `assets`: embedded or bundled asset references.
- `playlistPatternClips`: global pattern clips placed on the playlist timeline.
- `clips`: legacy channel clip map, kept for old project compatibility.
- `playlistAudioClips`: external audio files dropped onto playlist lanes.
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

Each channel stores its note data for up to 128 global patterns.

Each pattern slot is an array of steps. A global pattern is the same pattern index across every channel, so pattern `1` can contain drums, bass, and keys at the same time.

```json
{
  "note": "C4",
  "offset": 0.5,
  "length": 1,
  "velocity": 1,
  "slideTo": "D4"
}
```

`offset` and `slideTo` are optional. `offset` is the note's fractional start inside the step, used for half-step and quarter-step piano roll placement.

## Legacy Playlist Clips

`clips` is the old channel-based playlist map. It is still read for migration, but new projects use `playlistPatternClips`.

- `null`: empty cell.
- `-1`: legacy disabled cell.
- `0` or higher: pattern index.

The current playlist UI does not edit this map directly.

## Playlist Pattern Clips

`playlistPatternClips` stores FL-style global pattern clips:

```json
{
  "id": "pattern-123",
  "pattern": 0,
  "bar": 0,
  "track": 0
}
```

`pattern`, `bar`, and `track` are zero-based. The UI displays pattern and bar numbers as one-based.

## Playlist Audio Clips

`playlistAudioClips` stores audio files dropped directly onto the playlist:

```json
{
  "id": "audio-123",
  "channelId": "track-1",
  "track": 2,
  "bar": 2,
  "name": "vocal chop",
  "duration": 1.84,
  "asset": {
    "name": "vocal-chop.wav",
    "type": "audio/wav",
    "data": "base64..."
  }
}
```

Audio clip `bar` values are zero-based. The UI displays them as one-based bars.

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
