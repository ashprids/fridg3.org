(function () {
    const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
    const stages = ['2', '4', '6', '8'];

    function makeControl(param, settings, setParam) {
        if (param.type === 'select') {
            const wrap = document.createElement('label');
            wrap.className = 'fb-phaser-node fb-phaser-select-node';
            const label = document.createElement('span');
            label.textContent = param.label || param.id;
            const select = document.createElement('select');
            select.className = 'fb-phaser-select';
            param.options.forEach(option => {
                const item = document.createElement('option');
                item.value = option;
                item.textContent = option;
                item.selected = option === settings[param.id];
                select.append(item);
            });
            select.addEventListener('change', () => setParam(param.id, select.value));
            wrap.append(label, select);
            return wrap;
        }
        const min = Number(param.min ?? 0);
        const max = Number(param.max ?? 1);
        const value = clamp(settings[param.id], min, max);
        const ratio = (value - min) / Math.max(0.0001, max - min);
        const wrap = document.createElement('label');
        wrap.className = 'fb-phaser-node';
        wrap.style.setProperty('--value', String(ratio));
        const orb = document.createElement('span');
        orb.className = 'fb-phaser-orb';
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
        wrap.append(orb, label, readout, input);
        return wrap;
    }

    window.frdgBeatsEffects.register({
        id: 'phaser',
        name: 'Phaser',
        params: [
            { id: 'rate', label: 'rate', type: 'range', min: 0.03, max: 6, step: 0.01, default: 0.42, unit: 'hz' },
            { id: 'depth', label: 'depth', type: 'range', min: 80, max: 1800, step: 10, default: 720, unit: 'hz' },
            { id: 'center', label: 'center', type: 'range', min: 180, max: 2400, step: 10, default: 760, unit: 'hz' },
            { id: 'feedback', label: 'feedback', type: 'range', min: 0, max: 0.84, step: 0.01, default: 0.32 },
            { id: 'mix', label: 'mix', type: 'range', min: 0, max: 1, step: 0.01, default: 0.52 },
            { id: 'stages', label: 'stages', type: 'select', options: stages, default: '4' }
        ],
        presets: [
            { name: 'Classic Sweep', settings: { rate: 0.32, depth: 820, center: 760, feedback: 0.42, mix: 0.56, stages: '4' } },
            { name: 'Funk Guitar', settings: { rate: 1.2, depth: 540, center: 920, feedback: 0.18, mix: 0.45, stages: '4' } },
            { name: 'Deep Space', settings: { rate: 0.09, depth: 1600, center: 620, feedback: 0.68, mix: 0.7, stages: '8' } },
            { name: 'Fast Swirl', settings: { rate: 3.2, depth: 420, center: 1250, feedback: 0.28, mix: 0.5, stages: '6' } },
            { name: 'Subtle Movement', settings: { rate: 0.18, depth: 240, center: 900, feedback: 0.08, mix: 0.28, stages: '2' } }
        ],
        css: `
.fb-phaser-panel {
    margin: 9px;
    padding: 12px;
    border: 1px solid rgba(202, 146, 255, 0.5);
    border-radius: 5px;
    background: linear-gradient(145deg, rgba(20, 7, 31, 0.98), rgba(0,0,0,0.98));
    box-shadow: inset 0 0 22px rgba(202, 146, 255, 0.1), 0 10px 24px rgba(0,0,0,0.34);
}
.fb-phaser-title {
    display: flex;
    justify-content: space-between;
    margin-bottom: 11px;
    color: #e3c3ff;
    font-family: "MainBold", monospace;
    font-size: 12px;
    text-transform: uppercase;
}
.fb-phaser-title span:last-child { color: rgba(227, 195, 255, 0.56); }
.fb-phaser-map {
    display: grid;
    grid-template-columns: repeat(6, minmax(68px, 1fr));
    gap: 8px;
}
.fb-phaser-node {
    --value: 0.5;
    position: relative;
    display: grid;
    justify-items: center;
    gap: 6px;
    min-width: 0;
    padding: 8px 6px;
    border: 1px solid rgba(202, 146, 255, 0.25);
    background: rgba(0,0,0,0.34);
    overflow: hidden;
}
.fb-phaser-orb {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: 1px solid rgba(227,195,255,0.62);
    background: radial-gradient(circle, #f0d8ff calc(var(--value) * 42%), #3b165a 43%, #09020e 100%);
    box-shadow: 0 0 calc(var(--value) * 18px) rgba(202,146,255,0.75);
    pointer-events: none;
}
.fb-phaser-node span,
.fb-phaser-node strong {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: rgba(244,232,255,0.84);
    font-size: 10px;
}
.fb-phaser-node strong { color: #ca92ff; }
.fb-phaser-node input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: ew-resize;
}
.fb-phaser-select {
    width: 100%;
    height: 28px;
    border: 1px solid rgba(202,146,255,0.42);
    background: #09020e;
    color: #e3c3ff;
    border-radius: 3px;
    font-family: "MainRegular", monospace;
}
@media (max-width: 760px) {
    .fb-phaser-map { grid-template-columns: repeat(2, minmax(68px, 1fr)); }
}
`,
        create(context, settings) {
            const input = context.createGain();
            const output = context.createGain();
            const dry = context.createGain();
            const wet = context.createGain();
            const feedback = context.createGain();
            const feedbackDelay = context.createDelay(0.02);
            const lfo = context.createOscillator();
            const depth = context.createGain();
            const count = Math.max(2, Math.min(8, Number(settings.stages) || 4));
            const filters = Array.from({ length: count }, () => context.createBiquadFilter());
            const mix = clamp(settings.mix, 0, 1);
            const center = clamp(settings.center, 180, 2400);
            const sweepDepth = Math.min(clamp(settings.depth, 80, 1800), center * 0.72);

            dry.gain.value = 1 - (mix * 0.65);
            wet.gain.value = mix;
            feedback.gain.value = clamp(settings.feedback, 0, 0.84);
            feedbackDelay.delayTime.value = 0.001;
            lfo.frequency.value = clamp(settings.rate, 0.03, 6);
            depth.gain.value = sweepDepth;
            filters.forEach((filter, index) => {
                filter.type = 'allpass';
                filter.frequency.value = center * (1 + index * 0.08);
                filter.Q.value = 0.8 + (index * 0.08);
                depth.connect(filter.frequency);
            });
            lfo.connect(depth);
            lfo.start();

            input.connect(dry);
            dry.connect(output);
            input.connect(filters[0]);
            filters.forEach((filter, index) => {
                if (filters[index + 1]) filter.connect(filters[index + 1]);
            });
            filters[filters.length - 1].connect(wet);
            wet.connect(output);
            filters[filters.length - 1].connect(feedback);
            feedback.connect(feedbackDelay);
            feedbackDelay.connect(filters[0]);

            return { input, output, nodes: [dry, wet, feedback, feedbackDelay, lfo, depth, ...filters] };
        },
        renderGui(api) {
            const root = document.createElement('div');
            root.className = 'fb-phaser-panel';
            const title = document.createElement('div');
            title.className = 'fb-phaser-title';
            title.innerHTML = '<span>phaser</span><span>allpass orbit</span>';
            const map = document.createElement('div');
            map.className = 'fb-phaser-map';
            api.params.forEach(param => map.append(makeControl(param, api.settings, api.setParam)));
            root.append(title, map);
            return root;
        }
    });
})();
