(function () {
    const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
    const dbToGain = db => Math.pow(10, db / 20);

    function makeControl(param, settings, setParam) {
        const min = Number(param.min ?? 0);
        const max = Number(param.max ?? 1);
        const current = clamp(settings[param.id], min, max);
        const ratio = (current - min) / Math.max(0.0001, max - min);
        const wrap = document.createElement('label');
        wrap.className = 'fb-limit-control';
        wrap.style.setProperty('--value', String(ratio));
        const label = document.createElement('span');
        label.textContent = param.label || param.id;
        const readout = document.createElement('strong');
        readout.textContent = current.toFixed((param.step || 1) >= 1 ? 0 : 2).replace(/\.00$/, '') + (param.unit || '');
        const input = document.createElement('input');
        input.type = 'range';
        input.min = String(min);
        input.max = String(max);
        input.step = String(param.step ?? 0.01);
        input.value = String(current);
        const update = () => {
            const next = clamp(input.value, min, max);
            const nextRatio = (next - min) / Math.max(0.0001, max - min);
            wrap.style.setProperty('--value', String(nextRatio));
            readout.textContent = next.toFixed((param.step || 1) >= 1 ? 0 : 2).replace(/\.00$/, '') + (param.unit || '');
            setParam(param.id, next);
        };
        input.addEventListener('input', update);
        input.addEventListener('change', update);
        wrap.append(label, readout, input);
        return wrap;
    }

    window.frdgBeatsEffects.register({
        id: 'limiter',
        name: 'Limiter',
        params: [
            { id: 'ceiling', label: 'ceiling', type: 'range', min: -12, max: 0, step: 0.1, default: -0.8, unit: 'db' },
            { id: 'drive', label: 'drive', type: 'range', min: 0, max: 18, step: 0.1, default: 3.2, unit: 'db' },
            { id: 'release', label: 'release', type: 'range', min: 0.02, max: 1, step: 0.01, default: 0.12, unit: 's' },
            { id: 'knee', label: 'soft', type: 'range', min: 0, max: 30, step: 1, default: 4, unit: 'db' },
            { id: 'output', label: 'out', type: 'range', min: 0.2, max: 1.25, step: 0.01, default: 1 }
        ],
        presets: [
            { name: 'Master Safety', settings: { ceiling: -0.8, drive: 2.4, release: 0.16, knee: 6, output: 1 } },
            { name: 'Loud Demo', settings: { ceiling: -0.4, drive: 6.8, release: 0.09, knee: 3, output: 1 } },
            { name: 'Drum Peak Catcher', settings: { ceiling: -1.2, drive: 4.2, release: 0.045, knee: 1, output: 0.96 } },
            { name: 'Streaming Ceiling', settings: { ceiling: -1, drive: 3.6, release: 0.22, knee: 8, output: 0.98 } },
            { name: 'Hard Brickwall', settings: { ceiling: -0.2, drive: 10.5, release: 0.035, knee: 0, output: 0.92 } }
        ],
        css: `
.fb-limit-panel {
    margin: 9px;
    padding: 12px;
    border: 1px solid rgba(255, 226, 94, 0.5);
    border-radius: 3px;
    background:
        linear-gradient(90deg, rgba(255, 226, 94, 0.18) 0 2px, transparent 2px 12px),
        linear-gradient(145deg, rgba(22, 18, 3, 0.98), rgba(0, 0, 0, 0.98));
    box-shadow: inset 0 0 24px rgba(255, 226, 94, 0.1), 0 10px 24px rgba(0, 0, 0, 0.34);
}
.fb-limit-title {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 11px;
    color: #ffe25e;
    font-family: "MainBold", monospace;
    font-size: 12px;
    text-transform: uppercase;
}
.fb-limit-title span:last-child {
    color: rgba(255, 226, 94, 0.58);
}
.fb-limit-grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(76px, 1fr));
    gap: 8px;
}
.fb-limit-control {
    --value: 0.5;
    position: relative;
    display: grid;
    gap: 7px;
    min-width: 0;
    padding: 9px 7px;
    border: 1px solid rgba(255, 226, 94, 0.28);
    background: rgba(0, 0, 0, 0.36);
    overflow: hidden;
}
.fb-limit-control span,
.fb-limit-control strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: rgba(255, 247, 207, 0.84);
    font-size: 10px;
}
.fb-limit-control strong {
    color: #ffe25e;
}
.fb-limit-control input {
    position: absolute;
    inset: 0;
    z-index: 3;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: ew-resize;
    accent-color: #ffe25e;
}
.fb-limit-control::before {
    content: "";
    height: 12px;
    width: calc(var(--value) * 100%);
    min-width: 8px;
    border: 1px solid rgba(255, 226, 94, 0.35);
    background: linear-gradient(90deg, #ffe25e, #ff8f4a);
    box-shadow: 0 0 10px rgba(255, 226, 94, 0.5);
}
@media (max-width: 760px) {
    .fb-limit-grid {
        grid-template-columns: repeat(2, minmax(76px, 1fr));
    }
}
`,
        create(context, settings) {
            const input = context.createGain();
            const output = context.createGain();
            const drive = context.createGain();
            const limiter = context.createDynamicsCompressor();
            const post = context.createGain();
            drive.gain.value = dbToGain(clamp(settings.drive, 0, 18));
            limiter.threshold.value = clamp(settings.ceiling, -12, 0);
            limiter.ratio.value = 20;
            limiter.attack.value = 0.001;
            limiter.release.value = clamp(settings.release, 0.02, 1);
            limiter.knee.value = clamp(settings.knee, 0, 30);
            post.gain.value = dbToGain(clamp(settings.ceiling, -12, 0)) * clamp(settings.output, 0.2, 1.25);
            input.connect(drive);
            drive.connect(limiter);
            limiter.connect(post);
            post.connect(output);
            return { input, output, nodes: [drive, limiter, post] };
        },
        renderGui(api) {
            const root = document.createElement('div');
            root.className = 'fb-limit-panel';
            const title = document.createElement('div');
            title.className = 'fb-limit-title';
            title.innerHTML = '<span>limiter</span><span>brickwall</span>';
            const grid = document.createElement('div');
            grid.className = 'fb-limit-grid';
            api.params.forEach(param => grid.append(makeControl(param, api.settings, api.setParam)));
            root.append(title, grid);
            return root;
        }
    });
})();
