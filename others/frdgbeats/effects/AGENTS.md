# frdgBeats Effect Authoring Guide

This folder contains modular Web Audio effects loaded by frdgBeats. Each effect should have its own graphical design.

Effects are discovered by `index.php`, which lists every non-hidden `.js` file in this directory. Each effect file must register itself with the browser global:

```js
(function () {
    window.frdgBeatsEffects.register({
        id: 'my-effect',
        name: 'My Effect',
        params: [
            { id: 'mix', label: 'mix', type: 'range', min: 0, max: 1, step: 0.01, default: 0.5 }
        ],
        presets: [
            { name: 'Subtle', settings: { mix: 0.25 } },
            { name: 'Medium', settings: { mix: 0.45 } },
            { name: 'Wide', settings: { mix: 0.6 } },
            { name: 'Dense', settings: { mix: 0.72 } },
            { name: 'Extreme', settings: { mix: 0.85 } }
        ],
        css: '.my-effect-ui { ... }',
        create(context, settings) {
            const input = context.createGain();
            const output = context.createGain();
            input.connect(output);
            return { input, output, nodes: [] };
        },
        renderGui(api) {
            const root = document.createElement('div');
            root.className = 'my-effect-ui';
            return root;
        }
    });
})();
```

## Required Shape

- Wrap the file in an IIFE so it does not leak locals.
- Call `window.frdgBeatsEffects.register(...)` exactly once.
- Use a stable lowercase kebab-case `id`. Saved projects store this id.
- Keep `name` short enough for the mixer UI.
- `create(context, settings)` must return an object with:
  - `input`: first Web Audio node in the effect chain
  - `output`: final Web Audio node in the effect chain
  - `nodes`: optional array of every extra node that should be disconnected/stopped when the chain rebuilds
- `css`: optional string of effect-specific CSS. frdgBeats injects it once when the effect registers.
- `renderGui(api)`: optional custom mixer UI renderer. Return a DOM node. If omitted, frdgBeats renders the normal param controls.
- `presets`: optional array of named preset objects. Each preset is `{ name, settings }`.

## Params

Supported param types:

- `range`: rendered as a slider. Use for continuous values.
- `number`: rendered as a numeric input. Use when exact integer-ish values matter.
- `select`: rendered as a select. Provide an `options` array.

Every param should include:

- `id`: stable saved setting key
- `label`: short UI label
- `type`
- `default`

For numeric params include `min`, `max`, and `step`.

Params are still important for custom GUIs: they define defaults, saved setting keys, clamping, summaries while the effect is minimized, and automation targets.

The automate tab exposes numeric effect params (`range` and `number`) for every enabled or bypassed effect on a channel. Automation values are stored per pattern, so an effect throw on pattern 1 must not affect pattern 2 unless pattern 2 has its own values. `select` params stay saved/preset-capable, but they are not automation targets.

Automation authoring rules for effects:

- Keep effect `id`, effect instance `id`, and param `id` behavior stable. Automation lanes targeting effects store the effect instance `id` plus `paramId`.
- Numeric params must include sensible `min`, `max`, `step`, and `default` values because automation uses those for clamping and grid drawing.
- If changing a param should affect the live Web Audio chain, make sure `api.setParam(...)` is used in the GUI so frdgBeats can rebuild the channel output.
- Avoid hiding meaningful numeric state outside `params`; private state cannot be automated or preserved cleanly.

## Presets

Presets appear above the effect GUI while the effect card is expanded. Selecting one merges `preset.settings` into the current effect settings, clamps the result through `params`, rebuilds audio, and redraws the GUI.

Rules:

- Use clear use-case names such as `Cathedral`, `Guitar Amp`, `Crushed Drums`, or `Vocal Plate`.
- Only include keys declared in `params`.
- Presets should be useful starting points, not tiny variations nobody can tell apart.
- Include at least five presets for production effects. If an effect truly has fewer than five meaningful modes, redesign the params or use-case coverage until five useful starting points exist.

