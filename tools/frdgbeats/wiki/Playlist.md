# Playlist

The playlist turns patterns and audio clips into an arrangement. Think FL Studio style: tracks go down the left, bars go across the top, and clips sit on the timeline.

![Screenshot of the playlist tab with track lanes, bar numbers, pattern clips, and audio clips](placeholder:playlist)

## Tracks And Bars

Rows are generic clip tracks, FL-style.

Columns are bars in the song timeline.

The playlist has 50 independently named and colored tracks. New projects call them `track 1` through `track 50`; scroll vertically to reach the later tracks.

Click a track name to rename it, or click its color swatch to choose a new color. Track labels and colors are separate from instrument channels and are saved with the project.

Right-click a track header and choose **Delete** to remove every pattern and audio clip from that track. The empty track remains available for new clips.

Deleting an instrument channel also clears its linked audio clips and pattern clips that no longer contain any notes. Shared pattern clips remain in place.

Use the plus button at the end of the header to add more bars. Use a bar header's trash button to remove that bar.

## Playlist Tools

The playlist toolbar has draw, paint, delete, and mute tools.

Draw places the selected pattern on an empty lane. Paint uses the same selected pattern for quick repeated placement. Delete removes clips, and mute toggles clip mute without deleting it.

## Pattern Clips

The pattern picker above the playlist only lists global patterns that contain notes. Drag the pattern chip beside it onto a lane to place that pattern.

Drag a pattern onto a lane cell to place it. Pattern clips snap to whole playlist bars and tracks.

Click an empty lane cell to place the selected pattern quickly.

Pattern clips show a small note preview from all channels that have notes in that global pattern, so you can tell clips apart without opening the piano roll.

Click a pattern clip to select its global pattern. Double-click it to jump back into the piano roll for that pattern.

Right-click a pattern clip to delete it. Hold right-click and drag across the playlist to erase every pattern or audio clip under the pointer.

## Audio Clips

Drop an audio file from your file manager onto a playlist lane to add it as an audio clip.

Audio clips play from the bar where they are dropped and are embedded when you export a `.frdgbeats` project.

Drag an audio clip to move it. Use the mute or delete playlist tools, or right-click an audio clip to delete it.

## Starting Playback From A Bar

Use the bar number button to start playback from that bar.

If playback is already running, clicking a bar jumps playback to that bar.

The playlist playhead moves smoothly in real time while playback runs, so the line shows the current position between step boundaries instead of only jumping once per step.

## Looping Bars

The repeat button on each bar toggles the playlist loop range.

You can build a loop range by clicking adjacent bars. When a loop range is active, playback stays inside that bar range.

Click the same single-bar loop again to turn looping off.

## Common Arrangement Workflow

1. Make pattern `1` with drums and bass.
2. Make pattern `2` as a variation.
3. Open playlist.
4. Drag pattern `1` across the bars you want.
5. Drag pattern `2` onto bar `4`.
6. Drop a vocal chop or loop onto an audio lane if the song needs sauce.

That is basically arrangement without the mystical nonsense.
