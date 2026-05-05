(function () {
    const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));

    function makeVoiceControl(param, settings, setParam) {
        const min = Number(param.min ?? 0);
        const max = Number(param.max ?? 1);
        const value = clamp(settings[param.id], min, max);
        const ratio = (value - min) / Math.max(0.0001, max - min);
        const wrap = document.createElement('label');
        wrap.className = 'fb-chorus-voice';
        wrap.style.setProperty('--value', String(ratio));
        const wave = document.createElement('span');
        wave.className = 'fb-chorus-wave';
        const label = document.createElement('span');
        label.textContent = param.label || param.id;
        const readout = document.createElement('strong');
        readout.textContent = value.toFixed((param.step || 1) >= 1 ? 0 : 2).replace(/\.00$/, '') + (param.unit || '');
        const input = document.createElement('input');
        input.type = 'range';
        input.min = String(min);
        input.max = String(max);
        input.step = String(param.step ?? 0.01);
        input.value = String(value);
        const update = () => {
            const next = clamp(input.value, min, max);
            wrap.style.setProperty('--value', String((next - min) / Math.max(0.0001, max - min)));
            readout.textContent = next.toFixed((param.step || 1) >= 1 ? 0 : 2).replace(/\.00$/, '') + (param.unit || '');
            setParam(param.id, next);
        };
        input.addEventListener('input', update);
        input.addEventListener('change', update);
        wrap.append(wave, label, readout, input);
        return wrap;
    }

    window.frdgBeatsEffects.register({
        id: 'chorus',
        name: 'Chorus',
        params: [
            { id: 'rate', label: 'rate', type: 'range', min: 0.05, max: 5, step: 0.01, default: 0.8, unit: 'hz' },
            { id: 'depth', label: 'depth', type: 'range', min: 0.001, max: 0.018, step: 0.0005, default: 0.006, unit: 's' },
            { id: 'delay', label: 'delay', type: 'range', min: 0.006, max: 0.035, step: 0.0005, default: 0.018, unit: 's' },
            { id: 'spread', label: 'spread', type: 'range', min: 0, max: 1, step: 0.01, default: 0.65 },
            { id: 'mix', label: 'mix', type: 'range', min: 0, max: 1, step: 0.01, default: 0.42 }
        ],
        presets: [
            { name: 'Wide Synth', settings: { rate: 0.58, depth: 0.008, delay: 0.021, spread: 0.86, mix: 0.48 } },
            { name: 'Juno Pad', settings: { rate: 0.72, depth: 0.011, delay: 0.018, spread: 0.72, mix: 0.55 } },
            { name: 'Vocal Doubler', settings: { rate: 1.1, depth: 0.004, delay: 0.026, spread: 0.58, mix: 0.32 } },
            { name: 'Bass Widen', settings: { rate: 0.32, depth: 0.003, delay: 0.012, spread: 0.28, mix: 0.22 } },
            { name: 'Sea Sick', settings: { rate: 2.4, depth: 0.014, delay: 0.024, spread: 0.95, mix: 0.62 } }
        ],
        css: `
.fb-chorus-panel {
    margin: 9px;
    padding: 12px;
    border: 1px solid rgba(118, 190, 255, 0.5);
    border-radius: 8px;
    background:
        linear-gradient(120deg, rgba(118,190,255,0.12), transparent 40%),
        linear-gradient(145deg, rgba(4, 14, 24, 0.98), rgba(0,0,0,0.98));
    box-shadow: inset 0 0 22px rgba(118,190,255,0.1), 0 10px 24px rgba(0,0,0,0.34);
}
.fb-chorus-title {
    display: flex;
    justify-content: space-between;
    margin-bottom: 11px;
    color: #b9ddff;
    font-family: "MainBold", monospace;
    font-size: 12px;
    text-transform: uppercase;
}
.fb-chorus-title span:last-child { color: rgba(185,221,255,0.58); }
.fb-chorus-voices {
    display: grid;
    grid-template-columns: repeat(5, minmax(74px, 1fr));
    gap: 8px;
}
.fb-chorus-voice {
    --value: 0.5;
    position: relative;
    display: grid;
    gap: 6px;
    justify-items: center;
    min-width: 0;
    padding: 9px 7px;
    border: 1px solid rgba(118,190,255,0.25);
    background: rgba(0,0,0,0.34);
    overflow: hidden;
}
.fb-chorus-wave {
    width: 100%;
    height: 38px;
    border: 1px solid rgba(185,221,255,0.36);
    background:
        linear-gradient(90deg, transparent calc(var(--value) * 100%), rgba(118,190,255,0.28) 0),
        repeating-linear-gradient(90deg, rgba(118,190,255,0.5) 0 3px, transparent 3px 9px),
        #03101c;
    pointer-events: none;
}
.fb-chorus-voice span,
.fb-chorus-voice strong {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: rgba(230,244,255,0.84);
    font-size: 10px;
}
.fb-chorus-voice strong { color: #76beff; }
.fb-chorus-voice input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: ew-resize;
}
@media (max-width: 760px) {
    .fb-chorus-voices { grid-template-columns: repeat(2, minmax(74px, 1fr)); }
}
`,
        create(context, settings) {
            const input = context.createGain();
            const output = context.createGain();
            const dry = context.createGain();
            const wet = context.createGain();
            const delayA = context.createDelay(0.06);
            const delayB = context.createDelay(0.06);
            const gainA = context.createGain();
            const gainB = context.createGain();
            const lfoA = context.createOscillator();
            const lfoB = context.createOscillator();
            const depthA = context.createGain();
            const depthB = context.createGain();
            const mix = clamp(settings.mix, 0, 1);
            const spread = clamp(settings.spread, 0, 1);

            dry.gain.value = 1 - (mix * 0.55);
            wet.gain.value = mix;
            delayA.delayTime.value = clamp(settings.delay, 0.006, 0.035);
            delayB.delayTime.value = clamp(settings.delay, 0.006, 0.035) * (1 + spread * 0.22);
            gainA.gain.value = 0.72;
            gainB.gain.value = 0.72;
            lfoA.frequency.value = clamp(settings.rate, 0.05, 5);
            lfoB.frequency.value = clamp(settings.rate, 0.05, 5) * (1.02 + spread * 0.08);
            depthA.gain.value = clamp(settings.depth, 0.001, 0.018);
            depthB.gain.value = clamp(settings.depth, 0.001, 0.018) * (1 + spread * 0.35);
            lfoA.connect(depthA);
            lfoB.connect(depthB);
            depthA.connect(delayA.delayTime);
            depthB.connect(delayB.delayTime);
            lfoA.start();
            lfoB.start();

            input.connect(dry);
            dry.connect(output);
            input.connect(delayA);
            input.connect(delayB);
            delayA.connect(gainA);
            delayB.connect(gainB);
            gainA.connect(wet);
            gainB.connect(wet);
            wet.connect(output);

            return { input, output, nodes: [dry, wet, delayA, delayB, gainA, gainB, lfoA, lfoB, depthA, depthB] };
        },
        renderGui(api) {
            const root = document.createElement('div');
            root.className = 'fb-chorus-panel';
            const title = document.createElement('div');
            title.className = 'fb-chorus-title';
            title.innerHTML = '<span>chorus</span><span>dual voice drift</span>';
            const voices = document.createElement('div');
            voices.className = 'fb-chorus-voices';
            api.params.forEach(param => voices.append(makeVoiceControl(param, api.settings, api.setParam)));
            root.append(title, voices);
            return root;
        }
    });
})();
