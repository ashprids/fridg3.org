# Channel Rack

The channel rack is where instruments live. Think of each channel as one lane of sound: kick, snare, bass, piano, pad, weird sample, whatever.

![Screenshot of the channel rack with one collapsed channel and one expanded channel showing source, instrument, volume, pan, and step buttons](placeholder:channel-rack)

## Channel Basics

Each channel has:

- A color swatch.
- A name.
- Mute and solo buttons.
- A delete button.
- An expand or minimize button.
- Source controls when expanded.
- Quick step buttons when expanded.

Click a channel to select it. The selected channel controls what the piano roll, mixer, automation view, waveform editor, and synth editor show.

## Channel Sources

The `source` menu chooses how the channel makes sound.

- Synth: uses a registered frdgBeats synth.
- Sample: plays a custom or bundled audio sample.
- SoundFont: plays presets from an `.sf2` SoundFont bank.

Changing source changes which extra controls appear.

## Mute and Solo

Mute silences a channel.

Solo makes only soloed channels play. If any channel is soloed, non-solo channels are ignored during playback and render.

## Volume and Pan

Volume controls channel loudness before the master output.

Pan moves the channel left or right in the stereo field.

Both volume and pan can be automated.

## Quick Step Buttons

The small step buttons in an expanded channel are the fastest way to make a pattern.

Click an empty step to add a default note. Click an active step to clear it.

For sample channels, the default note is `C4`. For synth and SoundFont channels, the default note follows the current octave setting.

Quick steps are great for drums. For melodies, the piano roll is less cursed.

## Naming and Coloring Channels

Click the channel name to edit it. Press Enter to commit or Escape to cancel.

The color swatch affects channel visuals in the rack, piano roll, and playlist. Use colors to keep your brain from melting once the project has more than three tracks.

## Deleting Channels

The delete button removes the channel, its patterns, clips, effects, and automation. frdgBeats keeps at least one channel around.
