(function () {
    const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));

    function readout(value, unit = '') {
        return String(Math.round(Number(value) * 100) / 100) + unit;
    }

    function waveSample(type, phase) {
        if (type === 'square') return phase < 0.5 ? 1 : -1;
        if (type === 'sawtooth') return (phase * 2) - 1;
        if (type === 'triangle') return 1 - (4 * Math.abs(phase - 0.5));
        return Math.sin(phase * Math.PI * 2);
    }

    function drawScope(canvas, settings) {
        const rect = canvas.getBoundingClientRect();
        const dpr = Math.max(1, window.devicePixelRatio || 1);
        const width = Math.max(1, Math.round((rect.width || 640) * dpr));
        const height = Math.max(1, Math.round((rect.height || 240) * dpr));
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
        }
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const cssWidth = width / dpr;
        const cssHeight = height / dpr;
        ctx.clearRect(0, 0, cssWidth, cssHeight);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
        ctx.fillRect(0, 0, cssWidth, cssHeight);

        const voices = Math.max(1, Math.min(16, Math.round(Number(settings.unison) || 1)));
        const detune = clamp(settings.detune, 0, 1);
        ctx.lineWidth = 2;
        ctx.shadowBlur = 8;
        ctx.shadowColor = 'rgba(134, 211, 207, 0.38)';
        ctx.strokeStyle = 'rgba(134, 211, 207, 0.9)';
        ctx.beginPath();
        for (let x = 0; x < cssWidth; x += 1) {
            const t = x / Math.max(1, cssWidth - 1);
            let value = 0;
            for (let voice = 0; voice < voices; voice += 1) {
                const position = voices === 1 ? 0 : (voice / (voices - 1)) * 2 - 1;
                const phase = (t * (3 + detune * 1.4 * position) + 0.08 * voice) % 1;
                value += waveSample(settings.wave || 'sawtooth', phase);
            }
            value /= Math.max(1, voices);
            const y = (cssHeight * 0.5) - (value * cssHeight * 0.34);
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.strokeStyle = 'rgba(200, 132, 32, 0.55)';
        ctx.lineWidth = 1;
        const attackX = Math.min(cssWidth * 0.34, cssWidth * clamp(settings.attack, 0.002, 0.6) / 0.6);
        const releaseX = cssWidth - Math.min(cssWidth * 0.34, cssWidth * clamp(settings.release, 0.02, 1.6) / 1.6);
        [attackX, releaseX].forEach(x => {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, cssHeight);
            ctx.stroke();
        });
        ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    function makeControl(param, api, onUpdate) {
        const wrap = document.createElement('label');
        wrap.className = 'fb-wave-osc-control';
        const name = document.createElement('span');
        name.textContent = param.label || param.id;
        if (param.type === 'select') {
            const select = document.createElement('select');
            select.className = 'fb-select';
            (param.options || []).forEach(option => {
                const item = document.createElement('option');
                item.value = option;
                item.textContent = option;
                item.selected = option === api.settings[param.id];
                select.append(item);
            });
            select.addEventListener('change', () => {
                api.setParam(param.id, select.value);
                if (onUpdate) onUpdate();
            });
            wrap.append(name, select);
            return wrap;
        }
        const min = Number(param.min ?? 0);
        const max = Number(param.max ?? 1);
        const value = clamp(api.settings[param.id], min, max);
        wrap.style.setProperty('--value', String((value - min) / Math.max(0.0001, max - min)));
        const meter = document.createElement('span');
        meter.className = 'fb-wave-osc-meter';
        const valueEl = document.createElement('strong');
        valueEl.textContent = readout(value, param.unit || '');
        const input = document.createElement('input');
        input.type = 'range';
        input.min = String(min);
        input.max = String(max);
        input.step = String(param.step ?? 0.01);
        input.value = String(value);
        const sync = () => {
            const next = clamp(input.value, min, max);
            wrap.style.setProperty('--value', String((next - min) / Math.max(0.0001, max - min)));
            valueEl.textContent = readout(next, param.unit || '');
            api.setParam(param.id, next);
            if (onUpdate) onUpdate();
        };
        input.addEventListener('input', sync);
        input.addEventListener('change', sync);
        wrap.append(name, meter, valueEl, input);
        return wrap;
    }

    function voiceSettings(settings, volume, pan) {
        const voices = Math.max(1, Math.min(16, Math.round(Number(settings.unison) || 1)));
        const detune = clamp(settings.detune, 0, 1);
        return Array.from({ length: voices }, (_, index) => {
            const position = voices === 1 ? 0 : (index / (voices - 1)) * 2 - 1;
            return {
                cents: position * detune * 64,
                pan: Math.max(-1, Math.min(1, pan + (position * (voices > 1 ? 0.45 : 0)))),
                gain: Math.max(0.001, volume) / Math.sqrt(voices)
            };
        });
    }

    window.fridgeBeatsSynths.register({
        id: 'wave-oscillator',
        name: 'Wave Oscillator',
        params: [
            { id: 'wave', label: 'wave', type: 'select', options: ['sine', 'square', 'sawtooth', 'triangle'], default: 'sawtooth' },
            { id: 'unison', label: 'unison', type: 'range', min: 1, max: 16, step: 1, default: 1 },
            { id: 'detune', label: 'detune', type: 'range', min: 0, max: 1, step: 0.01, default: 0.08 },
            { id: 'attack', label: 'attack', type: 'range', min: 0.002, max: 0.6, step: 0.001, default: 0.006, unit: 's' },
            { id: 'release', label: 'release', type: 'range', min: 0.02, max: 1.6, step: 0.01, default: 0.11, unit: 's' }
        ],
        presets: [
            { name: 'Default Saw', settings: { wave: 'sawtooth', unison: 1, detune: 0.08, attack: 0.006, release: 0.11 } },
            { name: 'Wide Lead', settings: { wave: 'sawtooth', unison: 6, detune: 0.24, attack: 0.004, release: 0.18 } },
            { name: 'Square Bass', settings: { wave: 'square', unison: 2, detune: 0.06, attack: 0.003, release: 0.08 } },
            { name: 'Soft Pad', settings: { wave: 'triangle', unison: 8, detune: 0.18, attack: 0.22, release: 0.82 } },
            { name: 'Pure Sine', settings: { wave: 'sine', unison: 1, detune: 0, attack: 0.012, release: 0.26 } }
        ],
        css: `
.fb-wave-osc-panel {
    height: 100%;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    gap: 12px;
    border: 1px solid rgba(134,211,207,0.42);
    background:
        linear-gradient(120deg, rgba(134,211,207,0.12), transparent 36%),
        linear-gradient(145deg, rgba(0,0,0,0.92), rgba(8,18,18,0.98));
    border-radius: 6px;
    padding: 14px;
    box-sizing: border-box;
    overflow: hidden;
}
.fb-wave-osc-head {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    color: #86d3cf;
    font-family: "MainBold", monospace;
    font-size: 12px;
    text-transform: uppercase;
}
.fb-wave-osc-head span:last-child {
    color: rgba(255,255,255,0.52);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.fb-wave-osc-scope {
    position: relative;
    min-height: 130px;
    border: 1px solid rgba(60,120,149,0.6);
    background:
        repeating-linear-gradient(90deg, rgba(60,120,149,0.22) 0 1px, transparent 1px 28px),
        repeating-linear-gradient(0deg, rgba(60,120,149,0.16) 0 1px, transparent 1px 22px),
        rgba(0,0,0,0.58);
    overflow: hidden;
}
.fb-wave-osc-scope::before {
    content: "scope";
    position: absolute;
    top: 8px;
    left: 10px;
    z-index: 1;
    color: rgba(134,211,207,0.42);
    font-size: 10px;
    text-transform: uppercase;
}
.fb-wave-osc-scope::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent, rgba(200,132,32,0.18), transparent);
    transform: translateX(calc((var(--detune, 0.08) * 70%) - 35%));
    pointer-events: none;
}
.fb-wave-osc-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
}
.fb-wave-osc-controls {
    display: grid;
    grid-template-columns: repeat(5, minmax(74px, 1fr));
    gap: 8px;
}
.fb-wave-osc-control {
    --value: 0.5;
    position: relative;
    display: grid;
    gap: 6px;
    min-width: 0;
    padding: 8px;
    border: 1px solid rgba(134,211,207,0.24);
    background: rgba(0,0,0,0.35);
}
.fb-wave-osc-control span,
.fb-wave-osc-control strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: rgba(230,255,252,0.84);
    font-size: 10px;
}
.fb-wave-osc-control strong { color: #c88420; }
.fb-wave-osc-meter {
    height: 34px;
    border: 1px solid rgba(134,211,207,0.28);
    background:
        linear-gradient(0deg, rgba(134,211,207,0.58) calc(var(--value) * 100%), transparent 0),
        rgba(0,0,0,0.48);
}
.fb-wave-osc-control input[type="range"] {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: ew-resize;
}
@media (max-width: 760px) {
    .fb-wave-osc-controls { grid-template-columns: repeat(2, minmax(74px, 1fr)); }
}
`,
        createVoice(context, api) {
            const settings = api.settings;
            const duration = Math.max(0.04, api.duration || 3600);
            const attack = clamp(settings.attack, 0.002, 0.6);
            const release = clamp(settings.release, 0.02, 1.6);
            const end = api.time + duration;
            const frequency = Math.max(1, api.frequency);
            const target = api.targetFrequency ? Math.max(1, api.targetFrequency) : null;
            const nodes = [];
            const voices = voiceSettings(settings, api.channel.volume * api.velocity, api.channel.pan);

            voices.forEach(voice => {
                const osc = context.createOscillator();
                const gain = context.createGain();
                const pan = context.createStereoPanner();
                osc.type = settings.wave;
                osc.frequency.setValueAtTime(frequency, api.time);
                if (target) {
                    osc.frequency.exponentialRampToValueAtTime(target, Math.max(api.time + 0.01, end - release));
                }
                osc.detune.setValueAtTime(voice.cents, api.time);
                gain.gain.setValueAtTime(0.0001, api.time);
                gain.gain.exponentialRampToValueAtTime(Math.max(0.001, voice.gain), api.time + attack);
                if (api.duration) {
                    gain.gain.setValueAtTime(Math.max(0.001, voice.gain), Math.max(api.time + attack, end - release));
                    gain.gain.exponentialRampToValueAtTime(0.0001, end);
                }
                pan.pan.value = voice.pan;
                osc.connect(gain);
                gain.connect(pan);
                pan.connect(api.output);
                osc.start(api.time);
                if (api.duration) osc.stop(end + 0.02);
                nodes.push(osc, gain, pan);
            });

            return {
                nodes,
                stop() {
                    const now = context.currentTime;
                    nodes.forEach(node => {
                        if (node.gain) {
                            node.gain.cancelScheduledValues(now);
                            node.gain.setValueAtTime(Math.max(0.0001, node.gain.value), now);
                            node.gain.exponentialRampToValueAtTime(0.0001, now + release);
                        }
                        if (typeof node.stop === 'function') node.stop(now + release + 0.02);
                    });
                }
            };
        },
        renderGui(api) {
            const root = document.createElement('div');
            root.className = 'fb-wave-osc-panel';
            root.style.setProperty('--detune', String(api.settings.detune || 0));
            const head = document.createElement('div');
            head.className = 'fb-wave-osc-head';
            head.innerHTML = '<span>wave oscillator</span><span>classic source, synth body</span>';
            const scope = document.createElement('div');
            scope.className = 'fb-wave-osc-scope';
            const canvas = document.createElement('canvas');
            canvas.className = 'fb-wave-osc-canvas';
            const redraw = () => {
                root.style.setProperty('--detune', String(api.settings.detune || 0));
                window.requestAnimationFrame(() => drawScope(canvas, api.settings));
            };
            scope.append(canvas);
            const controls = document.createElement('div');
            controls.className = 'fb-wave-osc-controls';
            api.params.forEach(param => controls.append(makeControl(param, api, redraw)));
            root.append(head, scope, controls);
            window.requestAnimationFrame(() => drawScope(canvas, api.settings));
            if (window.ResizeObserver) {
                const observer = new ResizeObserver(() => drawScope(canvas, api.settings));
                observer.observe(scope);
            }
            return root;
        }
    });
})();
