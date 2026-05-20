# Import and Export

frdgBeats can import projects and MIDI, then export projects, MIDI, and WAV.

![Screenshot of the import menu open with frdgBeats project and MIDI file options visible](placeholder:import-menu)

## Import `.frdgbeats`

Use import project to replace the current project with a saved `.frdgbeats` file.

The imported project can include embedded samples and embedded SoundFonts. frdgBeats hydrates those assets during import.

Export your current project before importing if you need to keep it.

## Import MIDI

MIDI import replaces the project with a new SoundFont-based project.

MIDI import does this:

- Reads tempo when available.
- Creates channels from MIDI tracks, channels, banks, and programs.
- Uses SoundFont channels.
- Converts MIDI notes into frdgBeats note events.
- Converts pitch bends into slide-style notes when possible.
- Uses 32-step patterns.
- Maps non-empty imported bars into global playlist pattern clips.
- Leaves empty imported bars blank.

## Export `.frdgbeats`

Project export downloads the full project as JSON with the `.frdgbeats` extension.

Use this for backups and sharing.

Dropped playlist audio clips are embedded so the project stays portable.

## Export MIDI

MIDI export writes arranged note data from the playlist.

It includes:

- Tempo.
- Note pitch.
- Note start.
- Note length.
- Velocity.
- Pitch-bend style slide data where possible.

It does not include synth sounds, samples, SoundFonts, or mixer effects. MIDI is instructions, not audio.

## Export WAV

WAV export renders the audible playlist arrangement to stereo audio.

It includes:

- Synth channels.
- Sample channels.
- SoundFont channels.
- Dropped playlist audio clips.
- Velocity.
- Note length.
- Slides where the render path supports them.
- Enabled channel effects.
- Solo and mute behavior.

WAV is the export you want for posting, sending, or dropping into another editor as audio.

## Progress Popups

Imports and exports show progress popups. Large MIDI files, huge samples, custom SoundFonts, or effect-heavy WAV renders may take a bit.

If the browser looks busy, let it cook. Interrupting file work is the fastest way to invent a new problem.
