# Instruments

frdgBeats channels can use synths, samples, or SoundFonts. Pick the source based on what job the channel has.

![Screenshot of the channel source selector showing synth, sample, and SoundFont options](placeholder:instrument-source-menu)

## Synth Channels

Synth channels generate sound in the browser. They are best for basses, leads, pads, plucks, and electronic sounds.

The synth tab becomes available when a synth channel is selected.

## Built-In Synths

Wave Oscillator is the simple built-in synth. It gives you classic oscillator shapes:

- Sine.
- Square.
- Sawtooth.
- Triangle.

It also supports unison, detune, attack, and release.

Nebula Table is a deeper synth with two oscillators, warp, levels, sub, noise, unison, blend, filter, drive, and envelope controls. Use it when Wave Oscillator feels too plain.

## Synth Presets

Some synths provide presets in the synth tab. Choose a preset to overwrite the current synth settings for that channel.

Preset names may be tagged by type:

- `[BA]`: bass.
- `[FX]`: effects.
- `[LD]`: leads.
- `[PD]`: pads.
- `[PL]`: plucks.
- `[SQ]`: sequences.
- `[SY]`: general synth patches.

## Synth Tab

The synth tab shows controls for the selected synth. Some synths have custom graphical editors. Others use normal sliders and menus.

![Screenshot of the synth tab showing the synth picker, preset picker, and parameter controls](placeholder:synth-tab)

Common controls:

- Wave or oscillator type changes the basic tone.
- Unison stacks multiple voices.
- Detune spreads unison voices.
- Attack controls how quickly the sound starts.
- Decay controls how quickly it falls after the initial hit.
- Sustain controls held level.
- Release controls how long it fades after stopping.
- Cutoff and resonance shape brightness.
- Drive adds grit.

## SoundFont Channels

SoundFont channels play sampled instruments from `.sf2` banks. Use them for pianos, orchestral sketches, General MIDI sounds, retro banks, and imported MIDI.

SoundFont controls appear in the channel rack, not the synth tab.

## Sample Channels

Sample channels play audio files. Use them for drums, loops, chops, one-shots, vocals, found sounds, and anything you can load as audio.

Sample channels unlock the waveform tab.
