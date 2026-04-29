(function () {
    const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));

    function format(value, param) {
        const number = Number(value) || 0;
        const fixed = (param.step || 1) >= 1 ? 0 : 2;
        return number.toFixed(fixed).replace(/\.00$/, '') + (param.unit || '');
    }

    function snap(value, min, max, step) {
        const size = Number(step) || 0.01;
        return clamp(min + (Math.round((value - min) / size) * size), min, max);
    }

    function makeStrip(param, settings, setParam) {
        const min = Number(param.min ?? 0);
        const max = Number(param.max ?? 1);
        const current = clamp(settings[param.id], min, max);
        const ratio = (current - min) / Math.max(0.0001, max - min);
        const wrap = document.createElement('label');
        wrap.className = 'fb-comp-strip';
        wrap.style.setProperty('--value', String(ratio));

        const label = document.createElement('span');
        label.className = 'fb-comp-label';
        label.textContent = param.label || param.id;
        const meter = document.createElement('span');
        meter.className = 'fb-comp-meter';
        const fill = document.createElement('span');
        fill.className = 'fb-comp-fill';
        meter.append(fill);
        const readout = document.createElement('span');
        readout.className = 'fb-comp-readout';
        readout.textContent = format(current, param);
        const input = document.createElement('input');
        input.className = 'fb-comp-range';
        input.type = 'range';
        input.min = String(min);
        input.max = String(max);
        input.step = String(param.step ?? 0.01);
        input.value = String(current);
        const update = () => {
            const next = clamp(input.value, min, max);
            const nextRatio = (next - min) / Math.max(0.0001, max - min);
            wrap.style.setProperty('--value', String(nextRatio));
            readout.textContent = format(next, param);
            setParam(param.id, next);
        };
        input.addEventListener('input', update);
        input.addEventListener('change', update);
        const drag = event => {
            const rect = meter.getBoundingClientRect();
            const ratio = 1 - ((event.clientY - rect.top) / Math.max(1, rect.height));
            input.value = String(snap(min + (ratio * (max - min)), min, max, param.step));
            update();
        };
        wrap.addEventListener('pointerdown', event => {
            if (event.target.closest('select, button')) return;
            event.preventDefault();
            wrap.setPointerCapture(event.pointerId);
            drag(event);
        });
        wrap.addEventListener('pointermove', event => {
            if (!wrap.hasPointerCapture(event.pointerId)) return;
            event.preventDefault();
            drag(event);
        });
        wrap.addEventListener('pointerup', event => {
            if (wrap.hasPointerCapture(event.pointerId)) wrap.releasePointerCapture(event.pointerId);
        });
        wrap.append(label, meter, readout, input);
        return wrap;
    }

    window.fridgeBeatsEffects.register({
        id: 'compressor',
        name: 'Compressor',
        params: [
            { id: 'threshold', label: 'threshold', type: 'range', min: -60, max: 0, step: 1, default: -24, unit: 'db' },
            { id: 'ratio', label: 'ratio', type: 'range', min: 1, max: 20, step: 0.5, default: 4 },
            { id: 'attack', label: 'attack', type: 'range', min: 0.001, max: 0.12, step: 0.001, default: 0.012, unit: 's' },
            { id: 'release', label: 'release', type: 'range', min: 0.02, max: 1, step: 0.01, default: 0.24, unit: 's' },
            { id: 'knee', label: 'knee', type: 'range', min: 0, max: 40, step: 1, default: 18, unit: 'db' },
            { id: 'makeup', label: 'makeup', type: 'range', min: 0.25, max: 2.5, step: 0.01, default: 1.12 }
        ],
        presets: [
            { name: 'Vocal Glue', settings: { threshold: -26, ratio: 3.5, attack: 0.012, release: 0.22, knee: 22, makeup: 1.18 } },
            { name: 'Drum Punch', settings: { threshold: -18, ratio: 5.5, attack: 0.006, release: 0.12, knee: 8, makeup: 1.08 } },
            { name: 'Bass Control', settings: { threshold: -24, ratio: 4.5, attack: 0.024, release: 0.34, knee: 16, makeup: 1.14 } },
            { name: 'Mix Bus Glue', settings: { threshold: -12, ratio: 2, attack: 0.03, release: 0.28, knee: 26, makeup: 1.04 } },
            { name: 'Hard Squash', settings: { threshold: -34, ratio: 12, attack: 0.002, release: 0.08, knee: 4, makeup: 1.34 } }
        ],
        css: `
.fb-comp-panel {
    margin: 9px;
    padding: 12px;
    border: 1px solid rgba(113, 176, 255, 0.46);
    border-radius: 5px;
    background: linear-gradient(145deg, rgba(4, 11, 22, 0.98), rgba(0, 0, 0, 0.98));
    box-shadow: inset 0 0 22px rgba(113, 176, 255, 0.08), 0 10px 24px rgba(0, 0, 0, 0.34);
}
.fb-comp-title {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 11px;
    color: #bad7ff;
    font-family: "MainBold", monospace;
    font-size: 12px;
    text-transform: uppercase;
}
.fb-comp-title span:last-child {
    color: rgba(186, 215, 255, 0.58);
}
.fb-comp-grid {
    display: grid;
    grid-template-columns: repeat(6, minmax(58px, 1fr));
    gap: 8px;
}
.fb-comp-strip {
    --value: 0.5;
    position: relative;
    display: grid;
    grid-template-rows: auto 76px auto auto;
    justify-items: center;
    gap: 6px;
    min-width: 0;
    padding: 8px 6px;
    border: 1px solid rgba(113, 176, 255, 0.24);
    background: rgba(0, 0, 0, 0.32);
    overflow: hidden;
}
.fb-comp-label,
.fb-comp-readout {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: rgba(226, 238, 255, 0.84);
    font-size: 10px;
}
.fb-comp-readout {
    color: #71b0ff;
}
.fb-comp-meter {
    position: relative;
    width: 16px;
    height: 76px;
    border: 1px solid rgba(113, 176, 255, 0.34);
    background: #02070f;
    overflow: hidden;
    pointer-events: none;
}
.fb-comp-fill {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: calc(var(--value) * 100%);
    background: linear-gradient(0deg, #71b0ff, #f1d37d);
}
.fb-comp-range {
    position: absolute;
    inset: 0;
    z-index: 3;
    width: 100%;
    height: 100%;
    opacity: 0;
    pointer-events: none;
    cursor: ns-resize;
    accent-color: #71b0ff;
}
@media (max-width: 760px) {
    .fb-comp-grid {
        grid-template-columns: repeat(3, minmax(58px, 1fr));
    }
}
`,
        create(context, settings) {
            const input = context.createGain();
            const output = context.createGain();
            const compressor = context.createDynamicsCompressor();
            const makeup = context.createGain();
            compressor.threshold.value = clamp(settings.threshold, -60, 0);
            compressor.ratio.value = clamp(settings.ratio, 1, 20);
            compressor.attack.value = clamp(settings.attack, 0.001, 0.12);
            compressor.release.value = clamp(settings.release, 0.02, 1);
            compressor.knee.value = clamp(settings.knee, 0, 40);
            makeup.gain.value = clamp(settings.makeup, 0.25, 2.5);
            input.connect(compressor);
            compressor.connect(makeup);
            makeup.connect(output);
            return { input, output, nodes: [compressor, makeup] };
        },
        renderGui(api) {
            const root = document.createElement('div');
            root.className = 'fb-comp-panel';
            const title = document.createElement('div');
            title.className = 'fb-comp-title';
            title.innerHTML = '<span>compressor</span><span>dynamics desk</span>';
            const grid = document.createElement('div');
            grid.className = 'fb-comp-grid';
            api.params.forEach(param => grid.append(makeStrip(param, api.settings, api.setParam)));
            root.append(title, grid);
            return root;
        }
    });
})();
