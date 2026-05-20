# Automation

Automation changes settings over time. In frdgBeats, automation is per channel and per pattern.

![Screenshot of the automation tab with a target picker, add lane button, lane mode selector, and a grid of automation cells with values drawn across steps](placeholder:automation-tab)

## What Can Be Automated

Automation targets include:

- Channel volume.
- Channel pan.
- Numeric synth parameters.
- Numeric effect parameters.
- Select-style parameters as stepped values when supported.

If a synth or effect exposes numeric parameters, frdgBeats can usually automate them.

## Pattern-Specific Automation

Automation applies only to the selected pattern. It does not globally change every pattern on the channel.

This is important. You can make pattern `1` dry and pattern `2` filter-swept without fighting the whole project.

## Adding a Lane

1. Select a channel.
2. Open automate.
3. Pick the pattern you want to edit.
4. Choose a target from the target dropdown.
5. Click plus.

Each target can have one lane per channel.

## Drawing Values

Automation lanes use a step grid.

- Click an empty cell to set it to the current parameter value.
- Click a set cell to clear it.
- Shift-click clears a cell.
- Right-click clears a cell.
- Drag vertically across numeric cells to draw values.

Cells with explicit values are solid. Filled cells can show carried or interpolated values depending on mode.

## Step vs Smooth

Step mode jumps from value to value.

Smooth mode interpolates between values across steps.

Select-style parameters use step mode because a menu value cannot smoothly slide from `off` to `on`. Trying to interpolate words is nonsense. Computers do enough nonsense already.

## Enable, Clear, Remove

Each lane has:

- Mode menu.
- Power button.
- Clear button.
- Delete button.

Disabling a lane keeps the data but stops applying it.

Clearing removes values for the current pattern.

Deleting removes the lane entirely.

## Automation Tips

- Use volume automation for fades and rhythmic cuts.
- Use pan automation for movement.
- Use filter cutoff automation for builds.
- Use delay mix automation for throws.
- Use sample speed automation carefully, because extreme values can get chaotic fast.
