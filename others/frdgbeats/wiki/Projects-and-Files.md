# Projects and Files

frdgBeats projects can live in browser storage or as downloaded files. Use both when the project matters.

![Screenshot of the export menu open with frdgBeats project, MIDI file, and WAV render options visible](placeholder:export-menu)

## Browser Save

The save button stores the current project in `localStorage` under the browser save key. The load button restores that project later.

Browser save is good for quick sessions. It is not a serious backup. Clearing site data, changing browsers, using private browsing, or browser weirdness can wipe it.

## `.frdgbeats` Files

`.frdgbeats` is the native project format. It is JSON, so it can store the full project state in a readable structure.

A project file includes:

- BPM and project name.
- Master volume.
- Step count: 16 or 32.
- Playlist bar count and loop range.
- Channels.
- Patterns.
- Global playlist pattern clips and audio clips.
- Synth settings.
- Sample settings.
- SoundFont settings.
- Mixer effects.
- Automation lanes.
- Embedded custom samples and SoundFonts when exported.

Use export project when you want a real copy.

## Starter Presets

The new project menu can load starter `.frdgbeats` presets from `/others/frdgbeats/presets/`.

Presets are meant to be starting points. They can include channels, sounds, patterns, playlist clips, and arrangement setup.

## Demo Projects

The demo menu loads `.frdgbeats` demos from `/others/frdgbeats/demos/`.

Demos are meant to show what the app can do. Loading one replaces your current project, so export anything important first.

## MIDI Files

frdgBeats can import `.mid` and `.midi` files. MIDI import creates a new project with SoundFont channels mapped from MIDI programs.

MIDI import uses 32-step patterns because MIDI files usually need more timing space than a tiny 16-step loop.

MIDI export creates a standard MIDI file from the playlist arrangement. It includes note timing, note length, velocity, and pitch-bend style slide information where possible.

## WAV Files

WAV export renders the playlist arrangement to a stereo audio file.

The render includes audible channels and enabled mixer effect chains. It is the option you want when you are done and need something people can actually listen to.
