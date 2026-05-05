(function () {
    const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));

    function text(value, param) {
        const number = Number(value) || 0;
        return number.toFixed((param.step || 1) >= 1 ? 0 : 2).replace(/\.00$/, '') + (param.unit || '');
    }

    function makeWheel(param, settings, setParam) {
        const min = Number(param.min ?? 0);
        const max = Number(param.max ?? 1);
        const value = clamp(settings[param.id], min, max);
        const ratio = (value - min) / Math.max(0.0001, max - min);
        const wrap = document.createElement('label');
        wrap.className = 'fb-flanger-wheel';
        wrap.style.setProperty('--value', String(ratio));
        const disc = document.createElement('span');
        disc.className = 'fb-flanger-disc';
        const name = document.createElement('span');
        name.className = 'fb-flanger-name';
        name.textContent = param.label || param.id;
        const readout = document.createElement('span');
        readout.className = 'fb-flanger-readout';
        readout.textContent = text(value, param);
        const input = document.createElement('input');
        input.type = 'range';
        input.min = String(min);
        input.max = String(max);
        input.step = String(param.step ?? 0.01);
        input.value = String(value);
        const update = () => {
            const next = clamp(input.value, min, max);
            wrap.style.setProperty('--value', String((next - min) / Math.max(0.0001, max - min)));
            readout.textContent = text(next, param);
            setParam(param.id, next);
        };
        input.addEventListener('input', update);
        input.addEventListener('change', update);
        wrap.append(disc, name, readout, input);
        return wrap;
    }

    window.frdgBeatsEffects.register({
        id: 'flanger',
        name: 'Flanger',
        params: [
            { id: 'rate', label: 'rate', type: 'range', min: 0.03, max: 5, step: 0.01, default: 0.28, unit: 'hz' },
            { id: 'depth', label: 'depth', type: 'range', min: 0.0002, max: 0.009, step: 0.0001, default: 0.003, unit: 's' },
            { id: 'delay', label: 'delay', type: 'range', min: 0.0005, max: 0.012, step: 0.0001, default: 0.004, unit: 's' },
            { id: 'feedback', label: 'regen', type: 'range', min: 0, max: 0.86, step: 0.01, default: 0.36 },
            { id: 'mix', label: 'mix', type: 'range', min: 0, max: 1, step: 0.01, default: 0.52 }
        ],
        presets: [
            { name: 'Jet Sweep', settings: { rate: 0.18, depth: 0.0065, delay: 0.0045, feedback: 0.72, mix: 0.62 } },
            { name: 'Subtle Motion', settings: { rate: 0.14, depth: 0.0016, delay: 0.003, feedback: 0.16, mix: 0.28 } },
            { name: 'Metal Comb', settings: { rate: 0.58, depth: 0.004, delay: 0.0012, feedback: 0.82, mix: 0.66 } },
            { name: 'Slow Tape', settings: { rate: 0.07, depth: 0.005, delay: 0.006, feedback: 0.34, mix: 0.44 } },
            { name: 'Fast Flutter', settings: { rate: 2.6, depth: 0.0018, delay: 0.0024, feedback: 0.28, mix: 0.4 } }
        ],
        css: `
.fb-flanger-panel {
    margin: 9px;
    padding: 12px;
    border: 1px solid rgba(109, 236, 176, 0.48);
    border-radius: 7px;
    background:
        radial-gradient(circle at 85% 10%, rgba(109, 236, 176, 0.16), transparent 32%),
        linear-gradient(145deg, rgba(3, 18, 12, 0.98), rgba(0, 0, 0, 0.98));
    box-shadow: inset 0 0 22px rgba(109, 236, 176, 0.1), 0 10px 24px rgba(0,0,0,0.34);
}
.fb-flanger-title {
    display: flex;
    justify-content: space-between;
    margin-bottom: 11px;
    color: #aaffce;
    font-family: "MainBold", monospace;
    font-size: 12px;
    text-transform: uppercase;
}
.fb-flanger-title span:last-child { color: rgba(170, 255, 206, 0.58); }
.fb-flanger-bank {
    display: grid;
    grid-template-columns: repeat(5, minmax(72px, 1fr));
    gap: 8px;
}
.fb-flanger-wheel {
    --value: 0.5;
    position: relative;
    display: grid;
    justify-items: center;
    gap: 6px;
    min-width: 0;
    padding: 9px 7px;
    border: 1px solid rgba(109, 236, 176, 0.24);
    background: rgba(0,0,0,0.34);
    overflow: hidden;
}
.fb-flanger-disc {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: 1px solid rgba(170, 255, 206, 0.66);
    background:
        radial-gradient(circle, #06110d 0 35%, transparent 36%),
        conic-gradient(from -140deg, #6decb0 calc(var(--value) * 280deg), rgba(255,255,255,0.12) 0 280deg, transparent 0),
        #020806;
    pointer-events: none;
}
.fb-flanger-name,
.fb-flanger-readout {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: rgba(224, 255, 238, 0.84);
    font-size: 10px;
}
.fb-flanger-readout { color: #6decb0; }
.fb-flanger-wheel input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: ew-resize;
}
@media (max-width: 760px) {
    .fb-flanger-bank { grid-template-columns: repeat(2, minmax(72px, 1fr)); }
}
`,
        create(context, settings) {
            const input = context.createGain();
            const output = context.createGain();
            const dry = context.createGain();
            const wet = context.createGain();
            const delay = context.createDelay(0.03);
            const feedback = context.createGain();
            const lfo = context.createOscillator();
            const depth = context.createGain();
            const mix = clamp(settings.mix, 0, 1);

            dry.gain.value = 1 - (mix * 0.65);
            wet.gain.value = mix;
            delay.delayTime.value = clamp(settings.delay, 0.0005, 0.012);
            feedback.gain.value = clamp(settings.feedback, 0, 0.86);
            lfo.frequency.value = clamp(settings.rate, 0.03, 5);
            depth.gain.value = clamp(settings.depth, 0.0002, 0.009);
            lfo.connect(depth);
            depth.connect(delay.delayTime);
            lfo.start();

            input.connect(dry);
            dry.connect(output);
            input.connect(delay);
            delay.connect(wet);
            wet.connect(output);
            delay.connect(feedback);
            feedback.connect(delay);

            return { input, output, nodes: [dry, wet, delay, feedback, lfo, depth] };
        },
        renderGui(api) {
            const root = document.createElement('div');
            root.className = 'fb-flanger-panel';
            const title = document.createElement('div');
            title.className = 'fb-flanger-title';
            title.innerHTML = '<span>flanger</span><span>comb sweep</span>';
            const bank = document.createElement('div');
            bank.className = 'fb-flanger-bank';
            api.params.forEach(param => bank.append(makeWheel(param, api.settings, api.setParam)));
            root.append(title, bank);
            return root;
        }
    });
})();
