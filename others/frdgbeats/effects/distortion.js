(function () {
    const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
    const cabinets = {
        direct: { label: 'direct', low: 35, high: 12000, mid: 1000, gain: 0, q: 0.7 },
        combo: { label: 'open combo', low: 95, high: 6200, mid: 1800, gain: 2.5, q: 0.9 },
        stack: { label: '4x12 stack', low: 75, high: 5200, mid: 1150, gain: 4.5, q: 1.1 },
        bass: { label: 'bass cab', low: 45, high: 4200, mid: 520, gain: 3.5, q: 0.8 },
        radio: { label: 'radio box', low: 260, high: 3200, mid: 1350, gain: 6.5, q: 1.4 }
    };
    const cabinetIds = Object.keys(cabinets);

    function makeCurve(drive, fold) {
        const samples = 2048;
        const curve = new Float32Array(samples);
        const amount = clamp(drive, 0, 1) * 44 + 1;
        const foldAmount = clamp(fold, 0, 1);
        for (let i = 0; i < samples; i += 1) {
            const x = (i * 2 / samples) - 1;
            let y = Math.tanh(x * amount);
            if (foldAmount > 0) {
                const folded = Math.sin(x * Math.PI * (1 + foldAmount * 5));
                y = (y * (1 - foldAmount)) + (folded * foldAmount);
            }
            curve[i] = y;
        }
        return curve;
    }

    function readout(value, param) {
        const number = Number(value) || 0;
        const fixed = (param.step || 0.01) >= 1 ? 0 : 2;
        return number.toFixed(fixed).replace(/\.00$/, '') + (param.unit || '');
    }

    function makePad(param, settings, setParam) {
        if (param.type === 'select') return makeSelectPad(param, settings, setParam);
        const min = Number(param.min ?? 0);
        const max = Number(param.max ?? 1);
        const current = clamp(settings[param.id], min, max);
        const ratio = (current - min) / Math.max(0.0001, max - min);
        const wrap = document.createElement('label');
        wrap.className = 'fb-dist-pad';
        wrap.style.setProperty('--value', String(ratio));

        const meter = document.createElement('span');
        meter.className = 'fb-dist-meter';
        const spark = document.createElement('span');
        spark.className = 'fb-dist-spark';
        meter.append(spark);

        const label = document.createElement('span');
        label.className = 'fb-dist-label';
        label.textContent = param.label || param.id;

        const value = document.createElement('span');
        value.className = 'fb-dist-value';
        value.textContent = readout(current, param);

        const input = document.createElement('input');
        input.className = 'fb-dist-range';
        input.type = 'range';
        input.min = String(min);
        input.max = String(max);
        input.step = String(param.step ?? 0.01);
        input.value = String(current);
        const update = () => {
            const next = clamp(input.value, min, max);
            const nextRatio = (next - min) / Math.max(0.0001, max - min);
            wrap.style.setProperty('--value', String(nextRatio));
            value.textContent = readout(next, param);
            setParam(param.id, next);
        };
        input.addEventListener('input', update);
        input.addEventListener('change', update);

        wrap.append(meter, label, value, input);
        return wrap;
    }

    function makeSelectPad(param, settings, setParam) {
        const wrap = document.createElement('label');
        wrap.className = 'fb-dist-pad fb-dist-select-pad';
        const meter = document.createElement('span');
        meter.className = 'fb-dist-meter';
        const spark = document.createElement('span');
        spark.className = 'fb-dist-spark';
        spark.style.width = '100%';
        meter.append(spark);
        const label = document.createElement('span');
        label.className = 'fb-dist-label';
        label.textContent = param.label || param.id;
        const select = document.createElement('select');
        select.className = 'fb-dist-select';
        const value = param.options.includes(settings[param.id]) ? settings[param.id] : param.default;
        param.options.forEach(option => {
            const item = document.createElement('option');
            item.value = option;
            item.textContent = cabinets[option] ? cabinets[option].label : option;
            item.selected = option === value;
            select.append(item);
        });
        select.addEventListener('change', () => setParam(param.id, select.value));
        wrap.append(meter, label, select);
        return wrap;
    }

    window.frdgBeatsEffects.register({
        id: 'distortion',
        name: 'Hot Circuit',
        params: [
            { id: 'drive', label: 'drive', type: 'range', min: 0, max: 1, step: 0.01, default: 0.46 },
            { id: 'fold', label: 'fold', type: 'range', min: 0, max: 1, step: 0.01, default: 0.08 },
            { id: 'cabinet', label: 'cab', type: 'select', options: cabinetIds, default: 'combo' },
            { id: 'tone', label: 'tone', type: 'range', min: 600, max: 12000, step: 100, default: 5200, unit: 'hz' },
            { id: 'mix', label: 'mix', type: 'range', min: 0, max: 1, step: 0.01, default: 0.62 },
            { id: 'output', label: 'out', type: 'range', min: 0.15, max: 1.4, step: 0.01, default: 0.82 }
        ],
        presets: [
            { name: 'Guitar Amp', settings: { drive: 0.58, fold: 0.05, cabinet: 'combo', tone: 4600, mix: 0.78, output: 0.74 } },
            { name: 'Arena Stack', settings: { drive: 0.72, fold: 0.08, cabinet: 'stack', tone: 5200, mix: 0.82, output: 0.66 } },
            { name: 'Drum Smasher', settings: { drive: 0.82, fold: 0.18, cabinet: 'direct', tone: 6800, mix: 0.66, output: 0.62 } },
            { name: 'Warm Saturation', settings: { drive: 0.28, fold: 0, cabinet: 'direct', tone: 7600, mix: 0.42, output: 0.94 } },
            { name: 'Broken Speaker', settings: { drive: 0.94, fold: 0.64, cabinet: 'radio', tone: 2300, mix: 0.86, output: 0.48 } },
            { name: 'Acid Bass', settings: { drive: 0.67, fold: 0.32, cabinet: 'bass', tone: 3900, mix: 0.72, output: 0.68 } }
        ],
        css: `
.fb-dist-console {
    margin: 9px;
    padding: 12px;
    border: 1px solid rgba(255, 93, 78, 0.52);
    border-radius: 4px;
    background:
        repeating-linear-gradient(135deg, rgba(255, 93, 78, 0.08) 0 8px, transparent 8px 16px),
        linear-gradient(145deg, rgba(31, 5, 4, 0.98), rgba(5, 5, 5, 0.98));
    box-shadow: inset 0 0 24px rgba(255, 93, 78, 0.12), 0 10px 24px rgba(0, 0, 0, 0.36);
}
.fb-dist-title {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 11px;
    color: #ffb0a7;
    font-family: "MainBold", monospace;
    font-size: 12px;
    text-transform: uppercase;
}
.fb-dist-title span:last-child {
    color: rgba(255, 176, 167, 0.58);
}
.fb-dist-pads {
    display: grid;
    grid-template-columns: repeat(6, minmax(58px, 1fr));
    gap: 7px;
}
.fb-dist-pad {
    --value: 0.5;
    position: relative;
    display: grid;
    gap: 6px;
    justify-items: center;
    min-width: 0;
    padding: 8px 6px;
    border: 1px solid rgba(255, 93, 78, 0.25);
    background: rgba(0, 0, 0, 0.34);
    overflow: hidden;
}
.fb-dist-meter {
    position: relative;
    width: 100%;
    height: 36px;
    border: 1px solid rgba(255, 176, 167, 0.36);
    background: #080101;
    overflow: hidden;
    pointer-events: none;
}
.fb-dist-spark {
    position: absolute;
    left: 0;
    bottom: 0;
    width: calc(var(--value) * 100%);
    height: 100%;
    background: linear-gradient(90deg, #ff5d4e, #ffbb55);
    box-shadow: 0 0 18px rgba(255, 93, 78, 0.7);
}
.fb-dist-label,
.fb-dist-value {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: rgba(255, 226, 220, 0.84);
    font-size: 10px;
}
.fb-dist-value {
    color: #ffbb55;
}
.fb-dist-range {
    position: absolute;
    inset: 0;
    z-index: 3;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: ew-resize;
    accent-color: #ff5d4e;
}
.fb-dist-select {
    position: relative;
    z-index: 4;
    width: 100%;
    min-width: 0;
    height: 28px;
    border: 1px solid rgba(255, 93, 78, 0.42);
    border-radius: 3px;
    background: #080101;
    color: #ffbb55;
    font-family: "MainRegular", monospace;
    font-size: 11px;
}
.fb-dist-select-pad .fb-dist-meter {
    height: 20px;
}
@media (max-width: 760px) {
    .fb-dist-pads {
        grid-template-columns: repeat(2, minmax(72px, 1fr));
    }
}
`,
        create(context, settings) {
            const input = context.createGain();
            const output = context.createGain();
            const dry = context.createGain();
            const wet = context.createGain();
            const shaper = context.createWaveShaper();
            const tone = context.createBiquadFilter();
            const cabLow = context.createBiquadFilter();
            const cabMid = context.createBiquadFilter();
            const cabHigh = context.createBiquadFilter();
            const post = context.createGain();
            const mix = clamp(settings.mix, 0, 1);
            const cabinet = cabinets[settings.cabinet] || cabinets.combo;

            dry.gain.value = 1 - (mix * 0.82);
            wet.gain.value = mix;
            shaper.curve = makeCurve(settings.drive, settings.fold);
            shaper.oversample = '4x';
            tone.type = 'lowpass';
            tone.frequency.value = clamp(settings.tone, 600, 12000);
            cabLow.type = 'highpass';
            cabLow.frequency.value = cabinet.low;
            cabLow.Q.value = 0.7;
            cabMid.type = 'peaking';
            cabMid.frequency.value = cabinet.mid;
            cabMid.gain.value = cabinet.gain;
            cabMid.Q.value = cabinet.q;
            cabHigh.type = 'lowpass';
            cabHigh.frequency.value = Math.min(cabinet.high, clamp(settings.tone, 600, 12000));
            cabHigh.Q.value = 0.7;
            post.gain.value = clamp(settings.output, 0.15, 1.4);

            input.connect(dry);
            dry.connect(output);
            input.connect(shaper);
            shaper.connect(tone);
            tone.connect(cabLow);
            cabLow.connect(cabMid);
            cabMid.connect(cabHigh);
            cabHigh.connect(wet);
            wet.connect(post);
            post.connect(output);

            return { input, output, nodes: [dry, wet, shaper, tone, cabLow, cabMid, cabHigh, post] };
        },
        renderGui(api) {
            const root = document.createElement('div');
            root.className = 'fb-dist-console';
            const title = document.createElement('div');
            title.className = 'fb-dist-title';
            title.innerHTML = '<span>hot circuit</span><span>waveshaper</span>';
            const pads = document.createElement('div');
            pads.className = 'fb-dist-pads';
            api.params.forEach(param => pads.append(makePad(param, api.settings, api.setParam)));
            root.append(title, pads);
            return root;
        }
    });
})();
