(function () {
    const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
    const minFreq = 35;
    const maxFreq = 18000;
    const minGain = -18;
    const maxGain = 18;
    const bands = [
        { id: 'low', label: 'L', type: 'lowshelf', q: 0.7, color: '#86d3cf' },
        { id: 'one', label: '1', type: 'peaking', q: 1.05, color: '#76beff' },
        { id: 'two', label: '2', type: 'peaking', q: 1.1, color: '#ca92ff' },
        { id: 'three', label: '3', type: 'peaking', q: 1.15, color: '#ffe25e' },
        { id: 'four', label: '4', type: 'peaking', q: 1.1, color: '#ffbb55' },
        { id: 'five', label: '5', type: 'peaking', q: 1.05, color: '#ff7b88' },
        { id: 'high', label: 'H', type: 'highshelf', q: 0.7, color: '#aeea88' }
    ];

    const freqParam = id => id + 'Freq';
    const gainParam = id => id + 'Gain';
    const freqToX = (freq, width) => {
        const min = Math.log10(minFreq);
        const max = Math.log10(maxFreq);
        return ((Math.log10(clamp(freq, minFreq, maxFreq)) - min) / (max - min)) * width;
    };
    const xToFreq = (x, width) => {
        const min = Math.log10(minFreq);
        const max = Math.log10(maxFreq);
        return Math.pow(10, min + (clamp(x / Math.max(1, width), 0, 1) * (max - min)));
    };
    const gainToY = (gain, height) => ((maxGain - clamp(gain, minGain, maxGain)) / (maxGain - minGain)) * height;
    const yToGain = (y, height) => maxGain - (clamp(y / Math.max(1, height), 0, 1) * (maxGain - minGain));
    const displayFreq = freq => freq >= 1000 ? (freq / 1000).toFixed(freq >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k' : Math.round(freq);
    const freqToSlider = freq => {
        const min = Math.log10(minFreq);
        const max = Math.log10(maxFreq);
        return ((Math.log10(clamp(freq, minFreq, maxFreq)) - min) / (max - min)) * 1000;
    };
    const sliderToFreq = value => {
        const min = Math.log10(minFreq);
        const max = Math.log10(maxFreq);
        return Math.round(Math.pow(10, min + (clamp(value / 1000, 0, 1) * (max - min))));
    };

    function makePath(settings, width, height) {
        const points = [];
        for (let i = 0; i <= 96; i += 1) {
            const x = (i / 96) * width;
            const freq = xToFreq(x, width);
            let gain = 0;
            bands.forEach(band => {
                const bandFreq = clamp(settings[freqParam(band.id)], minFreq, maxFreq);
                const bandGain = clamp(settings[gainParam(band.id)], minGain, maxGain);
                const distance = Math.abs(Math.log2(freq / bandFreq));
                const widthFactor = band.type === 'peaking' ? band.q : 0.58;
                const influence = Math.exp(-Math.pow(distance * widthFactor, 2));
                gain += bandGain * influence;
            });
            points.push([x, gainToY(clamp(gain, minGain, maxGain), height)]);
        }
        return points.map((point, index) => (index ? 'L' : 'M') + point[0].toFixed(1) + ' ' + point[1].toFixed(1)).join(' ');
    }

    function makeGraph(api) {
        const width = 760;
        const height = 260;
        const root = document.createElement('div');
        root.className = 'fb-eq-panel';

        const title = document.createElement('div');
        title.className = 'fb-eq-title';
        title.innerHTML = '<span>spectrum sculptor</span><span>drag points to shape eq</span>';

        const graph = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        graph.classList.add('fb-eq-graph');
        graph.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
        graph.setAttribute('role', 'img');
        graph.setAttribute('aria-label', 'interactive EQ graph');

        const grid = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        grid.classList.add('fb-eq-grid');
        [40, 80, 160, 320, 640, 1000, 2500, 5000, 10000, 16000].forEach(freq => {
            const x = freqToX(freq, width);
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', x);
            line.setAttribute('x2', x);
            line.setAttribute('y1', 0);
            line.setAttribute('y2', height);
            grid.append(line);
        });
        [-12, -6, 0, 6, 12].forEach(gain => {
            const y = gainToY(gain, height);
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', 0);
            line.setAttribute('x2', width);
            line.setAttribute('y1', y);
            line.setAttribute('y2', y);
            if (gain === 0) line.classList.add('is-zero');
            grid.append(line);
        });
        graph.append(grid);

        const fill = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        fill.classList.add('fb-eq-fill');
        const curve = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        curve.classList.add('fb-eq-curve');
        graph.append(fill, curve);

        const handles = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        graph.append(handles);

        const readout = document.createElement('div');
        readout.className = 'fb-eq-readout';
        const controls = document.createElement('details');
        controls.className = 'fb-eq-controls';
        const controlsToggle = document.createElement('summary');
        controlsToggle.textContent = 'precision controls';
        const bandPicker = document.createElement('div');
        bandPicker.className = 'fb-eq-band-picker';
        const sliderGrid = document.createElement('div');
        sliderGrid.className = 'fb-eq-slider-grid';
        const freqWrap = document.createElement('label');
        const freqLabel = document.createElement('span');
        const freqValue = document.createElement('b');
        const freqSlider = document.createElement('input');
        const gainWrap = document.createElement('label');
        const gainLabel = document.createElement('span');
        const gainValue = document.createElement('b');
        const gainSlider = document.createElement('input');
        const handleEls = new Map();
        let activeBandId = 'three';
        let draggingBandId = null;

        freqLabel.textContent = 'freq';
        gainLabel.textContent = 'gain';
        [freqSlider, gainSlider].forEach(slider => {
            slider.type = 'range';
            slider.className = 'fb-eq-slider';
        });
        freqSlider.min = '0';
        freqSlider.max = '1000';
        freqSlider.step = '1';
        gainSlider.min = String(minGain);
        gainSlider.max = String(maxGain);
        gainSlider.step = '0.1';
        freqWrap.append(freqLabel, freqSlider, freqValue);
        gainWrap.append(gainLabel, gainSlider, gainValue);
        sliderGrid.append(freqWrap, gainWrap);
        controls.append(controlsToggle, bandPicker, sliderGrid);

        bands.forEach(band => {
            const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            group.classList.add('fb-eq-handle');
            group.style.setProperty('--band', band.color);
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('r', '11');
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('dominant-baseline', 'central');
            text.textContent = band.label;
            group.append(circle, text);
            group.addEventListener('pointerdown', event => {
                event.preventDefault();
                draggingBandId = band.id;
                graph.setPointerCapture(event.pointerId);
                moveBand(event, band);
            });
            handles.append(group);
            handleEls.set(band.id, group);

            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'fb-eq-band-button';
            button.textContent = band.label;
            button.style.setProperty('--band', band.color);
            button.addEventListener('click', () => {
                activeBandId = band.id;
                redraw();
            });
            bandPicker.append(button);
        });

        graph.addEventListener('pointermove', event => {
            if (!draggingBandId || !graph.hasPointerCapture(event.pointerId)) return;
            const band = bands.find(item => item.id === draggingBandId);
            if (!band) return;
            event.preventDefault();
            moveBand(event, band);
        });
        ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => {
            graph.addEventListener(type, () => {
                draggingBandId = null;
            });
        });

        freqSlider.addEventListener('input', () => {
            const band = bands.find(item => item.id === activeBandId) || bands[3];
            api.setParam(freqParam(band.id), sliderToFreq(freqSlider.value));
            redraw();
        });
        gainSlider.addEventListener('input', () => {
            const band = bands.find(item => item.id === activeBandId) || bands[3];
            api.setParam(gainParam(band.id), Math.round(Number(gainSlider.value) * 10) / 10);
            redraw();
        });

        const redraw = () => {
            const path = makePath(api.settings, width, height);
            curve.setAttribute('d', path);
            fill.setAttribute('d', path + ' L ' + width + ' ' + gainToY(0, height) + ' L 0 ' + gainToY(0, height) + ' Z');
            bands.forEach(band => {
                const x = freqToX(api.settings[freqParam(band.id)], width);
                const y = gainToY(api.settings[gainParam(band.id)], height);
                const group = handleEls.get(band.id);
                if (!group) return;
                group.classList.toggle('is-active', activeBandId === band.id);
                group.setAttribute('transform', 'translate(' + x + ' ' + y + ')');
            });
            Array.from(bandPicker.children).forEach((button, index) => {
                button.classList.toggle('is-active', bands[index].id === activeBandId);
            });
            const selected = bands.find(band => band.id === activeBandId) || bands[3];
            const selectedFreq = api.settings[freqParam(selected.id)];
            const selectedGain = api.settings[gainParam(selected.id)] || 0;
            freqSlider.value = String(freqToSlider(selectedFreq));
            gainSlider.value = String(selectedGain);
            freqValue.textContent = displayFreq(selectedFreq) + 'hz';
            gainValue.textContent = selectedGain.toFixed(1) + 'db';
            readout.textContent = selected.label + ' ' + displayFreq(api.settings[freqParam(selected.id)]) + 'hz / ' + (api.settings[gainParam(selected.id)] || 0).toFixed(1) + 'db';
        };

        const moveBand = (event, band) => {
            const rect = graph.getBoundingClientRect();
            const x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * width;
            const y = ((event.clientY - rect.top) / Math.max(1, rect.height)) * height;
            const freq = Math.round(xToFreq(x, width));
            const gain = Math.round(yToGain(y, height) * 10) / 10;
            activeBandId = band.id;
            api.setParam(freqParam(band.id), freq);
            api.setParam(gainParam(band.id), gain);
            redraw();
        };

        redraw();
        root.append(title, graph, readout, controls);
        return root;
    }

    const params = bands.flatMap((band, index) => [
        { id: freqParam(band.id), label: band.label + ' freq', type: 'range', min: minFreq, max: maxFreq, step: 1, default: [80, 180, 420, 1000, 2400, 6200, 11000][index], unit: 'hz' },
        { id: gainParam(band.id), label: band.label + ' gain', type: 'range', min: minGain, max: maxGain, step: 0.1, default: 0, unit: 'db' }
    ]);

    window.frdgBeatsEffects.register({
        id: 'eq',
        name: 'Parametric EQ',
        params,
        presets: [
            { name: 'Clean Balance', settings: { lowFreq: 80, lowGain: 0, oneFreq: 180, oneGain: 0, twoFreq: 420, twoGain: 0, threeFreq: 1000, threeGain: 0, fourFreq: 2400, fourGain: 0, fiveFreq: 6200, fiveGain: 0, highFreq: 11000, highGain: 0 } },
            { name: 'Vocal Shine', settings: { lowFreq: 100, lowGain: -3, oneFreq: 250, oneGain: -2, twoFreq: 520, twoGain: -1, threeFreq: 1200, threeGain: 1.4, fourFreq: 3200, fourGain: 3.6, fiveFreq: 7400, fiveGain: 2.8, highFreq: 12500, highGain: 3.4 } },
            { name: 'Kick Tightener', settings: { lowFreq: 58, lowGain: 3.8, oneFreq: 190, oneGain: -5.2, twoFreq: 430, twoGain: -2.4, threeFreq: 1100, threeGain: 0, fourFreq: 2500, fourGain: 1.8, fiveFreq: 5600, fiveGain: 2.2, highFreq: 11000, highGain: 0 } },
            { name: 'Bass Scoop', settings: { lowFreq: 72, lowGain: 4.6, oneFreq: 180, oneGain: 1.8, twoFreq: 360, twoGain: -4.8, threeFreq: 900, threeGain: -2.2, fourFreq: 2100, fourGain: 1.5, fiveFreq: 5200, fiveGain: 0, highFreq: 10000, highGain: -2 } },
            { name: 'Lo-Fi Telephone', settings: { lowFreq: 240, lowGain: -12, oneFreq: 420, oneGain: -4, twoFreq: 800, twoGain: 3.2, threeFreq: 1500, threeGain: 5.8, fourFreq: 2800, fourGain: 2.5, fiveFreq: 5200, fiveGain: -7, highFreq: 7000, highGain: -14 } },
            { name: 'Airy Master', settings: { lowFreq: 45, lowGain: 1.2, oneFreq: 160, oneGain: -0.8, twoFreq: 400, twoGain: -0.6, threeFreq: 1200, threeGain: 0.4, fourFreq: 3200, fourGain: 0.8, fiveFreq: 8500, fiveGain: 1.6, highFreq: 14000, highGain: 2.2 } }
        ],
        css: `
.fb-eq-panel {
    margin: 9px;
    padding: 12px;
    border: 1px solid rgba(134, 211, 207, 0.5);
    border-radius: 6px;
    background:
        radial-gradient(circle at 80% 0%, rgba(134, 211, 207, 0.12), transparent 34%),
        linear-gradient(145deg, rgba(3, 12, 15, 0.98), rgba(0, 0, 0, 0.98));
    box-shadow: inset 0 0 22px rgba(134, 211, 207, 0.1), 0 10px 24px rgba(0,0,0,0.34);
}
.fb-eq-title {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 10px;
    color: #bffffb;
    font-family: "MainBold", monospace;
    font-size: 12px;
    text-transform: uppercase;
}
.fb-eq-title span:last-child {
    color: rgba(191, 255, 251, 0.56);
}
.fb-eq-graph {
    width: 100%;
    height: auto;
    min-height: 230px;
    border: 1px solid rgba(134, 211, 207, 0.3);
    background: #030607;
    touch-action: none;
}
.fb-eq-grid line {
    stroke: rgba(134, 211, 207, 0.13);
    stroke-width: 1;
}
.fb-eq-grid line.is-zero {
    stroke: rgba(255, 226, 94, 0.34);
}
.fb-eq-fill {
    fill: rgba(134, 211, 207, 0.12);
}
.fb-eq-curve {
    fill: none;
    stroke: #86d3cf;
    stroke-width: 3;
    filter: drop-shadow(0 0 6px rgba(134, 211, 207, 0.65));
}
.fb-eq-handle {
    cursor: grab;
}
.fb-eq-handle circle {
    fill: var(--band);
    stroke: rgba(0,0,0,0.82);
    stroke-width: 3;
    filter: drop-shadow(0 0 7px var(--band));
}
.fb-eq-handle.is-active circle {
    stroke: #fff;
}
.fb-eq-handle text {
    fill: #020202;
    font-size: 10px;
    font-family: "MainBold", monospace;
    pointer-events: none;
}
.fb-eq-readout {
    margin-top: 8px;
    color: rgba(191, 255, 251, 0.82);
    font-size: 11px;
}
.fb-eq-controls {
    margin-top: 10px;
    border-top: 1px solid rgba(134, 211, 207, 0.18);
    color: rgba(191, 255, 251, 0.82);
}
.fb-eq-controls summary {
    width: max-content;
    margin-top: 9px;
    color: #bffffb;
    font-family: "MainBold", monospace;
    font-size: 11px;
    cursor: pointer;
}
.fb-eq-band-picker {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 5px;
    margin-top: 10px;
}
.fb-eq-band-button {
    min-width: 0;
    padding: 6px 0;
    border: 1px solid rgba(134, 211, 207, 0.24);
    border-radius: 4px;
    color: var(--band);
    background: rgba(255, 255, 255, 0.035);
    font-family: "MainBold", monospace;
    font-size: 11px;
    cursor: pointer;
}
.fb-eq-band-button.is-active {
    border-color: var(--band);
    color: #050505;
    background: var(--band);
    box-shadow: 0 0 12px var(--band);
}
.fb-eq-slider-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin-top: 10px;
}
.fb-eq-slider-grid label {
    display: grid;
    grid-template-columns: 38px minmax(0, 1fr) 54px;
    gap: 8px;
    align-items: center;
    font-size: 11px;
}
.fb-eq-slider-grid span {
    color: rgba(191, 255, 251, 0.62);
    text-align: right;
}
.fb-eq-slider-grid b {
    color: #bffffb;
    font-weight: normal;
    text-align: right;
}
.fb-eq-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 6px;
    margin: 8px 0;
    border: 1px solid rgba(134, 211, 207, 0.34);
    border-radius: 999px;
    background:
        linear-gradient(90deg, rgba(134, 211, 207, 0.2), rgba(255, 226, 94, 0.76), rgba(255, 123, 136, 0.5)),
        #030607;
    cursor: pointer;
}
.fb-eq-slider:focus {
    outline: none;
    box-shadow: 0 0 0 2px rgba(134, 211, 207, 0.2);
}
.fb-eq-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    border: 2px solid #020202;
    border-radius: 4px;
    background: #bffffb;
    box-shadow: 0 0 9px rgba(134, 211, 207, 0.72);
}
.fb-eq-slider::-moz-range-track {
    height: 6px;
    border: 1px solid rgba(134, 211, 207, 0.34);
    border-radius: 999px;
    background:
        linear-gradient(90deg, rgba(134, 211, 207, 0.2), rgba(255, 226, 94, 0.76), rgba(255, 123, 136, 0.5)),
        #030607;
}
.fb-eq-slider::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border: 2px solid #020202;
    border-radius: 4px;
    background: #bffffb;
    box-shadow: 0 0 9px rgba(134, 211, 207, 0.72);
}
@media (max-width: 700px) {
    .fb-eq-slider-grid {
        grid-template-columns: 1fr;
    }
}
`,
        create(context, settings) {
            const input = context.createGain();
            const output = context.createGain();
            let current = input;
            const nodes = [];
            bands.forEach(band => {
                const filter = context.createBiquadFilter();
                filter.type = band.type;
                filter.frequency.value = clamp(settings[freqParam(band.id)], minFreq, maxFreq);
                filter.gain.value = clamp(settings[gainParam(band.id)], minGain, maxGain);
                filter.Q.value = band.q;
                current.connect(filter);
                current = filter;
                nodes.push(filter);
            });
            current.connect(output);
            return { input, output, nodes };
        },
        renderGui(api) {
            return makeGraph(api);
        }
    });
})();
