(function () {
    const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));

    function crushSample(value, bits) {
        const levels = Math.max(2, Math.pow(2, Math.round(bits)));
        return Math.round(value * levels) / levels;
    }

    function makeLed(param, settings, setParam) {
        const min = Number(param.min ?? 0);
        const max = Number(param.max ?? 1);
        const current = clamp(settings[param.id], min, max);
        const ratio = (current - min) / Math.max(0.0001, max - min);
        const wrap = document.createElement('label');
        wrap.className = 'fb-crush-control';
        wrap.style.setProperty('--value', String(ratio));

        const label = document.createElement('span');
        label.className = 'fb-crush-label';
        label.textContent = param.label || param.id;

        const display = document.createElement('span');
        display.className = 'fb-crush-display';
        display.textContent = String(current.toFixed((param.step || 1) >= 1 ? 0 : 2)).replace(/\.00$/, '') + (param.unit || '');

        const input = document.createElement('input');
        input.className = 'fb-crush-range';
        input.type = 'range';
        input.min = String(min);
        input.max = String(max);
        input.step = String(param.step ?? 1);
        input.value = String(current);

        const chips = document.createElement('span');
        chips.className = 'fb-crush-chips';
        for (let index = 0; index < 10; index += 1) {
            const chip = document.createElement('span');
            chip.className = index / 9 <= ratio ? 'is-lit' : '';
            chips.append(chip);
        }

        const update = () => {
            const next = clamp(input.value, min, max);
            const nextRatio = (next - min) / Math.max(0.0001, max - min);
            wrap.style.setProperty('--value', String(nextRatio));
            display.textContent = String(next.toFixed((param.step || 1) >= 1 ? 0 : 2)).replace(/\.00$/, '') + (param.unit || '');
            Array.from(chips.children).forEach((chip, index) => {
                chip.classList.toggle('is-lit', index / 9 <= nextRatio);
            });
            setParam(param.id, next);
        };
        input.addEventListener('input', update);
        input.addEventListener('change', update);

        wrap.append(label, display, chips, input);
        return wrap;
    }

    window.fridgeBeatsEffects.register({
        id: 'bitcrush',
        name: 'Bitcrush',
        params: [
            { id: 'bits', label: 'bits', type: 'range', min: 2, max: 16, step: 1, default: 7 },
            { id: 'rate', label: 'rate', type: 'range', min: 1, max: 40, step: 1, default: 9 },
            { id: 'jitter', label: 'jitter', type: 'range', min: 0, max: 1, step: 0.01, default: 0.08 },
            { id: 'mix', label: 'mix', type: 'range', min: 0, max: 1, step: 0.01, default: 0.72 },
            { id: 'output', label: 'out', type: 'range', min: 0.15, max: 1.2, step: 0.01, default: 0.9 }
        ],
        presets: [
            { name: 'Retro Console', settings: { bits: 8, rate: 6, jitter: 0.03, mix: 0.58, output: 0.92 } },
            { name: 'Crushed Drums', settings: { bits: 5, rate: 14, jitter: 0.12, mix: 0.78, output: 0.82 } },
            { name: 'Telephone Lead', settings: { bits: 6, rate: 18, jitter: 0.04, mix: 0.64, output: 0.88 } },
            { name: 'Data Rot', settings: { bits: 3, rate: 32, jitter: 0.42, mix: 0.9, output: 0.66 } },
            { name: 'Chiptune Pad', settings: { bits: 9, rate: 10, jitter: 0.01, mix: 0.48, output: 0.94 } }
        ],
        css: `
.fb-crush-panel {
    margin: 9px;
    padding: 12px;
    border: 1px solid rgba(151, 126, 182, 0.55);
    border-radius: 2px;
    background:
        linear-gradient(90deg, rgba(151, 126, 182, 0.16) 50%, transparent 50%),
        linear-gradient(180deg, rgba(4, 2, 8, 0.98), rgba(0, 0, 0, 0.98));
    background-size: 8px 8px, auto;
    box-shadow: inset 0 0 20px rgba(151, 126, 182, 0.12), 0 10px 24px rgba(0, 0, 0, 0.36);
}
.fb-crush-title {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 10px;
    margin-bottom: 11px;
    color: #d8c7ff;
    font-family: "MainBold", monospace;
    font-size: 12px;
    text-transform: uppercase;
}
.fb-crush-title span:last-child {
    color: rgba(216, 199, 255, 0.56);
}
.fb-crush-grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(76px, 1fr));
    gap: 9px;
}
.fb-crush-control {
    position: relative;
    display: grid;
    gap: 7px;
    min-width: 0;
    padding: 9px 7px;
    border: 1px solid rgba(151, 126, 182, 0.28);
    background: rgba(0, 0, 0, 0.42);
    overflow: hidden;
}
.fb-crush-label,
.fb-crush-display {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: rgba(239, 231, 255, 0.82);
    font-size: 10px;
}
.fb-crush-display {
    color: #aeea88;
    font-family: "MainBold", monospace;
}
.fb-crush-chips {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 3px;
    pointer-events: none;
}
.fb-crush-chips span {
    height: 12px;
    border: 1px solid rgba(216, 199, 255, 0.24);
    background: rgba(255, 255, 255, 0.04);
}
.fb-crush-chips span.is-lit {
    background: #aeea88;
    box-shadow: 0 0 9px rgba(174, 234, 136, 0.65);
}
.fb-crush-range {
    position: absolute;
    inset: 0;
    z-index: 3;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: ew-resize;
    accent-color: #aeea88;
}
@media (max-width: 760px) {
    .fb-crush-grid {
        grid-template-columns: repeat(2, minmax(76px, 1fr));
    }
}
`,
        create(context, settings) {
            const input = context.createGain();
            const output = context.createGain();
            const dry = context.createGain();
            const wet = context.createGain();
            const post = context.createGain();
            const processor = context.createScriptProcessor(1024, 1, 1);
            const bits = clamp(settings.bits, 2, 16);
            const reduction = Math.max(1, Math.round(clamp(settings.rate, 1, 40)));
            const jitter = clamp(settings.jitter, 0, 1);
            const mix = clamp(settings.mix, 0, 1);
            let hold = 0;
            let phase = 0;

            dry.gain.value = 1 - (mix * 0.85);
            wet.gain.value = mix;
            post.gain.value = clamp(settings.output, 0.15, 1.2);
            processor.onaudioprocess = event => {
                const source = event.inputBuffer.getChannelData(0);
                const dest = event.outputBuffer.getChannelData(0);
                for (let index = 0; index < source.length; index += 1) {
                    const chance = jitter ? Math.random() * jitter * reduction : 0;
                    if (phase <= 0) {
                        hold = crushSample(source[index], bits);
                        phase = reduction + chance;
                    }
                    dest[index] = hold;
                    phase -= 1;
                }
            };

            input.connect(dry);
            dry.connect(output);
            input.connect(processor);
            processor.connect(wet);
            wet.connect(post);
            post.connect(output);

            return { input, output, nodes: [dry, wet, post, processor] };
        },
        renderGui(api) {
            const root = document.createElement('div');
            root.className = 'fb-crush-panel';
            const title = document.createElement('div');
            title.className = 'fb-crush-title';
            title.innerHTML = '<span>bitcrush</span><span>sample mangler</span>';
            const grid = document.createElement('div');
            grid.className = 'fb-crush-grid';
            api.params.forEach(param => grid.append(makeLed(param, api.settings, api.setParam)));
            root.append(title, grid);
            return root;
        }
    });
})();
