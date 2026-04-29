(function () {
    const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));

    function formatSpeed(value) {
        return clamp(value, 0.125, 8).toFixed(2).replace(/\.00$/, '') + 'x';
    }

    window.fridgeBeatsEffects.register({
        id: 'sample-speed',
        name: 'Sample Speed',
        params: [
            { id: 'speed', label: 'speed', type: 'range', min: 0.125, max: 4, step: 0.005, default: 1 },
            { id: 'sync', label: 'tempo sync', type: 'select', options: ['off', 'on'], default: 'off' },
            { id: 'sampleBpm', label: 'sample bpm', type: 'range', min: 1, max: 400, step: 0.1, default: 120 }
        ],
        presets: [
            { name: 'Half Time', settings: { speed: 0.5, sync: 'off', sampleBpm: 120 } },
            { name: 'Double Time', settings: { speed: 2, sync: 'off', sampleBpm: 120 } },
            { name: 'Cassette Drag', settings: { speed: 0.82, sync: 'off', sampleBpm: 120 } },
            { name: 'Tempo Match 100', settings: { speed: 1, sync: 'on', sampleBpm: 100 } },
            { name: 'Tempo Match 140', settings: { speed: 1, sync: 'on', sampleBpm: 140 } }
        ],
        css: `
.fb-speed-panel {
    margin: 9px;
    padding: 13px;
    border: 1px solid rgba(143, 255, 184, 0.4);
    border-radius: 8px;
    background:
        radial-gradient(circle at 10% 8%, rgba(255, 214, 102, 0.18), transparent 30%),
        linear-gradient(135deg, rgba(8, 24, 19, 0.98), rgba(5, 7, 8, 0.98));
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06), 0 10px 24px rgba(0, 0, 0, 0.32);
}
.fb-speed-title {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 12px;
    color: #8fffb8;
    font-family: "MainBold", monospace;
    font-size: 12px;
    letter-spacing: 0;
    text-transform: uppercase;
}
.fb-speed-title span:last-child {
    color: #ffd666;
}
.fb-speed-main {
    display: grid;
    grid-template-columns: minmax(160px, 1fr) minmax(140px, 0.8fr);
    gap: 12px;
}
.fb-speed-card {
    display: grid;
    gap: 10px;
    padding: 11px;
    border-radius: 7px;
    background: rgba(255, 255, 255, 0.055);
}
.fb-speed-row,
.fb-speed-check {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    color: rgba(235, 255, 243, 0.86);
    font-size: 11px;
}
.fb-speed-readout {
    color: #ffd666;
}
.fb-speed-card input[type="range"] {
    --value: 0.23;
    width: 100%;
    height: 12px;
    appearance: none;
    border-radius: 999px;
    background:
        linear-gradient(90deg, #8fffb8 calc(var(--value) * 100%), rgba(255,255,255,0.12) 0),
        #03100b;
    outline: none;
}
.fb-speed-card input[type="range"]::-webkit-slider-thumb {
    appearance: none;
    width: 20px;
    height: 20px;
    border: 2px solid #07130e;
    border-radius: 50%;
    background: #ffd666;
    box-shadow: 0 0 0 3px rgba(255, 214, 102, 0.24);
}
.fb-speed-card input[type="range"]::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border: 2px solid #07130e;
    border-radius: 50%;
    background: #ffd666;
    box-shadow: 0 0 0 3px rgba(255, 214, 102, 0.24);
}
.fb-speed-check {
    justify-content: flex-start;
}
.fb-speed-check input {
    width: 18px;
    height: 18px;
    accent-color: #8fffb8;
}
.fb-speed-text {
    width: 100%;
    min-width: 0;
    height: 32px;
    border: 1px solid rgba(143, 255, 184, 0.4);
    border-radius: 5px;
    background: rgba(0, 0, 0, 0.42);
    color: #f3fff7;
    font-family: "MainRegular", monospace;
    font-size: 13px;
    padding: 0 9px;
}
.fb-speed-text:disabled {
    opacity: 0.45;
}
@media (max-width: 720px) {
    .fb-speed-main {
        grid-template-columns: 1fr;
    }
}
`,
        create(context) {
            const input = context.createGain();
            const output = context.createGain();
            input.connect(output);
            return { input, output };
        },
        renderGui(api) {
            const root = document.createElement('div');
            root.className = 'fb-speed-panel';

            const title = document.createElement('div');
            title.className = 'fb-speed-title';
            title.innerHTML = '<span>sample speed</span><span>sample only</span>';

            const main = document.createElement('div');
            main.className = 'fb-speed-main';

            const speedCard = document.createElement('label');
            speedCard.className = 'fb-speed-card';
            const speedTop = document.createElement('span');
            speedTop.className = 'fb-speed-row';
            const speedLabel = document.createElement('span');
            speedLabel.textContent = 'speed';
            const speedReadout = document.createElement('span');
            speedReadout.className = 'fb-speed-readout';
            const speedInput = document.createElement('input');
            speedInput.type = 'range';
            speedInput.min = '0.125';
            speedInput.max = '4';
            speedInput.step = '0.005';
            speedInput.value = String(clamp(api.settings.speed, 0.125, 4));
            const updateSpeed = (persist = true) => {
                const next = clamp(speedInput.value, 0.125, 4);
                speedInput.style.setProperty('--value', String((next - 0.125) / 3.875));
                speedReadout.textContent = formatSpeed(next);
                if (persist) api.setParam('speed', next);
            };
            updateSpeed(false);
            speedInput.addEventListener('input', updateSpeed);
            speedInput.addEventListener('change', updateSpeed);
            speedTop.append(speedLabel, speedReadout);
            speedCard.append(speedTop, speedInput);

            const syncCard = document.createElement('div');
            syncCard.className = 'fb-speed-card';
            const checkLabel = document.createElement('label');
            checkLabel.className = 'fb-speed-check';
            const check = document.createElement('input');
            check.type = 'checkbox';
            check.checked = api.settings.sync === 'on';
            const checkText = document.createElement('span');
            checkText.textContent = 'tempo sync';
            checkLabel.append(check, checkText);

            const bpmRow = document.createElement('label');
            bpmRow.className = 'fb-speed-row';
            const bpmLabel = document.createElement('span');
            bpmLabel.textContent = 'sample bpm';
            const bpmInput = document.createElement('input');
            bpmInput.className = 'fb-speed-text';
            bpmInput.type = 'text';
            bpmInput.inputMode = 'decimal';
            bpmInput.value = String(clamp(api.settings.sampleBpm, 1, 400));

            const commitBpm = () => {
                const next = clamp(bpmInput.value, 1, 400);
                bpmInput.value = String(Number(next.toFixed(1)));
                api.setParam('sampleBpm', next);
            };
            const updateSync = (persist = true) => {
                bpmInput.disabled = !check.checked;
                if (persist) api.setParam('sync', check.checked ? 'on' : 'off');
            };
            check.addEventListener('change', updateSync);
            bpmInput.addEventListener('change', commitBpm);
            bpmInput.addEventListener('blur', commitBpm);
            bpmInput.addEventListener('keydown', event => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    commitBpm();
                    bpmInput.blur();
                }
            });
            updateSync(false);
            bpmRow.append(bpmLabel, bpmInput);
            syncCard.append(checkLabel, bpmRow);

            main.append(speedCard, syncCard);
            root.append(title, main);
            return root;
        }
    });
})();
