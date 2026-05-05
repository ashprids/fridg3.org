# Keyboard Shortcuts

frdgBeats supports computer keyboard note input. It is useful for previewing sounds and recording quick ideas.

![Screenshot of the record button enabled while a synth channel is selected and notes appear in the piano roll](placeholder:keyboard-recording)

## Note Keyboard

The keyboard layout is similar to common DAW piano input.

Lower row:

```text
z s x d c v g b h n j m
```

Upper row:

```text
q 2 w 3 e r 5 t 6 y 7 u
```

Some British keyboard keys are also mapped:

```text
, l . ; /
i 9 o 0 p [ = ]
- ' # \
```

The octave selector changes the note range.

## Previewing Notes

Select a channel and press a mapped key. The selected channel plays that note.

This works for synth, sample, and SoundFont channels.

## Recording Notes

The record button arms note recording from the keyboard.

While recording, key presses can place notes into the selected pattern as playback moves.

For clean results:

- Select the channel first.
- Select the pattern first.
- Set the octave first.
- Start playback.
- Record short ideas, then clean them up in the piano roll.

## Mouse Controls

- Space: play or pause when focus is not inside a form control.
- Click empty piano roll cell: add note.
- Right-click note block: remove note.
- Middle-click note block: edit velocity.
- Drag note block sideways: move note timing.
- Drag note block vertically: change note pitch.
- Drag resize handle: change note length.
- Pick non-empty pattern from playlist dropdown, then drag pattern chip to lane: place pattern.
- Drag playlist clip: move clip.
- Right-click pattern clip: delete pattern clip.
- Drop audio file on playlist lane: add audio clip.
- Right-click audio clip: delete audio clip.
- Right-click waveform zone lane: create sample zone.
- Right-click automation cell: clear automation value.
- Shift-click automation cell: clear automation value.

## Browser Focus

Keyboard input only works when the page has focus. If keys stop working, click inside frdgBeats and try again.

Also, browser shortcuts still exist. If a key combo belongs to the browser, the browser may steal it. Browsers are rude like that.
