# Piano Roll

The piano roll is where you edit the selected channel's notes inside the selected global pattern.

![Screenshot of the piano roll showing note names on the left, numbered steps across the top, several notes with different lengths, and one slide note](placeholder:piano-roll)

## Patterns

frdgBeats has up to 128 global patterns. The pattern dropdown lists patterns that already contain notes, plus the current empty pattern while you are editing it.

Use `+ new pattern` in the dropdown to jump to the next empty pattern slot.

A single pattern can contain notes for multiple channels. Select a channel to edit that instrument's part inside the current pattern.

## Steps

The grid can be 16 or 32 steps long. Change this with the `beats` selector in the top toolbar.

Changing step count resizes patterns. If a project needs more detail, 32 steps gives more room.

## Placing Notes

Click an empty cell to place a note.

When snap is `1/2` or `1/4`, click inside a cell to place the note on that half-step or quarter-step position.

Right-click an existing note to remove it.

Drag after placing to move the note vertically before letting go.

## Moving Notes

Drag a note block sideways to move it to another step.

Drag it vertically to change pitch.

If the target pitch and step already has a note, frdgBeats avoids stacking the same note in the same cell.

## Note Length

Each note block has a small resize handle. Drag it to change note length.

The note snap menu controls length snapping:

- `1`: whole steps.
- `1/2`: half steps.
- `1/4`: quarter steps.

This affects how precise note lengths can be.

## Velocity

Middle-click a note block to open the velocity popover.

Velocity is note strength. At `100`, the note plays at full strength. Lower values are quieter and visually dimmer.

Velocity is saved in `.frdgbeats` files and exported to MIDI.

## Slides

While resizing or dragging a note, vertical movement can create a slide target. A slide tells synths and MIDI export that the note should bend toward another pitch.

Slides are subtle but useful for bass lines, leads, and pitch-bend style motion.

## Octave

The octave selector changes the two-octave range shown in the piano roll and used by the computer keyboard.

The arrow buttons move every note in the selected pattern up or down one octave.

If you cannot find the note you want, change octave before blaming the app. The note is probably just above or below the current view, hiding like a coward.

## Clear Pattern

The eraser button clears the current global pattern.

It does not delete other patterns, channels, playlist clips, effects, or automation.
