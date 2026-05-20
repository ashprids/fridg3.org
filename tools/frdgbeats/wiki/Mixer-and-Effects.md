# Mixer and Effects

The mixer tab edits effects for the selected channel. Effects are per channel, not global.

![Screenshot of the mixer tab with an effect picker, add button, a channel strip summary, and multiple effect cards with bypass, move, collapse, and delete buttons](placeholder:mixer-effects)

## Adding Effects

1. Select a channel.
2. Open the mixer tab.
3. Choose an effect from the effect picker.
4. Click the plus button.

The effect is added to the selected channel's effect chain.

## Effect Order

Effects run from top to bottom.

Use the up and down buttons on an effect card to reorder the chain.

Order matters. Distortion into reverb is not the same as reverb into distortion. One is a vibe, the other is usually soup.

## Bypass, Collapse, Delete

Each effect card has controls:

- Power button: bypass or enable.
- Up arrow: move earlier in the chain.
- Down arrow: move later in the chain.
- Trash: remove.
- Chevron: collapse or expand.

Collapsed effects still run unless bypassed.

## Presets

Many effects have presets. Choosing a preset replaces that effect's current settings.

Presets are good starting points, not sacred tablets.

## Built-In Effects

frdgBeats includes:

- Bitcrush: digital crunch, downsampling, retro damage.
- Chorus: width and doubling.
- Compressor: dynamic control and punch.
- Delay: tempo-synced echoes.
- Flanger: sweeping comb-filter movement.
- Glass Hall: reverb with room, tail, damping, predelay, and shimmer.
- Hot Circuit: distortion with cabinet voicing.
- Limiter: final level safety for a channel.
- Parametric EQ: visual multi-band EQ.
- Phaser: sweeping phase movement.
- Pitch Shift: semitone and cent shifting.
- Sample Speed: sample playback speed and tempo matching.

## Rendering Effects

WAV export renders enabled channel effects. MIDI export does not include audio effects because MIDI is note data, not sound.

## Effect Automation

Numeric effect parameters become automation targets automatically. After adding an effect, open the automate tab to draw movement for that effect.

Select menus are step-style automation targets. Numeric sliders can use step or smooth mode.
