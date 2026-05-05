# frdgBeats Synth Authoring Guide

This folder contains modular Web Audio synth instruments loaded by frdgBeats. Think tiny browser VSTs: each `.js` file registers one playable instrument and can expose a custom graphical panel in the synth tab.

Every synth GUI is rendered inside a fixed 4:3 stage. Use that space intentionally: big visual displays, meters, patch diagrams, keyboard graphics, or roomy controls are all better than a sad little strip of sliders floating at the top. If a synth has lots of knobs/sliders, prioritize clear controls over decorative flare.

Synths are discovered by `index.php`, which lists every non-hidden `.js` file in this directory. Each synth file must register itself with the browser global:

```js
(function () {
    window.frdgBeatsSynths.register({
        id: 'my-synth',
        name: 'My Synth',
        params: [
            { id: 'cutoff', label: 'cutoff', type: 'range', min: 200, max: 8000, step: 1, default: 2400, unit: 'hz' }
        ],
        presets: [
            { name: 'Warm Lead', settings: { cutoff: 2400 } },
            { name: 'Open Lead', settings: { cutoff: 6200 } }
        ],
        css: '.fb-my-synth { ... }',
        createVoice(context, api) {
            const osc = context.createOscillator();
            const gain = context.createGain();
            osc.frequency.setValueAtTime(api.frequency, api.time);
            osc.connect(gain);
            gain.connect(api.output);
            osc.start(api.time);
            if (api.duration) osc.stop(api.time + api.duration + 0.05);
            return {
                nodes: [osc, gain],
                stop() {
                    const now = context.currentTime;
                    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
                    osc.stop(now + 0.15);
                }
            };
        },
        renderGui(api) {
            const root = document.createElement('div');
            root.className = 'fb-my-synth';
            return root;
        }
    });
})();
```

## Required Shape

- Wrap the file in an IIFE so it does not leak locals.
- Call `window.frdgBeatsSynths.register(...)` exactly once.
- Use a stable lowercase kebab-case `id`. Saved projects store this id.
- Keep `name` short enough for the channel rack and synth tab.
- `createVoice(context, api)` must create fresh Web Audio nodes per note.
- `css`: optional synth-specific CSS. frdgBeats injects it once when the synth registers.
- `renderGui(api)`: optional custom synth UI renderer. Return a DOM node. If omitted, frdgBeats renders default param controls.
- `presets`: optional array of named preset objects. Each preset is `{ name, settings }`.

## Params

Supported param types:

- `range`: rendered as a slider. Use for continuous values.
- `number`: rendered as a numeric input. Use when exact integer-ish values matter.
- `select`: rendered as a select. Provide an `options` array.

Every param should include `id`, `label`, `type`, and `default`. Numeric params should include `min`, `max`, and `step`.

Params are the saved state contract. Even if the GUI uses knobs, pads, fake patch cables, or tiny cursed screens, declare every saved control in `params` so import/export, presets, and automation do not become soup.

The automate tab exposes numeric synth params (`range` and `number`) as per-channel automation targets. Automation values are stored per pattern, so a synth sweep on pattern 1 must not affect pattern 2 unless pattern 2 has its own values. `select` params are saved and preset-capable, but they are not automated.

Automation authoring rules for synth params:

- Keep param `id` values stable. Renaming an id breaks saved projects, presets, demos, and automation lanes targeting that param.
- Numeric params must have sensible `min`, `max`, `step`, and `default` values because automation uses them for clamping, drawing, and readouts.
- Do not hide important sound-shaping values outside `params`; automation cannot target private state.
- If a param should not be automated, it probably should be a `select` mode or internal derived value rather than a numeric public param.

## Presets

Presets appear in the synth tab header beside the synth picker. Selecting one merges `preset.settings` into the current channel's synth settings, clamps everything through `params`, and redraws the synth GUI.

Rules:

- Only include keys declared in `params`.
- Preset names must start with a type tag followed by the name, for example `[SY] Mellow Keys`.
- Supported type tags are:
  - `[BA]` bass
  - `[FX]` effects
  - `[LD]` leads
  - `[PD]` pads
  - `[PL]` plucks
  - `[SQ]` sequences, only when the synth actually has sequencing/arpeggio-style behavior
  - `[SY]` synth/general-purpose patches
- Bundled/production synths should have 10 unique presets for each applicable type. If a type does not fit the synth, skip it, but use as many applicable types as possible.
- Presets should cover real starting points, not microscopic knob nudges nobody will hear.
- Preset `settings` should be complete enough to avoid old channel settings bleeding into the new patch after selection.

## Voice API

`createVoice(context, api)` receives:

- `channel`
- `note`
- `frequency`
- `targetFrequency`: pitch-slide target frequency or `null`
- `time`: scheduled start time
- `duration`: scheduled note duration, or `null` for held keyboard preview notes
- `velocity`: normalized `0` to `1`
- `slideTo`
- `settings`: normalized params for this synth/channel
- `output`: the channel output bus; connect your final node here
- `stepSeconds()`
- `noteFrequency(note)`

Return an object with:

- `nodes`: optional array of nodes/sources to disconnect after scheduled notes
- `stop()`: required for held keyboard notes if the synth sustains

## Web Audio Rules

- Never connect directly to `context.destination`; use `api.output`.
- Create all audio nodes inside `createVoice`; do not share live nodes between notes.
- Schedule attack/release around `api.time` and `api.duration`.
- If `api.targetFrequency` exists, ramp oscillator/carrier frequency toward it during the note.
- Keep output level sane. Browser synths can get rude fast.
- If you make long-lived sources for held notes, implement `stop()` and fade them out before stopping.
- Avoid heavy random generation or giant buffers at load time.

## Custom GUIs

Use `renderGui(api)` for the VST-ish panel. The API object includes:

- `channel`, `definition`
- `settings`: current normalized settings object
- `params`: registered params
- `setParam(paramId, value)`: update a setting and redraw the synth tab
- `stepSeconds()`
- `makeField` and `controls`: small helpers from the default UI

Custom GUIs should:

- Use unique class names prefixed with the synth id, such as `.fb-glass-fm-*`.
- Use real `input`, `select`, or `button` elements for accessibility.
- Call `api.setParam(...)` on input/change so settings save.
- Call `api.setParam(...)` for every automatable control; direct mutation of `api.settings` bypasses save/import/export redraw behavior and makes automation look haunted.
- Fill the 4:3 stage. Set the returned root to `height: 100%` and use CSS grid/flex so the interface feels intentionally framed.
- Avoid relying on global layout beyond font and CSS variables.

## Validation

After adding or changing a synth, run:

```sh
node -c others/frdgbeats/synths/my-synth.js
php -l others/frdgbeats/synths/index.php
node -c others/frdgbeats/frdgbeats.js
```

Then load `/others/frdgbeats/`, make a channel source `synth`, pick your synth, open the synth tab, and check:

- the synth appears in the channel rack selector
- the synth tab enables only for synth channels
- GUI controls save and reload in `.frdgbeats`
- numeric params appear in the automate tab and respond to drawn automation lanes
- piano roll, playlist, and keyboard preview all play notes
- no browser console errors appear
