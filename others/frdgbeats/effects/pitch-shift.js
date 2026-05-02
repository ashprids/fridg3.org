(function () {
    const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));

    function makeSlider(param, settings, setParam) {
        const min = Number(param.min ?? 0);
        const max = Number(param.max ?? 1);
        const value = clamp(settings[param.id], min, max);
        const wrap = document.createElement('label');
        wrap.className = 'fb-pitch-control';

        const top = document.createElement('span');
        top.className = 'fb-pitch-control-top';
        const label = document.createElement('span');
        label.textContent = param.label || param.id;
        const readout = document.createElement('span');
        readout.className = 'fb-pitch-readout';

        const input = document.createElement('input');
        input.type = 'range';
        input.min = String(min);
        input.max = String(max);
        input.step = String(param.step ?? 1);
        input.value = String(value);

        const update = (persist = true) => {
            const next = clamp(input.value, min, max);
            input.style.setProperty('--value', String((next - min) / Math.max(0.0001, max - min)));
            readout.textContent = (next > 0 ? '+' : '') + next.toFixed(param.step >= 1 ? 0 : 1) + (param.unit || '');
            if (persist) setParam(param.id, next);
        };

        update(false);
        input.addEventListener('input', update);
        input.addEventListener('change', update);
        top.append(label, readout);
        wrap.append(top, input);
        return wrap;
    }

    window.frdgBeatsEffects.register({
        id: 'pitch-shift',
        name: 'Pitch Shift',
        params: [
            { id: 'semitones', label: 'semitones', type: 'range', min: -24, max: 24, step: 1, default: 0, unit: ' st' },
            { id: 'cents', label: 'fine', type: 'range', min: -100, max: 100, step: 1, default: 0, unit: ' ct' }
        ],
        presets: [
            { name: 'Octave Down', settings: { semitones: -12, cents: 0 } },
            { name: 'Fifth Up', settings: { semitones: 7, cents: 0 } },
            { name: 'Vapor Detune', settings: { semitones: 0, cents: -18 } },
            { name: 'Chip Lift', settings: { semitones: 12, cents: 0 } },
            { name: 'Dark Minor Third', settings: { semitones: -3, cents: 0 } }
        ],
        css: `
.fb-pitch-box {
    margin: 9px;
    padding: 13px;
    border: 1px solid rgba(112, 225, 255, 0.42);
    border-radius: 8px;
    background:
        radial-gradient(circle at 88% 10%, rgba(255, 87, 146, 0.2), transparent 34%),
        linear-gradient(135deg, rgba(12, 20, 26, 0.98), rgba(4, 6, 9, 0.98));
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06), 0 10px 24px rgba(0, 0, 0, 0.32);
}
.fb-pitch-title {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 12px;
    color: #70e1ff;
    font-family: "MainBold", monospace;
    font-size: 12px;
    letter-spacing: 0;
    text-transform: uppercase;
}
.fb-pitch-title span:last-child {
    color: #ff8fbd;
}
.fb-pitch-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(150px, 1fr));
    gap: 12px;
}
.fb-pitch-control {
    display: grid;
    gap: 9px;
    padding: 11px;
    border-radius: 7px;
    background: rgba(255, 255, 255, 0.055);
}
.fb-pitch-control-top {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    color: rgba(231, 250, 255, 0.86);
    font-size: 11px;
}
.fb-pitch-readout {
    color: #ffb1d1;
}
.fb-pitch-control input[type="range"] {
    --value: 0.5;
    width: 100%;
    height: 12px;
    appearance: none;
    border-radius: 999px;
    background:
        linear-gradient(90deg, #70e1ff calc(var(--value) * 100%), rgba(255,255,255,0.12) 0),
        #05070a;
    outline: none;
}
.fb-pitch-control input[type="range"]::-webkit-slider-thumb {
    appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 2px solid #101820;
    background: #ff8fbd;
    box-shadow: 0 0 0 3px rgba(255, 143, 189, 0.22);
}
.fb-pitch-control input[type="range"]::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 2px solid #101820;
    background: #ff8fbd;
    box-shadow: 0 0 0 3px rgba(255, 143, 189, 0.22);
}
@media (max-width: 720px) {
    .fb-pitch-grid {
        grid-template-columns: 1fr;
    }
}
`,
        create(context) {
            const input = context.createGain();
            const output = context.createGain();
            input.connect(output);
            return { input, output };
        },
        renderGui(api) {
            const root = document.createElement('div');
            root.className = 'fb-pitch-box';
            const title = document.createElement('div');
            title.className = 'fb-pitch-title';
            title.innerHTML = '<span>instrument pitch</span><span>pre engine</span>';
            const grid = document.createElement('div');
            grid.className = 'fb-pitch-grid';
            api.params.forEach(param => grid.append(makeSlider(param, api.settings, api.setParam)));
            root.append(title, grid);
            return root;
        }
    });
})();
