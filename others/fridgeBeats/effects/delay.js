(function () {
    const divisions = [
        { label: '1/16', steps: 1 },
        { label: '1/8', steps: 2 },
        { label: '1/4', steps: 4 },
        { label: '1/2', steps: 8 },
        { label: '1 bar', steps: 16 }
    ];

    const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
    const divisionLabels = divisions.map(item => item.label);
    const divisionByLabel = label => divisions.find(item => item.label === label) || divisions[2];

    function makeKnob(param, settings, setParam) {
        const min = Number(param.min ?? 0);
        const max = Number(param.max ?? 1);
        const value = param.type === 'select' ? settings[param.id] : clamp(settings[param.id], min, max);
        const ratio = param.type === 'select' ? 0.5 : ((value - min) / Math.max(0.0001, max - min));
        const wrap = document.createElement('label');
        wrap.className = 'fb-delay-knob';

        const dial = document.createElement('span');
        dial.className = 'fb-delay-dial';
        dial.style.setProperty('--value', String(ratio));

        let input = document.createElement('input');
        if (param.type === 'select') {
            input = document.createElement('select');
        }

        const title = document.createElement('span');
        title.className = 'fb-delay-label';
        title.textContent = param.label || param.id;
        const readout = document.createElement('span');
        readout.className = 'fb-delay-readout';

        if (param.type === 'select') {
            const select = input;
            select.className = 'fb-delay-select';
            (param.options || []).forEach(option => {
                const item = document.createElement('option');
                item.value = option;
                item.textContent = option;
                item.selected = option === value;
                select.append(item);
            });
            readout.textContent = value;
            select.addEventListener('change', () => {
                readout.textContent = select.value;
                setParam(param.id, select.value);
            });
            wrap.append(dial, title, readout, select);
            return wrap;
        }

        input.className = 'fb-delay-hidden-range';
        input.type = 'range';
        input.min = String(min);
        input.max = String(max);
        input.step = String(param.step ?? 0.01);
        input.value = String(value);
        const unit = param.unit || '';
        const update = () => {
            const next = clamp(input.value, min, max);
            const nextRatio = (next - min) / Math.max(0.0001, max - min);
            dial.style.setProperty('--value', String(nextRatio));
            readout.textContent = next.toFixed(param.step >= 1 ? 0 : 2).replace(/\.00$/, '') + unit;
            setParam(param.id, next);
        };
        readout.textContent = value.toFixed(param.step >= 1 ? 0 : 2).replace(/\.00$/, '') + unit;
        input.addEventListener('input', update);
        input.addEventListener('change', update);
        wrap.append(dial, title, readout, input);
        return wrap;
    }

    window.fridgeBeatsEffects.register({
        id: 'delay',
        name: 'Delay',
        params: [
            { id: 'division', label: 'sync', type: 'select', options: divisionLabels, default: '1/4' },
            { id: 'feedback', label: 'feedback', type: 'range', min: 0, max: 0.88, step: 0.01, default: 0.34 },
            { id: 'mix', label: 'mix', type: 'range', min: 0, max: 1, step: 0.01, default: 0.36 },
            { id: 'tone', label: 'tone', type: 'range', min: 900, max: 9800, step: 100, default: 4200, unit: 'hz' }
        ],
        presets: [
            { name: 'Slapback Vocal', settings: { division: '1/16', feedback: 0.18, mix: 0.22, tone: 6200 } },
            { name: 'Dub Echo', settings: { division: '1/4', feedback: 0.72, mix: 0.55, tone: 2400 } },
            { name: 'Ping Rhythm', settings: { division: '1/8', feedback: 0.48, mix: 0.38, tone: 5200 } },
            { name: 'Wide Wash', settings: { division: '1/2', feedback: 0.62, mix: 0.44, tone: 3600 } },
            { name: 'Space Throws', settings: { division: '1 bar', feedback: 0.68, mix: 0.5, tone: 3100 } }
        ],
        css: `
.fb-delay-console {
    margin: 9px;
    padding: 13px;
    border: 1px solid rgba(255, 198, 92, 0.48);
    border-radius: 8px;
    background:
        radial-gradient(circle at 20% 0%, rgba(255, 198, 92, 0.18), transparent 35%),
        linear-gradient(135deg, rgba(34, 22, 9, 0.96), rgba(5, 5, 5, 0.98));
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06), 0 10px 24px rgba(0, 0, 0, 0.35);
}
.fb-delay-title {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 12px;
    color: #ffd68a;
    font-family: "MainBold", monospace;
    font-size: 12px;
    letter-spacing: 0;
    text-transform: uppercase;
}
.fb-delay-title span:last-child {
    color: rgba(255, 214, 138, 0.62);
}
.fb-delay-knobs {
    display: grid;
    grid-template-columns: repeat(4, minmax(92px, 1fr));
    gap: 12px;
}
.fb-delay-knob {
    position: relative;
    display: grid;
    justify-items: center;
    gap: 6px;
    padding: 10px 8px;
    border-radius: 7px;
    background: rgba(0, 0, 0, 0.28);
    overflow: hidden;
}
.fb-delay-dial {
    --value: 0.5;
    width: 58px;
    height: 58px;
    border-radius: 50%;
    border: 1px solid rgba(255, 214, 138, 0.72);
    background:
        radial-gradient(circle at 50% 50%, #111 0 35%, transparent 36%),
        conic-gradient(from -135deg, #ffc65c calc(var(--value) * 270deg), rgba(255,255,255,0.12) 0 270deg, transparent 0),
        linear-gradient(145deg, #2b1b09, #050505);
    box-shadow: inset 0 0 12px rgba(0,0,0,0.8), 0 6px 14px rgba(0,0,0,0.4);
    pointer-events: none;
}
.fb-delay-label,
.fb-delay-readout {
    font-size: 11px;
    color: rgba(255, 236, 199, 0.88);
}
.fb-delay-readout {
    color: #ffc65c;
}
.fb-delay-hidden-range,
.fb-delay-select {
    width: 100%;
    accent-color: #ffc65c;
}
.fb-delay-hidden-range {
    position: absolute;
    inset: 0;
    z-index: 3;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: ew-resize;
}
.fb-delay-select {
    position: relative;
    z-index: 4;
    height: 28px;
    border: 1px solid rgba(255, 198, 92, 0.52);
    background: #080502;
    color: #ffd68a;
    border-radius: 4px;
    font-family: "MainRegular", monospace;
}
@media (max-width: 720px) {
    .fb-delay-knobs {
        grid-template-columns: repeat(2, minmax(92px, 1fr));
    }
}
`,
        create(context, settings) {
            const sync = divisionByLabel(settings.division);
            const delayTime = Math.max(0.01, Math.min(2.5, Number(settings.timeSeconds) || 0.125 * sync.steps));
            const input = context.createGain();
            const output = context.createGain();
            const dry = context.createGain();
            const wet = context.createGain();
            const delay = context.createDelay(3);
            const filter = context.createBiquadFilter();
            const feedback = context.createGain();
            const mix = clamp(settings.mix, 0, 1);

            dry.gain.value = 1 - (mix * 0.65);
            wet.gain.value = mix;
            delay.delayTime.value = delayTime;
            filter.type = 'lowpass';
            filter.frequency.value = clamp(settings.tone, 900, 9800);
            feedback.gain.value = clamp(settings.feedback, 0, 0.88);

            input.connect(dry);
            dry.connect(output);
            input.connect(delay);
            delay.connect(filter);
            filter.connect(wet);
            wet.connect(output);
            filter.connect(feedback);
            feedback.connect(delay);

            return { input, output, nodes: [dry, wet, delay, filter, feedback] };
        },
        renderGui(api) {
            const root = document.createElement('div');
            root.className = 'fb-delay-console';
            const title = document.createElement('div');
            title.className = 'fb-delay-title';
            title.innerHTML = '<span>clockwork delay</span><span>bpm locked</span>';
            const knobs = document.createElement('div');
            knobs.className = 'fb-delay-knobs';
            api.params.forEach(param => knobs.append(makeKnob(param, api.settings, api.setParam)));
            root.append(title, knobs);
            return root;
        }
    });
})();
