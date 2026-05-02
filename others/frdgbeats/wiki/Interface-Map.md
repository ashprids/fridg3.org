# Interface Map

frdgBeats has one main screen. Most of the app is split into three zones: the top toolbar, the channel rack, and the editor area.

![Screenshot of frdgBeats with labels pointing to transport controls, tempo, project name, master volume, channel rack, editor tabs, and the piano roll](placeholder:interface-map)

## Top Toolbar

The top toolbar contains the transport and project-wide settings.

- Play or pause starts and stops playback.
- Stop resets playback and can panic-stop hanging sounds.
- Record arms keyboard note recording.
- BPM controls project tempo.
- Beats switches the pattern length between 16 and 32 steps.
- Project name controls the default filename when exporting.
- Master controls final output volume.
- The waveform and meters show current output activity.

## Channel Rack

The channel rack is the left panel. Each channel is one instrument track. Channels can be synths, samples, or SoundFonts.

Collapsed channel cards show the basics: color, name, mute, solo, delete, and expand.

Expanded channel cards show source, instrument controls, volume, pan, and quick step buttons.

## Editor Tabs

The editor is the large panel on the right. It changes depending on the selected tab.

- Piano roll: edit notes in the selected channel pattern.
- Playlist: arrange patterns into rows.
- Mixer: add and edit channel effects.
- Automate: draw parameter changes over steps.
- Waveform: edit sample trim and note zones for sample channels.
- Synth: edit synth settings for synth channels.

The waveform tab only enables when a sample channel is selected. The synth tab only enables when a synth channel is selected.

## Action Buttons

The buttons near the editor tabs handle file and project actions.

- Save: save to browser storage.
- Load: load from browser storage.
- New project: start empty or choose a starter preset.
- Load demos: load bundled demo projects.
- SoundFont menu: set all SoundFont channels to a bundled or custom bank.
- Import: import `.frdgbeats` or MIDI.
- Export: export `.frdgbeats`, MIDI, or WAV.

## Status Text

The status line tells you what just happened: loaded sample, exported MIDI, added effect, import failed, and so on. If something seems weird, read the status before clicking random stuff. Random clicking is how the crime scene gets contaminated.
