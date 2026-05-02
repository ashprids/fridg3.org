# frdgBeats User Guide

frdgBeats is a browser-based music sketchpad. It is built for quick loops, tiny arrangements, demo ideas, sample chops, SoundFont parts, synth patches, and exporting a shareable project or audio file without opening a full desktop DAW.

This wiki is the beginner-friendly manual. If you have never used a sequencer before, start with [Quick Start](Quick-Start). If you already know your way around beats and synths, jump to the feature pages.

![Screenshot of the full frdgBeats interface with the channel rack on the left, piano roll in the center, transport along the top, and tabs for playlist, mixer, automate, waveform, and synth](placeholder:full-interface)

## What frdgBeats Can Do

- Build patterns with 16 or 32 steps.
- Use up to 128 patterns per channel.
- Arrange patterns into playlist rows.
- Play synth, sample, and SoundFont channels in the same project.
- Import custom audio samples.
- Use bundled samples and bundled `.sf2` SoundFont banks.
- Upload custom SoundFonts.
- Edit sample trim points and per-note sample zones.
- Add mixer effects per channel.
- Automate channel volume, pan, synth parameters, and effect parameters.
- Save browser projects locally.
- Import and export `.frdgbeats` project files.
- Import `.mid` and `.midi` files.
- Export MIDI and rendered WAV files.

## Good First Path

1. Open [Quick Start](Quick-Start) and make a tiny loop.
2. Read [Channel Rack](Channel-Rack) so the left panel makes sense.
3. Read [Piano Roll](Piano-Roll) for notes, velocity, length, and slides.
4. Read [Playlist](Playlist) when you want an actual song shape.
5. Read [Mixer and Effects](Mixer-and-Effects) and [Automation](Automation) when the loop is no longer embarrassing.

## Important Limitations

frdgBeats is currently desktop-first. The mobile page exists, but the actual DAW interface is disabled there because browser audio, dense grids, and touch layout are a cursed combo right now.

Everything runs in your browser. That is convenient, but it also means heavy SoundFonts, huge samples, and massive effect chains can push weaker devices pretty hard.

## File Types You Will See

- `.frdgbeats`: the native project file. This stores patterns, playlist clips, channels, mixer settings, automation, and embedded imported assets when needed.
- `.mid` or `.midi`: standard MIDI files for import or export.
- `.wav`: rendered stereo audio export.
- `.sf2`: SoundFont bank files used by SoundFont channels.

## Where To Go Next

- New to all of this: [Quick Start](Quick-Start)
- Confused by the screen: [Interface Map](Interface-Map)
- Want drums or samples: [Samples and SoundFonts](Samples-and-SoundFonts)
- Want synth sounds: [Instruments](Instruments)
- Want mixing: [Mixer and Effects](Mixer-and-Effects)
- Want movement over time: [Automation](Automation)
