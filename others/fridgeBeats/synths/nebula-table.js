(function () {
    const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
    const waveNames = ['analog', 'digital', 'spectral', 'vowel', 'monster'];
    const audioCache = new WeakMap();

    function contextCache(context) {
        if (!audioCache.has(context)) {
            audioCache.set(context, {
                waves: new Map(),
                driveCurves: new Map(),
                noiseBuffer: null
            });
        }
        return audioCache.get(context);
    }

    function fmt(value, unit) {
        const number = Number(value) || 0;
        const places = Math.abs(number) >= 10 || unit === 'hz' ? 0 : 2;
        return number.toFixed(places).replace(/\.00$/, '') + (unit || '');
    }

    function waveSample(name, phase, warp) {
        const p = ((phase % 1) + 1) % 1;
        const bend = clamp(warp, 0, 1);
        if (name === 'digital') {
            const fold = Math.sin(Math.PI * 2 * p) + Math.sin(Math.PI * 10 * p) * (0.16 + bend * 0.48);
            return Math.tanh(fold * (1.4 + bend * 2.8));
        }
        if (name === 'spectral') {
            return (
                Math.sin(Math.PI * 2 * p) * 0.55 +
                Math.sin(Math.PI * 6 * p + bend * 1.8) * 0.32 +
                Math.sin(Math.PI * 14 * p) * (0.16 + bend * 0.28) +
                Math.sin(Math.PI * 24 * p) * bend * 0.16
            );
        }
        if (name === 'vowel') {
            const a = Math.sin(Math.PI * 2 * p);
            const e = Math.sin(Math.PI * 4 * p + 0.45) * (0.34 + bend * 0.24);
            const formant = Math.sin(Math.PI * (9 + bend * 10) * p) * (0.2 + bend * 0.32);
            return Math.tanh((a + e + formant) * 1.05);
        }
        if (name === 'monster') {
            const saw = (p * 2) - 1;
            const square = p < (0.5 + (bend - 0.5) * 0.35) ? 1 : -1;
            const bite = Math.sin(Math.PI * 2 * p * (3 + Math.round(bend * 8))) * 0.28;
            return Math.tanh((saw * 0.6 + square * 0.45 + bite) * (1.4 + bend * 1.8));
        }
        const saw = (p * 2) - 1;
        const tri = 1 - (4 * Math.abs(p - 0.5));
        return (saw * (0.74 - bend * 0.34)) + (tri * (0.18 + bend * 0.32)) + Math.sin(Math.PI * 2 * p) * 0.18;
    }

    function makePeriodicWave(context, name, warp) {
        const cache = contextCache(context);
        const key = String(name) + ':' + Math.round(clamp(warp, 0, 1) * 100);
        if (cache.waves.has(key)) return cache.waves.get(key);
        const size = 64;
        const real = new Float32Array(size);
        const imag = new Float32Array(size);
        const samples = 1024;
        for (let harmonic = 1; harmonic < size; harmonic += 1) {
            let r = 0;
            let im = 0;
            for (let i = 0; i < samples; i += 1) {
                const phase = i / samples;
                const sample = waveSample(name, phase, warp);
                const angle = Math.PI * 2 * harmonic * phase;
                r += sample * Math.cos(angle);
                im += sample * Math.sin(angle);
            }
            real[harmonic] = (r * 2) / samples;
            imag[harmonic] = (im * 2) / samples;
        }
        const wave = context.createPeriodicWave(real, imag, { disableNormalization: false });
        cache.waves.set(key, wave);
        return wave;
    }

    function makeNoiseBuffer(context) {
        const cache = contextCache(context);
        if (cache.noiseBuffer) return cache.noiseBuffer;
        const length = Math.max(1, Math.floor(context.sampleRate * 1.5));
        const buffer = context.createBuffer(1, length, context.sampleRate);
        const data = buffer.getChannelData(0);
        let last = 0;
        for (let i = 0; i < length; i += 1) {
            const white = (Math.random() * 2) - 1;
            last = last * 0.62 + white * 0.38;
            data[i] = white * 0.45 + last * 0.55;
        }
        cache.noiseBuffer = buffer;
        return buffer;
    }

    function makeDriveCurve(context, amount) {
        const cache = contextCache(context);
        const key = String(Math.round(clamp(amount, 0, 1) * 100));
        if (cache.driveCurves.has(key)) return cache.driveCurves.get(key);
        const size = 1024;
        const curve = new Float32Array(size);
        const drive = 1 + clamp(amount, 0, 1) * 18;
        for (let i = 0; i < size; i += 1) {
            const x = (i / (size - 1)) * 2 - 1;
            curve[i] = Math.tanh(x * drive);
        }
        cache.driveCurves.set(key, curve);
        return curve;
    }

    function makeVoicePositions(settings) {
        const count = Math.max(1, Math.min(16, Math.round(Number(settings.unison) || 1)));
        const detune = clamp(settings.detune, 0, 1) * 58;
        const blend = clamp(settings.blend, 0, 1);
        return Array.from({ length: count }, (_, index) => {
            const pos = count === 1 ? 0 : (index / (count - 1)) * 2 - 1;
            const centerWeight = 1 - Math.abs(pos) * (0.18 + blend * 0.38);
            return {
                cents: pos * detune,
                pan: pos * (count > 1 ? 0.58 : 0),
                gain: Math.max(0.05, centerWeight) / Math.sqrt(count)
            };
        });
    }

    function makeSlider(param, api, draw) {
        const wrap = document.createElement('label');
        wrap.className = 'fb-nebula-knob';
        const name = document.createElement('span');
        name.textContent = param.label || param.id;
        const value = document.createElement('strong');

        if (param.type === 'select') {
            const select = document.createElement('select');
            select.className = 'fb-nebula-select';
            (param.options || []).forEach(option => {
                const item = document.createElement('option');
                item.value = option;
                item.textContent = option;
                item.selected = option === api.settings[param.id];
                select.append(item);
            });
            value.textContent = api.settings[param.id];
            select.addEventListener('change', () => {
                value.textContent = select.value;
                api.setParam(param.id, select.value);
                draw();
            });
            wrap.append(name, value, select);
            return wrap;
        }

        const min = Number(param.min ?? 0);
        const max = Number(param.max ?? 1);
        const step = Number(param.step ?? 0.01) || 0.01;
        const input = document.createElement('input');
        input.type = 'range';
        input.min = String(min);
        input.max = String(max);
        input.step = String(step);
        input.value = String(clamp(api.settings[param.id], min, max));
        const snap = value => {
            const next = clamp(value, min, max);
            const stepped = Math.round((next - min) / step) * step + min;
            const places = Math.max(0, (String(step).split('.')[1] || '').length);
            return clamp(Number(stepped.toFixed(places)), min, max);
        };
        const sync = rawValue => {
            const next = snap(rawValue ?? input.value);
            input.value = String(next);
            wrap.style.setProperty('--value', String((next - min) / Math.max(0.0001, max - min)));
            value.textContent = fmt(next, param.unit);
            api.setParam(param.id, next);
            draw();
        };
        sync();
        const valueFromPointer = event => {
            const rect = wrap.getBoundingClientRect();
            const position = 1 - ((event.clientY - rect.top) / Math.max(1, rect.height));
            return min + clamp(position, 0, 1) * (max - min);
        };
        const drag = event => {
            if (!wrap.hasPointerCapture(event.pointerId)) return;
            event.preventDefault();
            sync(valueFromPointer(event));
        };
        wrap.addEventListener('pointerdown', event => {
            if (event.button !== undefined && event.button !== 0) return;
            event.preventDefault();
            input.focus({ preventScroll: true });
            wrap.setPointerCapture(event.pointerId);
            sync(valueFromPointer(event));
        });
        wrap.addEventListener('pointermove', drag);
        ['pointerup', 'pointercancel'].forEach(type => {
            wrap.addEventListener(type, event => {
                if (wrap.hasPointerCapture(event.pointerId)) wrap.releasePointerCapture(event.pointerId);
            });
        });
        input.addEventListener('input', () => sync());
        input.addEventListener('change', () => sync());
        wrap.append(name, value, input);
        return wrap;
    }

    function drawWave(canvas, settings, osc) {
        const rect = canvas.getBoundingClientRect();
        const dpr = Math.max(1, window.devicePixelRatio || 1);
        const width = Math.max(1, Math.round((rect.width || 420) * dpr));
        const height = Math.max(1, Math.round((rect.height || 140) * dpr));
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
        }
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const w = width / dpr;
        const h = height / dpr;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(3, 5, 8, 0.82)';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        for (let x = 0; x < w; x += 24) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }
        for (let y = h / 4; y < h; y += h / 4) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }
        const name = settings[osc === 'a' ? 'oscA' : 'oscB'];
        const warp = settings[osc === 'a' ? 'warpA' : 'warpB'];
        const color = osc === 'a' ? '#56e7d0' : '#ffcf5e';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 14;
        ctx.shadowColor = color;
        ctx.strokeStyle = color;
        ctx.beginPath();
        for (let x = 0; x < w; x += 1) {
            const sample = waveSample(name, x / Math.max(1, w - 1), warp);
            const y = h * 0.5 - sample * h * 0.32;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,0.64)';
        ctx.font = '10px monospace';
        ctx.fillText(name + ' / warp ' + fmt(warp, ''), 10, 18);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    function drawFilter(canvas, settings) {
        const rect = canvas.getBoundingClientRect();
        const dpr = Math.max(1, window.devicePixelRatio || 1);
        const width = Math.max(1, Math.round((rect.width || 360) * dpr));
        const height = Math.max(1, Math.round((rect.height || 120) * dpr));
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
        }
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const w = width / dpr;
        const h = height / dpr;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(6, 8, 12, 0.78)';
        ctx.fillRect(0, 0, w, h);
        const cutoff = clamp(settings.cutoff, 80, 16000);
        const norm = (Math.log10(cutoff) - Math.log10(80)) / (Math.log10(16000) - Math.log10(80));
        const resonance = clamp(settings.resonance, 0.1, 22) / 22;
        ctx.strokeStyle = 'rgba(155, 214, 255, 0.95)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let x = 0; x < w; x += 1) {
            const f = x / Math.max(1, w - 1);
            const slope = 1 / (1 + Math.exp((f - norm) * 26));
            const bump = Math.exp(-Math.pow((f - norm) * 18, 2)) * resonance * 0.38;
            const y = h - (slope + bump) * h * 0.72 - h * 0.12;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.fillStyle = 'rgba(155, 214, 255, 0.68)';
        ctx.font = '10px monospace';
        ctx.fillText(fmt(cutoff, 'hz') + ' / q ' + fmt(settings.resonance, ''), 10, 18);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    const nebulaDefaults = {
        oscA: 'analog',
        warpA: 0.18,
        levelA: 0.82,
        oscB: 'spectral',
        warpB: 0.42,
        levelB: 0.48,
        semiB: 0,
        fineB: 7,
        sub: 0.24,
        noise: 0.04,
        unison: 5,
        detune: 0.18,
        blend: 0.62,
        cutoff: 7200,
        resonance: 3.2,
        drive: 0.14,
        attack: 0.006,
        decay: 0.28,
        sustain: 0.7,
        release: 0.16
    };
    const preset = (name, settings) => ({ name, settings: { ...nebulaDefaults, ...settings } });
    const presets = [
        preset('[BA] Growl Bass', { oscA: 'monster', warpA: 0.74, levelA: 0.82, oscB: 'vowel', warpB: 0.68, levelB: 0.46, semiB: -12, fineB: 0, sub: 0.58, noise: 0.08, unison: 2, detune: 0.08, blend: 0.38, cutoff: 2300, resonance: 9.5, drive: 0.54, attack: 0.003, decay: 0.16, sustain: 0.72, release: 0.09 }),
        preset('[BA] Future Bass Stack', { oscA: 'analog', warpA: 0.22, levelA: 0.78, oscB: 'vowel', warpB: 0.38, levelB: 0.42, semiB: 7, fineB: -4, sub: 0.18, noise: 0.02, unison: 12, detune: 0.3, blend: 0.72, cutoff: 5400, resonance: 4.8, drive: 0.12, attack: 0.04, decay: 0.42, sustain: 0.64, release: 0.62 }),
        preset('[BA] Sub Utility', { oscA: 'analog', warpA: 0, levelA: 0.32, oscB: 'digital', warpB: 0, levelB: 0, semiB: 0, fineB: 0, sub: 0.86, noise: 0, unison: 1, detune: 0, blend: 0.5, cutoff: 2600, resonance: 1.2, drive: 0.08, attack: 0.004, decay: 0.22, sustain: 0.92, release: 0.12 }),
        preset('[BA] Rubber Bite', { oscA: 'analog', warpA: 0.38, levelA: 0.76, oscB: 'monster', warpB: 0.44, levelB: 0.28, semiB: -12, fineB: 3, sub: 0.48, noise: 0.02, unison: 3, detune: 0.1, blend: 0.44, cutoff: 3100, resonance: 7.2, drive: 0.32, attack: 0.004, decay: 0.24, sustain: 0.68, release: 0.13 }),
        preset('[BA] Vowel Lowend', { oscA: 'vowel', warpA: 0.6, levelA: 0.74, oscB: 'analog', warpB: 0.12, levelB: 0.34, semiB: -12, fineB: -7, sub: 0.52, noise: 0.03, unison: 2, detune: 0.07, blend: 0.4, cutoff: 1900, resonance: 10.5, drive: 0.42, attack: 0.003, decay: 0.18, sustain: 0.76, release: 0.1 }),
        preset('[BA] Digital Donk', { oscA: 'digital', warpA: 0.48, levelA: 0.8, oscB: 'spectral', warpB: 0.22, levelB: 0.3, semiB: -5, fineB: 0, sub: 0.42, noise: 0.01, unison: 1, detune: 0, blend: 0.35, cutoff: 4200, resonance: 6.8, drive: 0.24, attack: 0.002, decay: 0.12, sustain: 0.38, release: 0.08 }),
        preset('[BA] Reese Fog', { oscA: 'analog', warpA: 0.2, levelA: 0.7, oscB: 'spectral', warpB: 0.32, levelB: 0.52, semiB: 0, fineB: 11, sub: 0.35, noise: 0.03, unison: 8, detune: 0.24, blend: 0.52, cutoff: 3600, resonance: 3.8, drive: 0.18, attack: 0.01, decay: 0.34, sustain: 0.82, release: 0.28 }),
        preset('[BA] Acid Spine', { oscA: 'digital', warpA: 0.58, levelA: 0.78, oscB: 'monster', warpB: 0.36, levelB: 0.26, semiB: 0, fineB: 0, sub: 0.26, noise: 0.02, unison: 2, detune: 0.04, blend: 0.36, cutoff: 2800, resonance: 13.5, drive: 0.38, attack: 0.002, decay: 0.2, sustain: 0.45, release: 0.09 }),
        preset('[BA] Warm Club', { oscA: 'analog', warpA: 0.14, levelA: 0.84, oscB: 'analog', warpB: 0.08, levelB: 0.3, semiB: -12, fineB: 0, sub: 0.56, noise: 0, unison: 4, detune: 0.09, blend: 0.46, cutoff: 4800, resonance: 3.2, drive: 0.16, attack: 0.006, decay: 0.28, sustain: 0.72, release: 0.16 }),
        preset('[BA] Metallic Bass', { oscA: 'spectral', warpA: 0.66, levelA: 0.72, oscB: 'digital', warpB: 0.62, levelB: 0.44, semiB: -7, fineB: 15, sub: 0.34, noise: 0.04, unison: 3, detune: 0.11, blend: 0.48, cutoff: 2500, resonance: 8.4, drive: 0.46, attack: 0.003, decay: 0.14, sustain: 0.58, release: 0.12 }),

        preset('[FX] Ion Sweep', { oscA: 'spectral', warpA: 0.78, levelA: 0.68, oscB: 'vowel', warpB: 0.74, levelB: 0.4, semiB: 12, fineB: 9, sub: 0, noise: 0.16, unison: 10, detune: 0.42, blend: 0.78, cutoff: 11800, resonance: 12, drive: 0.18, attack: 0.32, decay: 1.2, sustain: 0.42, release: 1.5 }),
        preset('[FX] Broken Comet', { oscA: 'monster', warpA: 0.88, levelA: 0.72, oscB: 'digital', warpB: 0.84, levelB: 0.5, semiB: 19, fineB: -18, sub: 0.02, noise: 0.12, unison: 7, detune: 0.38, blend: 0.66, cutoff: 9800, resonance: 6.5, drive: 0.34, attack: 0.04, decay: 0.62, sustain: 0.2, release: 1.1 }),
        preset('[FX] Vowel Siren', { oscA: 'vowel', warpA: 0.92, levelA: 0.8, oscB: 'vowel', warpB: 0.28, levelB: 0.42, semiB: 7, fineB: 22, sub: 0, noise: 0.05, unison: 5, detune: 0.26, blend: 0.7, cutoff: 7600, resonance: 15, drive: 0.22, attack: 0.22, decay: 0.8, sustain: 0.36, release: 1.4 }),
        preset('[FX] Data Spray', { oscA: 'digital', warpA: 0.96, levelA: 0.7, oscB: 'spectral', warpB: 0.9, levelB: 0.38, semiB: 24, fineB: -11, sub: 0, noise: 0.18, unison: 4, detune: 0.34, blend: 0.62, cutoff: 13200, resonance: 5.4, drive: 0.28, attack: 0.002, decay: 0.18, sustain: 0.12, release: 0.44 }),
        preset('[FX] Ghost Radio', { oscA: 'vowel', warpA: 0.48, levelA: 0.52, oscB: 'spectral', warpB: 0.72, levelB: 0.46, semiB: 5, fineB: 35, sub: 0, noise: 0.28, unison: 6, detune: 0.3, blend: 0.82, cutoff: 4800, resonance: 11.5, drive: 0.12, attack: 0.16, decay: 0.9, sustain: 0.3, release: 1.8 }),
        preset('[FX] Star Tick', { oscA: 'digital', warpA: 0.44, levelA: 0.72, oscB: 'analog', warpB: 0.2, levelB: 0.2, semiB: 12, fineB: 0, sub: 0, noise: 0.04, unison: 2, detune: 0.06, blend: 0.42, cutoff: 15000, resonance: 4.2, drive: 0.1, attack: 0.001, decay: 0.06, sustain: 0.04, release: 0.18 }),
        preset('[FX] Plasma Door', { oscA: 'monster', warpA: 0.62, levelA: 0.66, oscB: 'spectral', warpB: 0.64, levelB: 0.48, semiB: -12, fineB: 0, sub: 0.08, noise: 0.22, unison: 9, detune: 0.28, blend: 0.74, cutoff: 6200, resonance: 9, drive: 0.4, attack: 0.08, decay: 0.7, sustain: 0.25, release: 1.2 }),
        preset('[FX] Bit Lantern', { oscA: 'digital', warpA: 0.72, levelA: 0.58, oscB: 'digital', warpB: 0.26, levelB: 0.36, semiB: 17, fineB: -25, sub: 0, noise: 0.06, unison: 3, detune: 0.16, blend: 0.58, cutoff: 8600, resonance: 7.5, drive: 0.2, attack: 0.018, decay: 0.32, sustain: 0.08, release: 0.72 }),
        preset('[FX] Lunar Knock', { oscA: 'analog', warpA: 0.34, levelA: 0.68, oscB: 'monster', warpB: 0.56, levelB: 0.36, semiB: -24, fineB: 0, sub: 0.18, noise: 0.2, unison: 1, detune: 0, blend: 0.5, cutoff: 2100, resonance: 16, drive: 0.5, attack: 0.002, decay: 0.38, sustain: 0, release: 0.3 }),
        preset('[FX] Aurora Rise', { oscA: 'spectral', warpA: 0.5, levelA: 0.62, oscB: 'vowel', warpB: 0.52, levelB: 0.42, semiB: 12, fineB: 7, sub: 0.02, noise: 0.11, unison: 12, detune: 0.36, blend: 0.84, cutoff: 7000, resonance: 5.8, drive: 0.08, attack: 0.6, decay: 1.8, sustain: 0.58, release: 2.6 }),

        preset('[LD] Hyper Lead', { oscA: 'digital', warpA: 0.34, levelA: 0.86, oscB: 'spectral', warpB: 0.58, levelB: 0.52, semiB: 0, fineB: 9, sub: 0.08, noise: 0.03, unison: 9, detune: 0.22, blend: 0.68, cutoff: 9800, resonance: 2.4, drive: 0.18, attack: 0.004, decay: 0.18, sustain: 0.8, release: 0.18 }),
        preset('[LD] Prism Lead', { oscA: 'spectral', warpA: 0.28, levelA: 0.78, oscB: 'digital', warpB: 0.38, levelB: 0.44, semiB: 12, fineB: -4, sub: 0.04, noise: 0.01, unison: 7, detune: 0.18, blend: 0.64, cutoff: 11200, resonance: 3.2, drive: 0.12, attack: 0.006, decay: 0.24, sustain: 0.74, release: 0.26 }),
        preset('[LD] Vocal Blade', { oscA: 'vowel', warpA: 0.46, levelA: 0.82, oscB: 'analog', warpB: 0.18, levelB: 0.38, semiB: 7, fineB: 6, sub: 0.02, noise: 0.02, unison: 6, detune: 0.16, blend: 0.58, cutoff: 8600, resonance: 5.2, drive: 0.16, attack: 0.004, decay: 0.22, sustain: 0.7, release: 0.24 }),
        preset('[LD] Monster Solo', { oscA: 'monster', warpA: 0.52, levelA: 0.72, oscB: 'spectral', warpB: 0.3, levelB: 0.36, semiB: 0, fineB: 12, sub: 0.06, noise: 0.04, unison: 5, detune: 0.14, blend: 0.5, cutoff: 7200, resonance: 6.4, drive: 0.3, attack: 0.003, decay: 0.18, sustain: 0.68, release: 0.22 }),
        preset('[LD] Glass Runner', { oscA: 'digital', warpA: 0.2, levelA: 0.74, oscB: 'spectral', warpB: 0.2, levelB: 0.48, semiB: 12, fineB: 0, sub: 0, noise: 0.02, unison: 4, detune: 0.1, blend: 0.68, cutoff: 12600, resonance: 4.2, drive: 0.06, attack: 0.002, decay: 0.16, sustain: 0.78, release: 0.3 }),
        preset('[LD] Acid Lead', { oscA: 'analog', warpA: 0.32, levelA: 0.8, oscB: 'digital', warpB: 0.42, levelB: 0.32, semiB: 0, fineB: 5, sub: 0.04, noise: 0.01, unison: 3, detune: 0.08, blend: 0.44, cutoff: 5600, resonance: 14, drive: 0.24, attack: 0.002, decay: 0.2, sustain: 0.54, release: 0.14 }),
        preset('[LD] Arena Saw', { oscA: 'analog', warpA: 0.18, levelA: 0.74, oscB: 'spectral', warpB: 0.36, levelB: 0.44, semiB: 0, fineB: -7, sub: 0.03, noise: 0.02, unison: 14, detune: 0.3, blend: 0.72, cutoff: 10400, resonance: 2.6, drive: 0.12, attack: 0.006, decay: 0.28, sustain: 0.76, release: 0.32 }),
        preset('[LD] Thin Laser', { oscA: 'digital', warpA: 0.64, levelA: 0.64, oscB: 'digital', warpB: 0.18, levelB: 0.18, semiB: 19, fineB: 0, sub: 0, noise: 0.01, unison: 2, detune: 0.04, blend: 0.4, cutoff: 15000, resonance: 3.8, drive: 0.08, attack: 0.001, decay: 0.12, sustain: 0.6, release: 0.16 }),
        preset('[LD] Soft Anthem', { oscA: 'spectral', warpA: 0.24, levelA: 0.72, oscB: 'analog', warpB: 0.16, levelB: 0.4, semiB: 7, fineB: -5, sub: 0.05, noise: 0.01, unison: 9, detune: 0.2, blend: 0.64, cutoff: 9000, resonance: 3.4, drive: 0.08, attack: 0.02, decay: 0.34, sustain: 0.72, release: 0.48 }),
        preset('[LD] Digital Horn', { oscA: 'vowel', warpA: 0.36, levelA: 0.76, oscB: 'digital', warpB: 0.46, levelB: 0.4, semiB: 0, fineB: 10, sub: 0.02, noise: 0.02, unison: 5, detune: 0.12, blend: 0.6, cutoff: 7800, resonance: 5.8, drive: 0.2, attack: 0.01, decay: 0.24, sustain: 0.68, release: 0.28 }),

        preset('[PD] Wide Pad', { oscA: 'spectral', warpA: 0.32, levelA: 0.7, oscB: 'vowel', warpB: 0.3, levelB: 0.38, semiB: 0, fineB: 5, sub: 0.06, noise: 0.05, unison: 10, detune: 0.2, blend: 0.75, cutoff: 4200, resonance: 3.5, drive: 0.04, attack: 0.38, decay: 1.4, sustain: 0.76, release: 1.8 }),
        preset('[PD] Cosmic Choir', { oscA: 'vowel', warpA: 0.28, levelA: 0.62, oscB: 'spectral', warpB: 0.38, levelB: 0.46, semiB: 0, fineB: -8, sub: 0.03, noise: 0.06, unison: 12, detune: 0.24, blend: 0.8, cutoff: 5200, resonance: 4.4, drive: 0.06, attack: 0.52, decay: 1.7, sustain: 0.72, release: 2.4 }),
        preset('[PD] Analog Dawn', { oscA: 'analog', warpA: 0.12, levelA: 0.72, oscB: 'analog', warpB: 0.2, levelB: 0.42, semiB: 0, fineB: 6, sub: 0.08, noise: 0.03, unison: 8, detune: 0.18, blend: 0.66, cutoff: 3600, resonance: 2.6, drive: 0.04, attack: 0.44, decay: 1.2, sustain: 0.82, release: 2.1 }),
        preset('[PD] Frozen Glass', { oscA: 'spectral', warpA: 0.18, levelA: 0.58, oscB: 'digital', warpB: 0.24, levelB: 0.34, semiB: 12, fineB: 0, sub: 0, noise: 0.02, unison: 9, detune: 0.16, blend: 0.78, cutoff: 7600, resonance: 5.5, drive: 0.02, attack: 0.62, decay: 1.8, sustain: 0.62, release: 2.8 }),
        preset('[PD] Dark Matter', { oscA: 'monster', warpA: 0.38, levelA: 0.58, oscB: 'vowel', warpB: 0.44, levelB: 0.34, semiB: -12, fineB: 4, sub: 0.12, noise: 0.08, unison: 7, detune: 0.2, blend: 0.72, cutoff: 2400, resonance: 6.2, drive: 0.18, attack: 0.58, decay: 1.4, sustain: 0.78, release: 2.2 }),
        preset('[PD] Soft Orbit', { oscA: 'analog', warpA: 0.2, levelA: 0.56, oscB: 'spectral', warpB: 0.26, levelB: 0.38, semiB: 7, fineB: -3, sub: 0.04, noise: 0.04, unison: 11, detune: 0.22, blend: 0.82, cutoff: 6100, resonance: 3.2, drive: 0.03, attack: 0.48, decay: 1.5, sustain: 0.74, release: 2.0 }),
        preset('[PD] Warm Strings', { oscA: 'analog', warpA: 0.08, levelA: 0.64, oscB: 'vowel', warpB: 0.22, levelB: 0.3, semiB: 0, fineB: 8, sub: 0.05, noise: 0.04, unison: 10, detune: 0.18, blend: 0.7, cutoff: 4600, resonance: 2.8, drive: 0.05, attack: 0.32, decay: 1.0, sustain: 0.8, release: 1.9 }),
        preset('[PD] Mist Engine', { oscA: 'spectral', warpA: 0.44, levelA: 0.54, oscB: 'monster', warpB: 0.24, levelB: 0.24, semiB: -5, fineB: 11, sub: 0.04, noise: 0.12, unison: 8, detune: 0.26, blend: 0.76, cutoff: 3900, resonance: 4.8, drive: 0.1, attack: 0.7, decay: 1.9, sustain: 0.7, release: 2.5 }),
        preset('[PD] Violet Air', { oscA: 'vowel', warpA: 0.18, levelA: 0.48, oscB: 'spectral', warpB: 0.18, levelB: 0.48, semiB: 12, fineB: -12, sub: 0, noise: 0.03, unison: 14, detune: 0.2, blend: 0.86, cutoff: 6900, resonance: 3.6, drive: 0.02, attack: 0.56, decay: 1.6, sustain: 0.68, release: 2.7 }),
        preset('[PD] Ocean Floor', { oscA: 'analog', warpA: 0.16, levelA: 0.5, oscB: 'monster', warpB: 0.18, levelB: 0.28, semiB: -12, fineB: 0, sub: 0.2, noise: 0.07, unison: 6, detune: 0.18, blend: 0.7, cutoff: 2100, resonance: 3.8, drive: 0.12, attack: 0.64, decay: 1.7, sustain: 0.84, release: 2.6 }),

        preset('[PL] Clean Pluck', { oscA: 'analog', warpA: 0.08, levelA: 0.9, oscB: 'digital', warpB: 0.2, levelB: 0.18, semiB: 12, fineB: 0, sub: 0.1, noise: 0.02, unison: 3, detune: 0.08, blend: 0.45, cutoff: 6800, resonance: 5.6, drive: 0.06, attack: 0.002, decay: 0.18, sustain: 0.18, release: 0.14 }),
        preset('[PL] Prism Pick', { oscA: 'spectral', warpA: 0.22, levelA: 0.76, oscB: 'digital', warpB: 0.14, levelB: 0.28, semiB: 12, fineB: 4, sub: 0.02, noise: 0.01, unison: 4, detune: 0.08, blend: 0.55, cutoff: 9800, resonance: 5.2, drive: 0.04, attack: 0.002, decay: 0.2, sustain: 0.12, release: 0.18 }),
        preset('[PL] Vowel Pluck', { oscA: 'vowel', warpA: 0.32, levelA: 0.78, oscB: 'analog', warpB: 0.1, levelB: 0.24, semiB: 7, fineB: 0, sub: 0.04, noise: 0.01, unison: 2, detune: 0.05, blend: 0.48, cutoff: 6200, resonance: 8.2, drive: 0.08, attack: 0.002, decay: 0.16, sustain: 0.1, release: 0.12 }),
        preset('[PL] Glass Mallet', { oscA: 'digital', warpA: 0.16, levelA: 0.66, oscB: 'spectral', warpB: 0.2, levelB: 0.34, semiB: 19, fineB: -3, sub: 0, noise: 0.01, unison: 3, detune: 0.06, blend: 0.6, cutoff: 12400, resonance: 4.6, drive: 0.02, attack: 0.001, decay: 0.24, sustain: 0.08, release: 0.26 }),
        preset('[PL] Rubber Pluck', { oscA: 'analog', warpA: 0.24, levelA: 0.78, oscB: 'monster', warpB: 0.24, levelB: 0.2, semiB: -12, fineB: 0, sub: 0.18, noise: 0.01, unison: 2, detune: 0.04, blend: 0.36, cutoff: 4200, resonance: 9.4, drive: 0.16, attack: 0.002, decay: 0.14, sustain: 0.18, release: 0.12 }),
        preset('[PL] Digital Harp', { oscA: 'digital', warpA: 0.12, levelA: 0.68, oscB: 'analog', warpB: 0.08, levelB: 0.24, semiB: 12, fineB: 7, sub: 0.02, noise: 0, unison: 5, detune: 0.1, blend: 0.58, cutoff: 11200, resonance: 3.4, drive: 0.03, attack: 0.004, decay: 0.26, sustain: 0.14, release: 0.34 }),
        preset('[PL] Monster Snap', { oscA: 'monster', warpA: 0.42, levelA: 0.76, oscB: 'digital', warpB: 0.36, levelB: 0.22, semiB: 0, fineB: 0, sub: 0.08, noise: 0.03, unison: 2, detune: 0.06, blend: 0.4, cutoff: 5200, resonance: 10, drive: 0.26, attack: 0.001, decay: 0.11, sustain: 0.08, release: 0.09 }),
        preset('[PL] Soft Marimba', { oscA: 'analog', warpA: 0.1, levelA: 0.72, oscB: 'spectral', warpB: 0.1, levelB: 0.26, semiB: 12, fineB: -6, sub: 0.04, noise: 0.01, unison: 1, detune: 0, blend: 0.52, cutoff: 7600, resonance: 4.8, drive: 0.04, attack: 0.003, decay: 0.22, sustain: 0.06, release: 0.22 }),
        preset('[PL] Neon Pick', { oscA: 'spectral', warpA: 0.38, levelA: 0.72, oscB: 'vowel', warpB: 0.18, levelB: 0.22, semiB: 7, fineB: 5, sub: 0.02, noise: 0.02, unison: 4, detune: 0.12, blend: 0.58, cutoff: 9200, resonance: 7.5, drive: 0.06, attack: 0.002, decay: 0.18, sustain: 0.12, release: 0.18 }),
        preset('[PL] Dusty Bell', { oscA: 'vowel', warpA: 0.12, levelA: 0.58, oscB: 'spectral', warpB: 0.16, levelB: 0.3, semiB: 12, fineB: 14, sub: 0, noise: 0.04, unison: 3, detune: 0.08, blend: 0.68, cutoff: 8400, resonance: 5.8, drive: 0.02, attack: 0.006, decay: 0.3, sustain: 0.1, release: 0.42 }),

        preset('[SY] Mellow Keys', { oscA: 'analog', warpA: 0.12, levelA: 0.72, oscB: 'spectral', warpB: 0.2, levelB: 0.28, semiB: 12, fineB: 0, sub: 0.04, noise: 0.01, unison: 3, detune: 0.06, blend: 0.56, cutoff: 7400, resonance: 3.4, drive: 0.06, attack: 0.018, decay: 0.34, sustain: 0.58, release: 0.42 }),
        preset('[SY] Digital Keys', { oscA: 'digital', warpA: 0.18, levelA: 0.7, oscB: 'analog', warpB: 0.08, levelB: 0.3, semiB: 12, fineB: 2, sub: 0.02, noise: 0, unison: 2, detune: 0.04, blend: 0.5, cutoff: 9600, resonance: 2.8, drive: 0.04, attack: 0.006, decay: 0.28, sustain: 0.52, release: 0.36 }),
        preset('[SY] Warm Poly', { oscA: 'analog', warpA: 0.18, levelA: 0.74, oscB: 'analog', warpB: 0.14, levelB: 0.34, semiB: 0, fineB: 8, sub: 0.06, noise: 0.01, unison: 5, detune: 0.12, blend: 0.62, cutoff: 6200, resonance: 2.5, drive: 0.08, attack: 0.024, decay: 0.42, sustain: 0.7, release: 0.58 }),
        preset('[SY] Spectral Organ', { oscA: 'spectral', warpA: 0.12, levelA: 0.68, oscB: 'vowel', warpB: 0.08, levelB: 0.3, semiB: 0, fineB: -5, sub: 0.02, noise: 0, unison: 4, detune: 0.04, blend: 0.7, cutoff: 8800, resonance: 2.2, drive: 0.03, attack: 0.04, decay: 0.3, sustain: 0.82, release: 0.5 }),
        preset('[SY] Bright Comp', { oscA: 'digital', warpA: 0.26, levelA: 0.76, oscB: 'spectral', warpB: 0.28, levelB: 0.36, semiB: 0, fineB: 0, sub: 0.03, noise: 0.01, unison: 4, detune: 0.1, blend: 0.58, cutoff: 12000, resonance: 3.6, drive: 0.1, attack: 0.004, decay: 0.22, sustain: 0.62, release: 0.22 }),
        preset('[SY] Soft Bells', { oscA: 'spectral', warpA: 0.2, levelA: 0.58, oscB: 'digital', warpB: 0.14, levelB: 0.3, semiB: 12, fineB: 9, sub: 0, noise: 0.01, unison: 2, detune: 0.03, blend: 0.72, cutoff: 10500, resonance: 4, drive: 0.02, attack: 0.012, decay: 0.6, sustain: 0.24, release: 0.9 }),
        preset('[SY] Hybrid Piano', { oscA: 'analog', warpA: 0.08, levelA: 0.76, oscB: 'digital', warpB: 0.08, levelB: 0.22, semiB: 12, fineB: -2, sub: 0.04, noise: 0.01, unison: 1, detune: 0, blend: 0.5, cutoff: 8200, resonance: 2.8, drive: 0.04, attack: 0.003, decay: 0.48, sustain: 0.34, release: 0.5 }),
        preset('[SY] Velvet Poly', { oscA: 'vowel', warpA: 0.16, levelA: 0.58, oscB: 'analog', warpB: 0.14, levelB: 0.38, semiB: 0, fineB: 4, sub: 0.05, noise: 0.01, unison: 6, detune: 0.12, blend: 0.68, cutoff: 5400, resonance: 3.1, drive: 0.04, attack: 0.06, decay: 0.5, sustain: 0.66, release: 0.78 }),
        preset('[SY] Shimmer Keys', { oscA: 'spectral', warpA: 0.28, levelA: 0.62, oscB: 'spectral', warpB: 0.18, levelB: 0.36, semiB: 12, fineB: 12, sub: 0, noise: 0.02, unison: 5, detune: 0.14, blend: 0.76, cutoff: 13200, resonance: 3.3, drive: 0.03, attack: 0.018, decay: 0.5, sustain: 0.5, release: 0.74 }),
        preset('[SY] Classic Stack', { oscA: 'analog', warpA: 0.2, levelA: 0.78, oscB: 'spectral', warpB: 0.22, levelB: 0.42, semiB: 0, fineB: -8, sub: 0.08, noise: 0.01, unison: 7, detune: 0.16, blend: 0.64, cutoff: 7800, resonance: 2.9, drive: 0.09, attack: 0.016, decay: 0.4, sustain: 0.7, release: 0.62 })
    ];

    window.fridgeBeatsSynths.register({
        id: 'nebula-table',
        name: 'Nebula Table',
        params: [
            { id: 'oscA', label: 'osc a', type: 'select', options: waveNames, default: 'analog' },
            { id: 'warpA', label: 'warp a', type: 'range', min: 0, max: 1, step: 0.01, default: 0.18 },
            { id: 'levelA', label: 'level a', type: 'range', min: 0, max: 1, step: 0.01, default: 0.82 },
            { id: 'oscB', label: 'osc b', type: 'select', options: waveNames, default: 'spectral' },
            { id: 'warpB', label: 'warp b', type: 'range', min: 0, max: 1, step: 0.01, default: 0.42 },
            { id: 'levelB', label: 'level b', type: 'range', min: 0, max: 1, step: 0.01, default: 0.48 },
            { id: 'semiB', label: 'semi b', type: 'range', min: -24, max: 24, step: 1, default: 0 },
            { id: 'fineB', label: 'fine b', type: 'range', min: -50, max: 50, step: 1, default: 7 },
            { id: 'sub', label: 'sub', type: 'range', min: 0, max: 1, step: 0.01, default: 0.24 },
            { id: 'noise', label: 'noise', type: 'range', min: 0, max: 1, step: 0.01, default: 0.04 },
            { id: 'unison', label: 'unison', type: 'range', min: 1, max: 16, step: 1, default: 5 },
            { id: 'detune', label: 'detune', type: 'range', min: 0, max: 1, step: 0.01, default: 0.18 },
            { id: 'blend', label: 'blend', type: 'range', min: 0, max: 1, step: 0.01, default: 0.62 },
            { id: 'cutoff', label: 'cutoff', type: 'range', min: 80, max: 16000, step: 1, default: 7200, unit: 'hz' },
            { id: 'resonance', label: 'reso', type: 'range', min: 0.1, max: 22, step: 0.1, default: 3.2 },
            { id: 'drive', label: 'drive', type: 'range', min: 0, max: 1, step: 0.01, default: 0.14 },
            { id: 'attack', label: 'attack', type: 'range', min: 0.001, max: 1.2, step: 0.001, default: 0.006, unit: 's' },
            { id: 'decay', label: 'decay', type: 'range', min: 0.01, max: 2.5, step: 0.01, default: 0.28, unit: 's' },
            { id: 'sustain', label: 'sustain', type: 'range', min: 0, max: 1, step: 0.01, default: 0.7 },
            { id: 'release', label: 'release', type: 'range', min: 0.02, max: 3, step: 0.01, default: 0.16, unit: 's' }
        ],
        presets,
        css: `
.fb-nebula-panel {
    height: 100%;
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    gap: 10px;
    padding: 12px;
    box-sizing: border-box;
    border: 1px solid rgba(86, 231, 208, 0.34);
    border-radius: 6px;
    background:
        linear-gradient(180deg, rgba(18, 22, 32, 0.96), rgba(4, 5, 8, 0.98)),
        #05070a;
    color: #e9fffb;
    overflow: hidden;
}
.fb-nebula-top {
    min-height: 0;
    display: grid;
    grid-template-columns: 1fr 1fr 0.82fr;
    gap: 10px;
}
.fb-nebula-module {
    min-width: 0;
    min-height: 0;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    gap: 8px;
    padding: 9px;
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 5px;
    background: rgba(255,255,255,0.045);
}
.fb-nebula-title {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-family: "MainBold", monospace;
    font-size: 11px;
    text-transform: uppercase;
    color: rgba(233,255,251,0.88);
}
.fb-nebula-title span:last-child {
    color: rgba(255,207,94,0.8);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.fb-nebula-screen {
    position: relative;
    min-height: 96px;
    border: 1px solid rgba(86,231,208,0.24);
    border-radius: 4px;
    overflow: hidden;
    background: #030508;
}
.fb-nebula-screen canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
}
.fb-nebula-strip {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
}
.fb-nebula-filter {
    min-height: 0;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    gap: 8px;
}
.fb-nebula-filter .fb-nebula-screen {
    min-height: 90px;
}
.fb-nebula-controls {
    display: grid;
    grid-template-columns: repeat(10, minmax(58px, 1fr));
    gap: 7px;
}
.fb-nebula-knob {
    --value: 0.5;
    position: relative;
    min-width: 0;
    display: grid;
    grid-template-rows: auto auto minmax(28px, 1fr);
    gap: 4px;
    padding: 7px;
    border: 1px solid rgba(255,255,255,0.11);
    border-radius: 5px;
    background:
        linear-gradient(0deg, rgba(86,231,208,0.22) calc(var(--value) * 100%), transparent 0),
        rgba(0,0,0,0.36);
    touch-action: none;
    user-select: none;
    cursor: ns-resize;
}
.fb-nebula-knob span,
.fb-nebula-knob strong {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 9px;
    line-height: 1.1;
}
.fb-nebula-knob span {
    color: rgba(233,255,251,0.66);
    text-transform: uppercase;
}
.fb-nebula-knob strong {
    color: #ffcf5e;
    font-weight: normal;
}
.fb-nebula-knob input[type="range"] {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: ns-resize;
    pointer-events: none;
}
.fb-nebula-select {
    width: 100%;
    min-width: 0;
    border: 1px solid rgba(86,231,208,0.28);
    background: rgba(0,0,0,0.62);
    color: #e9fffb;
    font-size: 10px;
}
@media (max-width: 860px) {
    .fb-nebula-top { grid-template-columns: 1fr; }
    .fb-nebula-controls { grid-template-columns: repeat(4, minmax(58px, 1fr)); }
}
`,
        createVoice(context, api) {
            const settings = api.settings;
            const duration = Math.max(0.04, api.duration || 3600);
            const attack = clamp(settings.attack, 0.001, 1.2);
            const decay = clamp(settings.decay, 0.01, 2.5);
            const sustain = clamp(settings.sustain, 0, 1);
            const release = clamp(settings.release, 0.02, 3);
            const end = api.time + duration;
            const releaseEnd = end + release;
            const noteEnd = api.duration ? releaseEnd : api.time + 3600;
            const output = context.createGain();
            const filter = context.createBiquadFilter();
            const drive = context.createWaveShaper();
            const amp = context.createGain();
            const nodes = [output, filter, drive, amp];
            const waveA = makePeriodicWave(context, settings.oscA, settings.warpA);
            const waveB = makePeriodicWave(context, settings.oscB, settings.warpB);
            const voices = makeVoicePositions(settings);
            const levelA = clamp(settings.levelA, 0, 1);
            const levelB = clamp(settings.levelB, 0, 1);
            const semitoneB = Number(settings.semiB) || 0;
            const fineB = Number(settings.fineB) || 0;
            const target = api.targetFrequency ? Math.max(1, api.targetFrequency) : null;

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(clamp(settings.cutoff, 80, 16000), api.time);
            filter.Q.setValueAtTime(clamp(settings.resonance, 0.1, 22), api.time);
            drive.curve = makeDriveCurve(context, settings.drive);
            drive.oversample = '2x';
            amp.gain.setValueAtTime(0.0001, api.time);
            amp.gain.exponentialRampToValueAtTime(Math.max(0.001, api.channel.volume * api.velocity), api.time + attack);
            amp.gain.exponentialRampToValueAtTime(Math.max(0.0001, api.channel.volume * api.velocity * sustain), api.time + attack + decay);
            if (api.duration) {
                amp.gain.setValueAtTime(Math.max(0.0001, api.channel.volume * api.velocity * sustain), Math.max(api.time + attack + decay, end));
                amp.gain.exponentialRampToValueAtTime(0.0001, releaseEnd);
            }

            voices.forEach(voice => {
                const pan = context.createStereoPanner();
                const oscAGain = context.createGain();
                const oscBGain = context.createGain();
                const oscA = context.createOscillator();
                const oscB = context.createOscillator();
                oscA.setPeriodicWave(waveA);
                oscB.setPeriodicWave(waveB);
                oscA.frequency.setValueAtTime(Math.max(1, api.frequency), api.time);
                oscB.frequency.setValueAtTime(Math.max(1, api.frequency * Math.pow(2, semitoneB / 12)), api.time);
                if (target) {
                    oscA.frequency.exponentialRampToValueAtTime(target, Math.max(api.time + 0.01, end));
                    oscB.frequency.exponentialRampToValueAtTime(target * Math.pow(2, semitoneB / 12), Math.max(api.time + 0.01, end));
                }
                oscA.detune.setValueAtTime(voice.cents, api.time);
                oscB.detune.setValueAtTime(voice.cents + fineB, api.time);
                oscAGain.gain.value = levelA * voice.gain * 0.54;
                oscBGain.gain.value = levelB * voice.gain * 0.54;
                pan.pan.value = clamp(api.channel.pan + voice.pan, -1, 1);
                oscA.connect(oscAGain);
                oscB.connect(oscBGain);
                oscAGain.connect(pan);
                oscBGain.connect(pan);
                pan.connect(output);
                oscA.start(api.time);
                oscB.start(api.time);
                if (api.duration) {
                    oscA.stop(noteEnd + 0.04);
                    oscB.stop(noteEnd + 0.04);
                }
                nodes.push(pan, oscAGain, oscBGain, oscA, oscB);
            });

            if (settings.sub > 0) {
                const sub = context.createOscillator();
                const subGain = context.createGain();
                const subPan = context.createStereoPanner();
                sub.type = 'sine';
                sub.frequency.setValueAtTime(Math.max(1, api.frequency / 2), api.time);
                if (target) sub.frequency.exponentialRampToValueAtTime(target / 2, Math.max(api.time + 0.01, end));
                subGain.gain.value = clamp(settings.sub, 0, 1) * 0.46;
                subPan.pan.value = clamp(api.channel.pan, -1, 1);
                sub.connect(subGain);
                subGain.connect(subPan);
                subPan.connect(output);
                sub.start(api.time);
                if (api.duration) sub.stop(noteEnd + 0.04);
                nodes.push(sub, subGain, subPan);
            }

            if (settings.noise > 0) {
                const noise = context.createBufferSource();
                const noiseGain = context.createGain();
                const noisePan = context.createStereoPanner();
                noise.buffer = makeNoiseBuffer(context);
                noise.loop = true;
                noiseGain.gain.value = clamp(settings.noise, 0, 1) * 0.22;
                noisePan.pan.value = clamp(api.channel.pan, -1, 1);
                noise.connect(noiseGain);
                noiseGain.connect(noisePan);
                noisePan.connect(output);
                noise.start(api.time);
                noise.stop(noteEnd + 0.04);
                nodes.push(noise, noiseGain, noisePan);
            }

            output.connect(filter);
            filter.connect(drive);
            drive.connect(amp);
            amp.connect(api.output);

            return {
                nodes,
                stop() {
                    const now = context.currentTime;
                    amp.gain.cancelScheduledValues(now);
                    amp.gain.setValueAtTime(Math.max(0.0001, amp.gain.value), now);
                    amp.gain.exponentialRampToValueAtTime(0.0001, now + release);
                    nodes.forEach(node => {
                        if (typeof node.stop === 'function') {
                            try {
                                node.stop(now + release + 0.05);
                            } catch (_) {}
                        }
                    });
                }
            };
        },
        renderGui(api) {
            const root = document.createElement('div');
            root.className = 'fb-nebula-panel';

            const top = document.createElement('div');
            top.className = 'fb-nebula-top';
            const oscA = document.createElement('section');
            const oscB = document.createElement('section');
            const filter = document.createElement('section');
            oscA.className = 'fb-nebula-module';
            oscB.className = 'fb-nebula-module';
            filter.className = 'fb-nebula-module fb-nebula-filter';
            oscA.innerHTML = '<div class="fb-nebula-title"><span>oscillator a</span><span>main wavetable</span></div>';
            oscB.innerHTML = '<div class="fb-nebula-title"><span>oscillator b</span><span>warp layer</span></div>';
            filter.innerHTML = '<div class="fb-nebula-title"><span>filter</span><span>drive stage</span></div>';

            const screenA = document.createElement('div');
            const screenB = document.createElement('div');
            const screenF = document.createElement('div');
            screenA.className = 'fb-nebula-screen';
            screenB.className = 'fb-nebula-screen';
            screenF.className = 'fb-nebula-screen';
            const canvasA = document.createElement('canvas');
            const canvasB = document.createElement('canvas');
            const canvasF = document.createElement('canvas');
            screenA.append(canvasA);
            screenB.append(canvasB);
            screenF.append(canvasF);

            const params = new Map(api.params.map(param => [param.id, param]));
            const redraw = () => window.requestAnimationFrame(() => {
                drawWave(canvasA, api.settings, 'a');
                drawWave(canvasB, api.settings, 'b');
                drawFilter(canvasF, api.settings);
            });

            const stripA = document.createElement('div');
            const stripB = document.createElement('div');
            stripA.className = 'fb-nebula-strip';
            stripB.className = 'fb-nebula-strip';
            ['oscA', 'warpA', 'levelA'].forEach(id => stripA.append(makeSlider(params.get(id), api, redraw)));
            ['oscB', 'warpB', 'levelB'].forEach(id => stripB.append(makeSlider(params.get(id), api, redraw)));
            oscA.append(screenA, stripA);
            oscB.append(screenB, stripB);

            const filterControls = document.createElement('div');
            filterControls.className = 'fb-nebula-strip';
            ['cutoff', 'resonance', 'drive'].forEach(id => filterControls.append(makeSlider(params.get(id), api, redraw)));
            filter.append(screenF, filterControls);
            top.append(oscA, oscB, filter);

            const controls = document.createElement('div');
            controls.className = 'fb-nebula-controls';
            ['semiB', 'fineB', 'sub', 'noise', 'unison', 'detune', 'blend', 'attack', 'decay', 'sustain', 'release'].forEach(id => {
                controls.append(makeSlider(params.get(id), api, redraw));
            });
            root.append(top, controls);
            redraw();
            if (window.ResizeObserver) {
                const observer = new ResizeObserver(redraw);
                observer.observe(root);
            }
            return root;
        }
    });
})();
