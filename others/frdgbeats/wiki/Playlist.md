# Playlist

The playlist turns patterns into an arrangement. Patterns are the musical chunks. Playlist rows decide when those chunks play.

![Screenshot of the playlist tab with bar rows, channel columns, numbered pattern clips, muted zero clips, loop buttons, and an add-row button](placeholder:playlist)

## Rows and Columns

Rows are bars.

Columns are channels.

Each cell says what pattern that channel should play on that bar.

## Cell States

A playlist cell can be:

- Empty: no clip is set.
- Numbered: play that pattern number.
- `0`: intentionally silent for that channel on that row.

Click a cell to cycle forward. Right-click a cell to cycle backward.

## Starting Playback From a Row

Use the row number button to start playback from that bar.

If playback is already running, clicking a row jumps playback to that row.

## Looping Rows

The repeat button on each row toggles the playlist loop range.

You can build a loop range by clicking adjacent rows. When a loop range is active, playback stays inside that row range.

Click the same single-row loop again to turn looping off.

## Adding and Removing Rows

Use the plus button at the bottom of the playlist to add rows.

Use the trash button on a row to delete it.

frdgBeats supports up to 128 playlist rows.

## Common Arrangement Workflow

1. Make pattern `1` for drums.
2. Make pattern `1` for bass.
3. Make pattern `2` for bass variation.
4. Open playlist.
5. Put drums on every row.
6. Put bass pattern `1` on rows `1` and `2`.
7. Put bass pattern `2` on row `4`.
8. Leave row `3` sparse for breathing room.

That is basically arrangement without the mystical nonsense.
