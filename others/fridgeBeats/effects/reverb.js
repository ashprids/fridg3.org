(function () {
    const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));

    function curveText(value, suffix) {
        const number = Number(value) || 0;
        return number.toFixed(number >= 10 ? 0 : 2).replace(/\.00$/, '') + (suffix || '');
    }

    function snap(value, min, max, step) {
        const size = Number(step) || 0.01;
        return clamp(min + (Math.round((value - min) / size) * size), min, max);
    }

    function makeFader(param, settings, setParam) {
        const min = Number(param.min ?? 0);
        const max = Number(param.max ?? 1);
        const current = clamp(settings[param.id], min, max);
        const ratio = (current - min) / Math.max(0.0001, max - min);
        const wrap = document.createElement('label');
        wrap.className = 'fb-reverb-fader';
        wrap.style.setProperty('--value', String(ratio));

        const name = document.createElement('span');
        name.className = 'fb-reverb-fader-name';
        name.textContent = param.label || param.id;

        const rail = document.createElement('span');
        rail.className = 'fb-reverb-rail';
        const fill = document.createElement('span');
        fill.className = 'fb-reverb-fill';
        const handle = document.createElement('span');
        handle.className = 'fb-reverb-handle';
        rail.append(fill, handle);

        const readout = document.createElement('span');
        readout.className = 'fb-reverb-readout';
        readout.textContent = curveText(current, param.unit);

        const input = document.createElement('input');
        input.className = 'fb-reverb-hidden-range';
        input.type = 'range';
        input.min = String(min);
        input.max = String(max);
        input.step = String(param.step ?? 0.01);
        input.value = String(current);
        const update = () => {
            const next = clamp(input.value, min, max);
            const nextRatio = (next - min) / Math.max(0.0001, max - min);
            wrap.style.setProperty('--value', String(nextRatio));
            readout.textContent = curveText(next, param.unit);
            setParam(param.id, next);
        };
        input.addEventListener('input', update);
        input.addEventListener('change', update);
        const drag = event => {
            const rect = rail.getBoundingClientRect();
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

        wrap.append(name, rail, readout, input);
        return wrap;
    }

    function impulse(context, settings) {
        const seconds = clamp(settings.size, 0.25, 6);
        const decay = clamp(settings.decay, 0.3, 9);
        const damping = clamp(settings.damping, 900, 12000);
        const shimmer = clamp(settings.shimmer, 0, 1);
        const sampleRate = context.sampleRate;
        const length = Math.max(1, Math.floor(sampleRate * seconds));
        const buffer = context.createBuffer(2, length, sampleRate);
        const dampRatio = 1 - ((damping - 900) / (12000 - 900));

        for (let channel = 0; channel < 2; channel += 1) {
            const data = buffer.getChannelData(channel);
            let previous = 0;
            for (let i = 0; i < length; i += 1) {
                const t = i / length;
                const envelope = Math.pow(1 - t, decay);
                const early = i < sampleRate * 0.055 ? Math.sin(i * (channel ? 0.041 : 0.037)) * 0.34 : 0;
                const glass = Math.sin(i * (0.013 + shimmer * 0.012 + channel * 0.002)) * shimmer * 0.24;
                const noise = ((Math.random() * 2) - 1) + early + glass;
                previous = (previous * dampRatio) + (noise * (1 - dampRatio));
                data[i] = previous * envelope;
            }
        }
        return buffer;
    }

    window.fridgeBeatsEffects.register({
        id: 'reverb',
        name: 'Glass Hall',
        params: [
            { id: 'size', label: 'room', type: 'range', min: 0.25, max: 6, step: 0.05, default: 2.4, unit: 's' },
            { id: 'decay', label: 'tail', type: 'range', min: 0.3, max: 9, step: 0.05, default: 3.2 },
            { id: 'damping', label: 'damp', type: 'range', min: 900, max: 12000, step: 100, default: 5400, unit: 'hz' },
            { id: 'predelay', label: 'pre', type: 'range', min: 0, max: 0.18, step: 0.005, default: 0.025, unit: 's' },
            { id: 'shimmer', label: 'shine', type: 'range', min: 0, max: 1, step: 0.01, default: 0.22 },
            { id: 'mix', label: 'wet', type: 'range', min: 0, max: 1, step: 0.01, default: 0.34 }
        ],
        presets: [
            { name: 'Cathedral', settings: { size: 5.7, decay: 7.6, damping: 4100, predelay: 0.055, shimmer: 0.28, mix: 0.52 } },
            { name: 'Small Room', settings: { size: 0.62, decay: 1.15, damping: 7800, predelay: 0.005, shimmer: 0.06, mix: 0.18 } },
            { name: 'Vocal Plate', settings: { size: 2.1, decay: 3.8, damping: 6400, predelay: 0.035, shimmer: 0.18, mix: 0.31 } },
            { name: 'Dream Pad', settings: { size: 4.4, decay: 6.4, damping: 5200, predelay: 0.08, shimmer: 0.72, mix: 0.58 } },
            { name: 'Drum Room', settings: { size: 1.05, decay: 1.7, damping: 9200, predelay: 0.012, shimmer: 0.04, mix: 0.24 } }
        ],
        css: `
.fb-reverb-vault {
    margin: 9px;
    padding: 12px;
    border: 1px solid rgba(162, 226, 255, 0.46);
    border-radius: 3px;
    background:
        linear-gradient(90deg, rgba(162, 226, 255, 0.08) 1px, transparent 1px),
        linear-gradient(0deg, rgba(162, 226, 255, 0.06) 1px, transparent 1px),
        linear-gradient(145deg, rgba(5, 10, 14, 0.98), rgba(18, 9, 28, 0.94));
    background-size: 18px 18px, 18px 18px, auto;
    box-shadow: inset 0 0 22px rgba(162, 226, 255, 0.08), 0 10px 24px rgba(0, 0, 0, 0.35);
}
.fb-reverb-title {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 10px;
    align-items: end;
    margin-bottom: 12px;
}
.fb-reverb-title strong {
    color: #d9f6ff;
    font-family: "MainBold", monospace;
    font-size: 13px;
}
.fb-reverb-title span {
    color: rgba(217, 246, 255, 0.58);
    font-size: 11px;
}
.fb-reverb-faders {
    display: grid;
    grid-template-columns: repeat(6, minmax(54px, 1fr));
    gap: 9px;
}
.fb-reverb-fader {
    --value: 0.5;
    position: relative;
    display: grid;
    grid-template-rows: auto 112px auto;
    justify-items: center;
    gap: 7px;
    min-width: 0;
    padding: 8px 6px;
    border: 1px solid rgba(162, 226, 255, 0.22);
    background: rgba(0, 0, 0, 0.32);
    overflow: hidden;
}
.fb-reverb-fader-name,
.fb-reverb-readout {
    color: rgba(217, 246, 255, 0.82);
    font-size: 10px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
}
.fb-reverb-readout {
    color: #a2e2ff;
}
.fb-reverb-rail {
    position: relative;
    width: 18px;
    height: 112px;
    border: 1px solid rgba(162, 226, 255, 0.36);
    background: rgba(1, 5, 8, 0.88);
    overflow: hidden;
    pointer-events: none;
}
.fb-reverb-fill {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: calc(var(--value) * 100%);
    background: linear-gradient(0deg, rgba(162, 226, 255, 0.92), rgba(206, 164, 255, 0.72));
}
.fb-reverb-handle {
    position: absolute;
    left: -7px;
    right: -7px;
    bottom: calc(var(--value) * 100% - 5px);
    height: 10px;
    border: 1px solid rgba(255, 255, 255, 0.68);
    background: #e7f9ff;
    box-shadow: 0 0 12px rgba(162, 226, 255, 0.7);
}
.fb-reverb-hidden-range {
    position: absolute;
    inset: 0;
    z-index: 3;
    width: 100%;
    height: 100%;
    opacity: 0;
    pointer-events: none;
    cursor: ns-resize;
    accent-color: #a2e2ff;
}
@media (max-width: 760px) {
    .fb-reverb-faders {
        grid-template-columns: repeat(3, minmax(54px, 1fr));
    }
}
`,
        create(context, settings) {
            const input = context.createGain();
            const output = context.createGain();
            const dry = context.createGain();
            const wet = context.createGain();
            const preDelay = context.createDelay(0.25);
            const convolver = context.createConvolver();
            const lowpass = context.createBiquadFilter();
            const highShelf = context.createBiquadFilter();
            const mix = clamp(settings.mix, 0, 1);

            dry.gain.value = 1 - (mix * 0.72);
            wet.gain.value = mix;
            preDelay.delayTime.value = clamp(settings.predelay, 0, 0.18);
            convolver.buffer = impulse(context, settings);
            lowpass.type = 'lowpass';
            lowpass.frequency.value = clamp(settings.damping, 900, 12000);
            highShelf.type = 'highshelf';
            highShelf.frequency.value = 5200;
            highShelf.gain.value = clamp(settings.shimmer, 0, 1) * 8;

            input.connect(dry);
            dry.connect(output);
            input.connect(preDelay);
            preDelay.connect(convolver);
            convolver.connect(lowpass);
            lowpass.connect(highShelf);
            highShelf.connect(wet);
            wet.connect(output);

            return { input, output, nodes: [dry, wet, preDelay, convolver, lowpass, highShelf] };
        },
        renderGui(api) {
            const root = document.createElement('div');
            root.className = 'fb-reverb-vault';
            const title = document.createElement('div');
            title.className = 'fb-reverb-title';
            title.innerHTML = '<strong>glass hall</strong><span>stereo impulse chamber</span>';
            const faders = document.createElement('div');
            faders.className = 'fb-reverb-faders';
            api.params.forEach(param => faders.append(makeFader(param, api.settings, api.setParam)));
            root.append(title, faders);
            return root;
        }
    });
})();
