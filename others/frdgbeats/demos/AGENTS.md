# frdgBeats Demo Project Authoring Guide

This folder stores demo projects for frdgBeats. Demo files must end in `.frdgbeats`; `index.php` lists those files for the in-app demo menu.

Demo projects should show off frdgBeats as a tiny DAW: playlist arrangement, piano roll notes, velocity, note length, instruments, colors, wave unison/detune, SoundFont presets, mixer effects, and automation when it makes the demo clearer or more expressive.

## File Format

A `.frdgbeats` file is JSON. It can also embed imported files as base64 assets. Do not switch demos to zip files unless the app explicitly adds zip import support later; the current supported portable format is still JSON.

Use this top-level shape:

```json
{
  "format": "frdgbeats",
  "version": 1,
  "bpm": 128,
  "projectName": "Demo Name",
  "octave": 2,
  "noteSnap": 0.5,
  "steps": 16,
  "barCount": 4,
  "loopRange": null,
  "assets": {
    "soundfont": null,
    "soundfontUrl": "/others/frdgbeats/soundfonts/Roland_SC-55.sf2"
  },
  "clips": {},
  "selectedId": "lead",
  "channels": []
}
```

Important constants:

- `barCount`: playlist bar rows. New empty projects use `4`; demos can use more when useful, up to `128`.
- `steps`: project-wide pattern column count. Use `16` or `32`. Omit only for legacy files; new demos should include it.
- `clips`: object keyed by channel id. Each value is an array of length `barCount`.
- Clip values:
  - `-1` means disabled and displays as `0`
  - `null` means empty
  - `0` means pattern 1
  - `1` means pattern 2
  - continue up to `127` for pattern 128
- `octave`: piano-roll octave page. Use `1`, `2`, or `3`; each page shows two octaves, covering octaves 1-6 overall.
- `noteSnap`: piano-roll note length snap. Use `1`, `0.5`, or `0.25`; omit only for legacy files.
- `loopRange`: either `null` or `{ "start": 0, "end": 1 }`, using zero-based playlist bar rows.
- `selectedId`: id of the initially selected channel.
- `assets.soundfont`: either `null` or an embedded project-wide SoundFont asset.
- `assets.soundfontUrl`: optional bundled project-wide SoundFont URL. Use `/others/frdgbeats/soundfonts/Roland_SC-55.sf2` for the default bundled bank, or another `.sf2` listed from `/others/frdgbeats/soundfonts/`.

## Embedded Assets

frdgBeats projects can carry imported files inside the `.frdgbeats` JSON. Assets use this shape:

```json
{
  "name": "file-name.sf2",
  "type": "audio/x-soundfont",
  "data": "BASE64_ENCODED_FILE_BYTES"
}
```

Rules:

- `data` is raw file bytes encoded as base64, not a data URL.
- Keep `name` as the original filename when possible.
- Use a useful MIME-ish `type`, for example `audio/x-soundfont`, `audio/wav`, `audio/mpeg`, or `application/octet-stream`.
- Embedded files make demos portable, but they can get huge. Keep demo assets small and intentional.
- For SoundFonts, prefer the bundled default Roland SC-55 at `/others/frdgbeats/soundfonts/Roland_SC-55.sf2` unless the demo specifically needs a custom bank.
- For samples, short one-shots are ideal. Long loops or full tracks are not.

Project-wide SoundFont asset:

```json
"assets": {
  "soundfont": {
    "name": "custom-bank.sf2",
    "type": "audio/x-soundfont",
    "data": "BASE64..."
  }
}
```

When `assets.soundfont` is present, frdgBeats parses it on import and uses it as the active SoundFont bank for SoundFont channels.
When `assets.soundfont` is `null`, demos may set `assets.soundfontUrl` to a bundled `.sf2` file in `/others/frdgbeats/soundfonts/`; the app loads that bank instead of embedding the file in the project JSON.

## Channel Shape

Each channel should look like this:

```json
{
  "id": "lead",
  "name": "lead",
  "source": "synth",
  "color": "#86d3cf",
  "muted": false,
  "solo": false,
  "synthType": "wave-oscillator",
  "synthSettings": {
    "wave": "sawtooth",
    "unison": 4,
    "detune": 0.16
  },
  "volume": 0.42,
  "pan": 0,
  "attack": 0.006,
  "release": 0.11,
  "sampleName": "",
  "sampleAsset": null,
  "soundfontName": "Roland SC-55",
  "soundfontPreset": "Acoustic Grand Piano",
  "soundfontProgram": 0,
  "soundfontBankNumber": 0,
  "activePattern": 0,
  "effects": [],
  "automation": [],
  "patterns": [],
  "pattern": []
}
```