Example:

```js
{ id: 'feedback', label: 'feedback', type: 'range', min: 0, max: 0.88, step: 0.01, default: 0.28 }
```

## Web Audio Rules

- Build all nodes inside `create`; do not share node instances between channels.
- Do not connect directly to `context.destination`; frdgBeats connects your effect output into the channel bus.
- For dry/wet effects, create explicit dry and wet gain paths.
- Clamp feedback below `1` to avoid runaway sound.
- If you create oscillators or other scheduled sources, call `.start()` in `create` and include them in `nodes` so frdgBeats can stop/disconnect them.
- Avoid huge buffers or long random generation at load time. Reverb impulses are okay if they are created inside `create` from bounded params.
- Keep output level sane. If an effect can get loud, include a mix/output gain stage.

## Custom GUIs

Use `renderGui(api)` when an effect needs its own interface. The API object includes:

- `channel`, `effect`, `definition`
- `settings`: current normalized settings object
- `params`: the registered params array
- `setParam(paramId, value)`: update a setting, clamp it through the param definition, save it, and rebuild the channel output
- `rebuild()`: rebuild the channel output manually
- `stepSeconds()`: current project 16th-note duration, useful for BPM-synced effects
- `makeField` and `controls`: small helpers from the default UI

Custom GUIs should:

- Use unique class names prefixed with the effect id, such as `.fb-delay-*`.
- Keep controls keyboard-accessible by using real `input`, `select`, or `button` elements.
- Call `api.setParam(...)` on input/change so settings save and playback updates.
- Use `api.setParam(...)` for automatable controls; direct mutation of `api.settings` can desync the mixer GUI, saved project JSON, and automation playback.
- Still declare every saved control in `params`, even if the UI uses knobs, pads, or buttons instead of default sliders.
- Do not leave raw browser sliders visible in custom GUIs. If a range input is used for interaction/accessibility, visually integrate or hide it so the custom control surface is what the user actually sees and grabs.
- Avoid relying on global app layout styles beyond font and CSS variables.

Mixer effect cards can be minimized or expanded by the user. Minimized cards show a short summary generated from the first few params.

## Good Starter Patterns

Distortion:

- `input -> dry -> output`
- `input -> waveShaper -> wet -> output`
- Use `WaveShaperNode.curve` and `oversample = '4x'`.

Delay:

- `input -> dry -> output`
- `input -> delay -> filter -> wet -> output`
- `filter -> feedback -> delay`
- Keep feedback max around `0.88`.

EQ:

- Chain `lowshelf -> peaking -> highshelf`.
- Use dB params such as `-18` to `18`.
- For graphical EQs, use draggable points on a log-frequency graph and keep the saved state in normal `params` so presets/import/export still work.

Phaser:

- Use several `allpass` filters.
- Modulate their frequencies with an LFO.
- Put the LFO and gain node in `nodes`.

Flanger:

- Use a very short `DelayNode` modulated by an LFO.
- Keep feedback clamped safely below `1`.
- Blend dry and wet paths so the combing can be subtle or extreme.

Chorus:

- Use two short modulated delays with slightly different rates/depths.
- Avoid heavy feedback; chorus should thicken rather than self-oscillate.
- Keep dry/wet balance conservative for bass-focused presets.

Reverb:

- Use `ConvolverNode`.
- Generate a bounded stereo impulse buffer in `create`.
- Add a lowpass after the convolver to avoid harsh tails.

## Validation

After adding or changing an effect, run:

```sh
node -c others/frdgbeats/effects/my-effect.js
php -l others/frdgbeats/effects/index.php
```

Then load `/others/frdgbeats/`, open the mixer tab, add the effect to a channel, and check:

- the effect appears in the picker
- params render correctly
- numeric params appear in the automate tab and respond to drawn automation lanes
- bypass/remove/reorder works
- playback remains audible
- no browser console errors appear
