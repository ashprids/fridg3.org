# Samples and SoundFonts

Samples and SoundFonts are how frdgBeats handles recorded sound.

![Screenshot of a sample channel expanded with sample source, browse button, type selector, keep-duration checkbox, volume, and pan controls](placeholder:sample-channel)

## Sample Channels

A sample channel can use:

- A bundled sample from `/others/frdgbeats/samples/`.
- A custom uploaded audio file.
- The fallback synthetic kick if no sample has loaded yet.

## Sample Modes

Sample channels have three playback modes.

- One-shot: plays the sample forward once.
- Loop: repeats the selected sample region for the note length.
- Reverse: plays the selected sample region backwards.

## Keep Duration

Keep duration tries to preserve the length of a sample when different notes pitch it up or down.

Without keep duration, higher notes get shorter and lower notes get longer, because that is how classic sample playback works.

With keep duration enabled, frdgBeats uses Rubber Band pitch processing when available. If the worker or wasm cannot load, it falls back to the simpler pitch shifter.

## Waveform Editor

The waveform tab is available for sample channels.

![Screenshot of the waveform editor with trim handles, waveform display, note zone lane, zoom controls, and sample scroll bar](placeholder:waveform-editor)

Use it to:

- Drag top handles to trim sample start and end.
- Zoom in and out.
- Scroll through the sample while zoomed.
- Watch the playhead during playback.
- Create note zones in the lower lane.
- Remove a selected note zone.

## Sample Zones

Sample zones map different parts of the sample to different notes.

Right-click in the lower lane of the waveform editor to create a zone. Pick a note or press a keyboard key. That note will play that slice.

Zone notes act like trigger pads: they play their slice at the sample's original pitch and speed instead of transposing it to the note's pitch.

This is great for break chopping and tiny homemade drum kits.

## SoundFont Channels

SoundFont channels use `.sf2` banks.

Bundled banks live in `/others/frdgbeats/soundfonts/`. The default bank is `Roland_SC-55.sf2`.

The channel rack lets each SoundFont channel choose:

- Bank.
- Preset.
- Custom SoundFont upload.
- Volume.
- Pan.

## Global SoundFont Menu

The keyboard button in the toolbar sets all SoundFont channels to the same bank.

Use it when an imported MIDI file has many SoundFont channels and you want to switch the whole project to a different bundled or custom bank.

## Custom SoundFonts

Custom `.sf2` files are parsed in the browser. If you export a `.frdgbeats` project after loading a custom SoundFont, the project can embed that bank so it stays portable.

Large SoundFonts can be slow. That is not you failing. That is just browser audio carrying a piano up six flights of stairs.