## Sources

Synth instruments:

- `source`: `"synth"`
- `synthType`: a registered synth id from `/others/frdgbeats/synths/`, for example `"wave-oscillator"`, `"analog-mono"`, `"chip-stack"`, or `"glass-fm"`.
- `synthSettings`: object of saved param values declared by that synth's `params`.
- Synth channels use the synth tab for their graphical editor. Keep demo settings intentional enough that opening the synth panel teaches the sound.
- `wave-oscillator` replaces the old wave instrument type and supports classic wave shape, unison, detune, attack, and release settings.
- Good for custom leads, basses, pads, keys, bells, and synthetic drums.

SoundFont instruments:

- `source`: `"soundfont"`
- Use the bundled Roland SC-55 default bank.
- Set `soundfontProgram` to the General MIDI program number, zero-based.
- Set `soundfontBankNumber` to `0` for melodic instruments, `128` for GM drums.
- Set `soundfontPreset` to a readable name. The app resolves the actual preset by bank/program.
- Good showcase choices:
  - `0`: Acoustic Grand Piano
  - `24`: Acoustic Guitar Nylon
  - `33`: Electric Bass Finger
  - `48`: String Ensemble 1
  - `56`: Trumpet
  - `80`: Lead 1 Square
  - `81`: Lead 2 Sawtooth
  - bank `128`, program `0`: drums

Sample instruments:

- `source`: `"sample"`
- `sampleType`: one of `"one-shot"`, `"loop"`, or `"reverse"`.
- `sampleStart` and `sampleEnd`: normalized trim positions from `0` to `1`; keep `sampleEnd` greater than `sampleStart`.
- `sampleZones`: optional array of graphical waveform note mappings created from the waveform tab's right-click zone lane. Each entry is `{ "note": "C4", "start": 0, "end": 0.25 }`; when a sample instrument plays that note, the zone overrides the global `sampleStart`/`sampleEnd`.
- Use `sampleAsset` to embed an imported custom audio file.
- Or set `sampleUrl` to a bundled file from `/others/frdgbeats/samples/` and `sampleSource` to `"bundled"`.
- Set `sampleSource` to `"custom"` when using `sampleAsset`.
- `sampleName` should match the embedded asset name.
- The app decodes `sampleAsset.data` on import and rebuilds the browser-only sample buffer.
- If both `sampleAsset` and `sampleUrl` are empty, sample channels fall back to the synthetic kick behavior.

Example sample channel fields:

```json
{
  "source": "sample",
  "sampleName": "snare.wav",
  "sampleType": "one-shot",
  "sampleSource": "custom",
  "sampleUrl": "",
  "sampleStart": 0,
  "sampleEnd": 1,
  "sampleZones": [],
  "sampleAsset": {
    "name": "snare.wav",
    "type": "audio/wav",
    "data": "BASE64..."
  }
}
```

Custom SoundFont demo:

- Add the SoundFont file to `assets.soundfont`.
- Use `source: "soundfont"` channels.
- Set `soundfontName` to the embedded bank's display name if known.
- Still set `soundfontProgram` and `soundfontBankNumber`; the app resolves presets by bank/program after parsing the embedded SoundFont.

## Patterns

frdgBeats supports 128 patterns per channel. To be explicit and robust, write `patterns` as an array of 128 patterns.

Each pattern is an array of `steps` columns. Supported values are `16` and `32`; 32-column projects play twice as long per pattern as 16-column projects.

Each step may be:

- `[]` for no notes
- an array of note events

Use note event objects:

```json
{ "note": "C4", "length": 1, "velocity": 1, "slideTo": "E4" }
```

Rules:

- `note`: note name like `C4`, `F#3`, `A5`.
- `length`: step length snapped to the project `noteSnap`, max should not run past the end of the pattern.
- `velocity`: number from `0` to `1`.
- `slideTo`: optional note name target for a BeepBox-style pitch slide across the note length. Omit it for normal notes.
- Chords are multiple note objects in the same step.
- Use varied velocities to show the right-click velocity feature.
- Use lengths greater than `1` to show note stretching, and shorter snap values for quick notes.
- Use a few `slideTo` notes to show vertical-drag slide support, especially on leads and basses.
- Put the currently edited pattern in `pattern` too, usually the same array as `patterns[activePattern]`.

Minimal empty patterns generator idea:

