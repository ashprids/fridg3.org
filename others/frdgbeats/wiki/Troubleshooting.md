# Troubleshooting

When something breaks, start with the small checks. Deep fixes come later. Debugging is a crime scene; first question is always what changed.

![Screenshot of the status line showing an import or load failure message](placeholder:status-error)

## No Sound

Try this:

1. Click play once. Browsers require a user gesture before audio starts.
2. Check master volume.
3. Check channel volume.
4. Make sure the channel is not muted.
5. Check whether another channel is soloed.
6. Confirm the pattern has notes.
7. If you are in playlist view, confirm the lane has a pattern or audio clip and is not marked `0`.
8. Try stop once to panic-stop hanging audio, then play again.

## SoundFont Is Silent

Try this:

1. Wait for the SoundFont to finish loading.
2. Pick another preset.
3. Use the global SoundFont menu to choose a bundled bank.
4. If using a custom `.sf2`, try a smaller or known-good file.
5. Export the project and reload the page if the browser audio context seems wedged.

Some `.sf2` files are weird. That format has history. History is often messy.

## Sample Will Not Load

Try this:

1. Use a common audio format like WAV, MP3, OGG, or FLAC.
2. Try a shorter sample.
3. Make sure the file is not corrupted.
4. Check whether the browser supports decoding that format.

If a bundled sample works but your file does not, the file format is probably the issue.

## WAV Export Is Slow

WAV export renders audio in the browser.

It can slow down when:

- The arrangement is long.
- There are many channels.
- Large SoundFonts are active.
- Many effects are enabled.
- Sample pitch preservation is active.

Let it finish. If it repeatedly fails, bypass heavy effects and try again.

## MIDI Import Looks Weird

MIDI files are not songs by themselves. They are note instructions. frdgBeats guesses useful SoundFont channels from programs and banks, but imported MIDI may still need cleanup.

After import:

- Check BPM.
- Check SoundFont bank.
- Rename channels.
- Delete empty or noisy channels.
- Fix playlist clips.
- Adjust velocity or volume.

## Automation Did Not Affect The Pattern

Check:

- The lane is enabled.
- The correct pattern is selected in automate.
- The target still exists.
- The synth or effect is loaded.
- The effect is enabled if automating an effect sound.

Automation is pattern-specific, so editing pattern `2` will not change pattern `1`.

## The Wiki Page Is Blank Or Links Go Weird

The wiki reads `.md` files from `/others/frdgbeats/wiki/`.

Internal links should point to page slugs like `[Quick Start](Quick-Start)`. The renderer turns those into `/others/frdgbeats/wiki/?page=Quick-Start`.

If a page is missing, check that the filename is exactly the slug plus `.md`.