```js
const steps = 16;
const emptyPattern = () => Array.from({ length: steps }, () => []);
const patterns = Array.from({ length: 128 }, emptyPattern);
```

## Effects In Demo Projects

Channels can include mixer effects:

```json
{
  "id": "effect-1",
  "type": "delay",
  "enabled": true,
  "settings": {
    "time": 0.24,
    "feedback": 0.32,
    "mix": 0.35
  }
}
```

Use effect `type` ids from `/others/frdgbeats/effects/`.

Current built-in effect ids:

- `distortion`
- `delay`
- `eq`
- `phaser`
- `reverb`

Keep effect chains tasteful. A demo should sound intentional, not like every knob got dragged to maximum for the crime of being visible.

## Automation In Demo Projects

Channels can include an `automation` array. Automation lanes are per-channel but their values are per-pattern, so automation only applies when that specific pattern is selected in piano roll or placed in the playlist. Use them to show movement that would be annoying to fake with duplicated patterns, such as filter sweeps, delay throws, volume fades, or pan motion.

Lane shape:

```json
{
  "id": "automation-lead-cutoff",
  "targetType": "synth",
  "effectId": "",
  "paramId": "cutoff",
  "enabled": true,
  "collapsed": false,
  "mode": "smooth",
  "valuesByPattern": {
    "0": [800, null, null, null, 2400, null, null, null, 6200, null, null, null, 3200, null, null, null]
  }
}
```

Target rules:

- `targetType: "channel"` supports `paramId: "volume"` or `"pan"` and leaves `effectId` empty.
- `targetType: "synth"` targets numeric params declared by the selected synth's `params`; leave `effectId` empty.
- `targetType: "effect"` targets numeric params declared by an effect in the channel's `effects`; set `effectId` to that effect object's `id`.
- `valuesByPattern` is an object keyed by zero-based pattern index as a string. Each value array must be the same length as `steps`.
- Use `null` for blank cells. Omit pattern keys that have no automation.
- `mode: "step"` jumps between explicit points. `mode: "smooth"` interpolates blank cells between numeric points.
- Automation only targets numeric params (`range`/`number`). `select` params are intentionally not automated.
- Do not use one lane-level `values` array for new demos; that is only a legacy migration shape.

Keep automation musical and readable. A few intentional points teach the feature better than every cell being filled with chaos confetti.

## Arrangement Strategy

Use `clips` to map patterns into playlist bar rows.

Example with 4 bars:

```json
"clips": {
  "drums": [0, 0, 0, 0],
  "bass": [-1, 0, 0, 0],
  "lead": [-1, -1, 0, 1],
  "pad": [0, 0, 1, 1]
}
```

Interpretation:

- drums plays pattern 1 in every column
- bass is disabled in column 1, then plays pattern 1
- lead is disabled for rows 1-2, then plays pattern 1, then pattern 2
- pad alternates pattern 1 and pattern 2

## Demo Quality Checklist

Before saving a demo:

- Use a clear `projectName`.
- Keep channel ids stable, lowercase, and unique.
- Give every channel a readable `name`.
- Use different `color` values for scanability.
- Keep `volume` conservative; clipping is boring.
- Pan supporting parts lightly, not hard-left/hard-right unless it is the point.
- Make at least one pattern use note lengths greater than `1`.
- Make at least one pattern use velocities below `1`.
- Include at least one disabled `0` playlist cell via `-1` if it helps show arrangement control.
- Include mixer effects only where they demonstrate a sound.
- Include automation only where it demonstrates useful movement; set obvious lane ids so diffs stay readable.
- Set `selectedId` to the most interesting instrument to inspect first.
- Set `activePattern` on channels to a pattern worth opening.

## Validation

A good quick validation loop:

```sh
php -l others/frdgbeats/demos/index.php
```

Then serve the site and open `/others/frdgbeats/`:

```sh
php -S 127.0.0.1:8082
```

In the app:

- open the demos menu and confirm the file appears
- load it
- press play in playlist view and confirm the arrangement plays
- open piano roll and confirm only the selected instrument/pattern previews
- inspect the mixer and confirm any effects load
- export/import the `.frdgbeats` file once if you changed the schema

## Avoid

- Do not use comments in `.frdgbeats`; JSON does not allow them.
- Do not depend on uploaded user samples or uploaded SoundFonts.
- Do embed required samples/SoundFonts in `sampleAsset` or `assets.soundfont` when portability matters.
- Do not omit `clips`, `channels`, or `patterns`.
- Do not use more bars/channels than needed to make the demo good.
- Do not use random ids every time if you want stable diffs.
