(function () {
    const root = document.getElementById('frdgbeats-daw');
    if (!root || root.dataset.ready === '1') return;
    root.dataset.ready = '1';

    const DEFAULT_STEPS = 16;
    const STEP_OPTIONS = [16, 32];
    let projectSteps = DEFAULT_STEPS;
    const DEFAULT_BAR_COUNT = 4;
    const MAX_BARS = 128;
    const MAX_PATTERNS = 128;
    const MAX_AUTOMATION_LANES = 48;
    const DEFAULT_NOTE_LENGTH_SNAP = 0.5;
    const NOTE_LENGTH_SNAP_OPTIONS = [1, 0.5, 0.25];
    const DISABLED_CLIP = -1;
    const NOTE_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C'];
    const CHROMATIC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const FL_KEYBOARD = {
        z: 0, s: 1, x: 2, d: 3, c: 4, v: 5, g: 6, b: 7, h: 8, n: 9, j: 10, m: 11,
        q: 12, '2': 13, w: 14, '3': 15, e: 16, r: 17, '5': 18, t: 19, '6': 20, y: 21, '7': 22, u: 23
    };
    const BRITISH_QWERTY_KEYBOARD = {
        ',': 12, l: 13, '.': 14, ';': 15, '/': 16,
        i: 24, '9': 25, o: 26, '0': 27, p: 28, '[': 29, '=': 30, ']': 31,
        '-': 32, "'": 33, '#': 34, '\\': 35
    };
    const COLORS = ['#86d3cf', '#977eb6', '#c88420', '#6ccf6c', '#cf6c6c', '#4d76c9'];
    const MIDI_PROGRAM_NAMES = [
        'Acoustic Grand Piano', 'Bright Acoustic Piano', 'Electric Grand Piano', 'Honky-tonk Piano',
        'Electric Piano 1', 'Electric Piano 2', 'Harpsichord', 'Clavi', 'Celesta', 'Glockenspiel',
        'Music Box', 'Vibraphone', 'Marimba', 'Xylophone', 'Tubular Bells', 'Dulcimer',
        'Drawbar Organ', 'Percussive Organ', 'Rock Organ', 'Church Organ', 'Reed Organ', 'Accordion',
        'Harmonica', 'Tango Accordion', 'Acoustic Guitar Nylon', 'Acoustic Guitar Steel',
        'Electric Guitar Jazz', 'Electric Guitar Clean', 'Electric Guitar Muted', 'Overdriven Guitar',
        'Distortion Guitar', 'Guitar Harmonics', 'Acoustic Bass', 'Electric Bass Finger',
        'Electric Bass Pick', 'Fretless Bass', 'Slap Bass 1', 'Slap Bass 2', 'Synth Bass 1',
        'Synth Bass 2', 'Violin', 'Viola', 'Cello', 'Contrabass', 'Tremolo Strings',
        'Pizzicato Strings', 'Orchestral Harp', 'Timpani', 'String Ensemble 1', 'String Ensemble 2',
        'Synth Strings 1', 'Synth Strings 2', 'Choir Aahs', 'Voice Oohs', 'Synth Voice',
        'Orchestra Hit', 'Trumpet', 'Trombone', 'Tuba', 'Muted Trumpet', 'French Horn',
        'Brass Section', 'Synth Brass 1', 'Synth Brass 2', 'Soprano Sax', 'Alto Sax', 'Tenor Sax',
        'Baritone Sax', 'Oboe', 'English Horn', 'Bassoon', 'Clarinet', 'Piccolo', 'Flute',
        'Recorder', 'Pan Flute', 'Blown Bottle', 'Shakuhachi', 'Whistle', 'Ocarina',
        'Lead 1 Square', 'Lead 2 Sawtooth', 'Lead 3 Calliope', 'Lead 4 Chiff',
        'Lead 5 Charang', 'Lead 6 Voice', 'Lead 7 Fifths', 'Lead 8 Bass + Lead',
        'Pad 1 New Age', 'Pad 2 Warm', 'Pad 3 Polysynth', 'Pad 4 Choir', 'Pad 5 Bowed',
        'Pad 6 Metallic', 'Pad 7 Halo', 'Pad 8 Sweep', 'FX 1 Rain', 'FX 2 Soundtrack',
        'FX 3 Crystal', 'FX 4 Atmosphere', 'FX 5 Brightness', 'FX 6 Goblins', 'FX 7 Echoes',
        'FX 8 Sci-fi', 'Sitar', 'Banjo', 'Shamisen', 'Koto', 'Kalimba', 'Bagpipe',
        'Fiddle', 'Shanai', 'Tinkle Bell', 'Agogo', 'Steel Drums', 'Woodblock', 'Taiko Drum',
        'Melodic Tom', 'Synth Drum', 'Reverse Cymbal', 'Guitar Fret Noise', 'Breath Noise',
        'Seashore', 'Bird Tweet', 'Telephone Ring', 'Helicopter', 'Applause', 'Gunshot'
    ];
    const STORAGE_KEY = 'frdgbeats-project-v1';
    const DEFAULT_SOUNDFONT_URL = '/others/frdgbeats/soundfonts/Roland_SC-55.sf2';
    const SOUNDFONT_LIST_URL = '/others/frdgbeats/soundfonts/index.php';
    const SAMPLE_LIST_URL = '/others/frdgbeats/samples/index.php';
    const DEMO_LIST_URL = '/others/frdgbeats/demos/index.php';
    const PRESET_LIST_URL = '/others/frdgbeats/presets/index.php';
    const EFFECT_LIST_URL = '/others/frdgbeats/effects/index.php';
    const SYNTH_LIST_URL = '/others/frdgbeats/synths/index.php';
    const RUBBERBAND_WORKER_URL = '/others/frdgbeats/vendor/rubberband-worker.js';

    let audio = null;
    let schedulerTimer = null;
    let isPlaying = false;
    let isRecording = false;
    let selectedId = 'drums';
    let currentStep = 0;
    let currentBar = 0;
    let currentView = 'roll';
    let nextStepTime = 0;
    let levelDecay = 0.08;
    let meterAnimation = null;
    let resizingNote = null;
    let slidingNote = null;
    let placingNote = null;
    let movingNote = null;
    let rollPreviewVoice = null;
    let rollPreviewSerial = 0;
    let rollResizeTimer = null;
    let noteLengthSnap = DEFAULT_NOTE_LENGTH_SNAP;
    let sampleEditorDrag = null;
    const activeSamplePlayheads = [];
    const samplePitchCache = new WeakMap();
    const samplePitchPendingCache = new WeakMap();
    const samplePitchWarmQueue = new Set();
    const rubberBandJobs = new Map();
    let rubberBandWorker = null;
    let rubberBandJobId = 1;
    let rubberBandUnavailable = false;
    let suppressRollClick = false;
    let suppressAutomationClick = false;
    let velocityEditor = null;
    const heldKeys = new Set();
    const activeKeyboardVoices = new Map();
    let soundfontBank = {
        name: 'Roland SC-55',
        asset: null,
        url: DEFAULT_SOUNDFONT_URL,
        sampleData: null,
        presets: [{ name: 'Acoustic Grand Piano', program: 0, bank: 0, zones: [] }]
    };
    const soundfontBankCache = new Map();
    let soundfontLoadPromise = null;
    let soundfontCatalog = [{ name: 'Roland SC-55', filename: 'Roland_SC-55.sf2', url: DEFAULT_SOUNDFONT_URL }];
    let soundfontCatalogPromise = null;
    let sampleCatalog = [];
    let sampleCatalogPromise = null;
    let customSoundfontBank = null;
    let useCustomSoundfont = false;
    const effectDefinitions = new Map();
    const synthDefinitions = new Map();
    const channelOutputs = new Map();
    const retiredChannelOutputs = new Set();
    let effectCatalogPromise = null;
    let synthCatalogPromise = null;

    const initialChannel = emptyProjectChannel();
    const state = {
        projectName: 'Untitled',
        bpm: 128,
        octave: 2,
        noteSnap: noteLengthSnap,
        masterVolume: 0.82,
        steps: projectSteps,
        barCount: DEFAULT_BAR_COUNT,
        loopRange: null,
        clips: { [initialChannel.id]: Array.from({ length: DEFAULT_BAR_COUNT }, () => DISABLED_CLIP) },
        channels: [initialChannel]
    };

    const els = {
        play: document.getElementById('fb-play'),
        stop: document.getElementById('fb-stop'),
        record: document.getElementById('fb-record'),
        projectName: document.getElementById('fb-project-name'),
        bpm: document.getElementById('fb-bpm'),
        status: document.getElementById('fb-status'),
        meterL: document.getElementById('fb-meter-l'),
        meterR: document.getElementById('fb-meter-r'),
        masterVolume: document.getElementById('fb-master-volume'),
        waveform: document.getElementById('fb-waveform'),
        channelList: document.getElementById('fb-channel-list'),
        addChannel: document.getElementById('fb-add-channel'),
        pianoRoll: document.getElementById('fb-piano-roll'),
        selectedLabel: document.getElementById('fb-selected-label'),
        pattern: document.getElementById('fb-pattern'),
        patternSteps: document.getElementById('fb-pattern-steps'),
        octave: document.getElementById('fb-octave'),
        noteSnap: document.getElementById('fb-note-snap'),
        clearPattern: document.getElementById('fb-clear-pattern'),
        rollTab: document.getElementById('fb-roll-tab'),
        playlistTab: document.getElementById('fb-playlist-tab'),
        mixerTab: document.getElementById('fb-mixer-tab'),
        automationTab: document.getElementById('fb-automation-tab'),
        waveformTab: document.getElementById('fb-waveform-tab'),
        synthTab: document.getElementById('fb-synth-tab'),
        rollView: document.getElementById('fb-roll-view'),
        playlistView: document.getElementById('fb-playlist-view'),
        mixerView: document.getElementById('fb-mixer-view'),
        automationView: document.getElementById('fb-automation-view'),
        waveformView: document.getElementById('fb-waveform-view'),
        synthView: document.getElementById('fb-synth-view'),
        mixer: document.getElementById('fb-mixer'),
        mixerLabel: document.getElementById('fb-mixer-label'),
        automationLabel: document.getElementById('fb-automation-label'),
        automationPattern: document.getElementById('fb-automation-pattern'),
        automationTarget: document.getElementById('fb-automation-target'),
        addAutomation: document.getElementById('fb-add-automation'),
        automation: document.getElementById('fb-automation'),
        waveformLabel: document.getElementById('fb-waveform-label'),
        synthLabel: document.getElementById('fb-synth-label'),
        synthEditor: document.getElementById('fb-synth-editor'),
        sampleZoomOut: document.getElementById('fb-sample-zoom-out'),
        sampleZoomReset: document.getElementById('fb-sample-zoom-reset'),
        sampleZoomIn: document.getElementById('fb-sample-zoom-in'),
        sampleScroll: document.getElementById('fb-sample-scroll'),
        removeSampleZone: document.getElementById('fb-remove-sample-zone'),
        sampleCanvas: document.getElementById('fb-sample-canvas'),
        sampleEditorStatus: document.getElementById('fb-sample-editor-status'),
        effectPicker: document.getElementById('fb-effect-picker'),
        addEffect: document.getElementById('fb-add-effect'),
        playlist: document.getElementById('fb-playlist'),
        clearPlaylist: document.getElementById('fb-clear-playlist'),
        save: document.getElementById('fb-save'),
        load: document.getElementById('fb-load'),
        newProject: document.getElementById('fb-new-project'),
        presetsMenu: document.getElementById('fb-presets-menu'),
        demosMenuButton: document.getElementById('fb-demos-menu-button'),
        demosMenu: document.getElementById('fb-demos-menu'),
        globalSoundfont: document.getElementById('fb-global-soundfont'),
        soundfontMenu: document.getElementById('fb-soundfont-menu'),
        importProject: document.getElementById('fb-import-project'),
        exportProject: document.getElementById('fb-export-project'),
        importMidi: document.getElementById('fb-import-midi'),
        exportMidi: document.getElementById('fb-export-midi'),
        exportWav: document.getElementById('fb-export-wav'),
        importMenuButton: document.getElementById('fb-import-menu-button'),
        exportMenuButton: document.getElementById('fb-export-menu-button'),
        importMenu: document.getElementById('fb-import-menu'),
        exportMenu: document.getElementById('fb-export-menu'),
        projectFile: document.getElementById('fb-project-file'),
        midiFile: document.getElementById('fb-midi-file'),
        globalSoundfontFile: document.getElementById('fb-global-soundfont-file')
    };

    function normalizeBarCount(value = state.barCount) {
        return Math.max(1, Math.min(MAX_BARS, Number(value) || DEFAULT_BAR_COUNT));
    }

    function normalizeStepCount(value) {
        const number = Number(value) || DEFAULT_STEPS;
        return STEP_OPTIONS.includes(number) ? number : DEFAULT_STEPS;
    }

    function normalizeNoteSnap(value) {
        const number = Number(value);
        return NOTE_LENGTH_SNAP_OPTIONS.includes(number) ? number : DEFAULT_NOTE_LENGTH_SNAP;
    }

    function setNoteSnap(value) {
        noteLengthSnap = normalizeNoteSnap(value);
        state.noteSnap = noteLengthSnap;
        if (els.noteSnap) els.noteSnap.value = String(noteLengthSnap);
    }

    function stepCount() {
        return projectSteps;
    }

    function resizePattern(pattern, length = stepCount()) {
        const resized = Array.isArray(pattern) ? pattern.slice(0, length) : [];
        while (resized.length < length) resized.push([]);
        return resized.map(normalizeStepEvents);
    }

    function setProjectSteps(value, resize = true) {
        projectSteps = normalizeStepCount(value);
        state.steps = projectSteps;
        if (currentStep >= projectSteps) currentStep = 0;
        if (resize && Array.isArray(state.channels)) {
            state.channels.forEach(channel => {
                if (Array.isArray(channel.patterns)) {
                    channel.patterns = channel.patterns.map(pattern => resizePattern(pattern, projectSteps));
                }
                if (Array.isArray(channel.automation)) {
                    channel.automation.forEach(lane => {
                        Object.keys(automationPatternValues(lane)).forEach(patternIndex => {
                            lane.valuesByPattern[patternIndex] = resizeAutomationValues(lane.valuesByPattern[patternIndex], projectSteps);
                        });
                    });
                }
                channel.pattern = Array.isArray(channel.patterns)
                    ? channel.patterns[Math.max(0, Math.min(MAX_PATTERNS - 1, Number(channel.activePattern) || 0))]
                    : resizePattern(channel.pattern, projectSteps);
            });
        }
        if (els.patternSteps) els.patternSteps.value = String(projectSteps);
    }

    function inferProjectSteps(saved) {
        if (saved && saved.steps) return normalizeStepCount(saved.steps);
        let highest = DEFAULT_STEPS;
        if (saved && Array.isArray(saved.channels)) {
            saved.channels.forEach(channel => {
                if (Array.isArray(channel.patterns)) {
                    channel.patterns.forEach(pattern => {
                        if (Array.isArray(pattern)) highest = Math.max(highest, pattern.length);
                    });
                } else if (Array.isArray(channel.pattern)) {
                    highest = Math.max(highest, channel.pattern.length);
                }
            });
        }
        if (highest > 16) return 32;
        return 16;
    }

    function arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let index = 0; index < bytes.length; index += 0x8000) {
            binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
        }
        return window.btoa(binary);
    }

    function base64ToArrayBuffer(base64) {
        const binary = window.atob(base64 || '');
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) {
            bytes[index] = binary.charCodeAt(index);
        }
        return bytes.buffer;
    }

    async function fileToAsset(file) {
        const buffer = await file.arrayBuffer();
        return {
            name: file.name,
            type: file.type || 'application/octet-stream',
            data: arrayBufferToBase64(buffer)
        };
    }

    function renderPatternOptions() {
        const selected = Number(els.pattern.value) || 0;
        els.pattern.innerHTML = '';
        const options = document.createDocumentFragment();
        for (let index = 0; index < MAX_PATTERNS; index += 1) {
            const option = document.createElement('option');
            option.value = String(index);
            option.textContent = String(index + 1);
            options.append(option);
        }
        els.pattern.append(options);
        els.pattern.value = String(Math.max(0, Math.min(MAX_PATTERNS - 1, selected)));
    }

    function renderAutomationPatternOptions(channel = selectedChannel()) {
        if (!els.automationPattern) return;
        const selected = normalizeAutomationPatternIndex(channel.activePattern || 0);
        els.automationPattern.innerHTML = '';
        const options = document.createDocumentFragment();
        for (let index = 0; index < MAX_PATTERNS; index += 1) {
            const option = document.createElement('option');
            option.value = String(index);
            option.textContent = String(index + 1);
            options.append(option);
        }
        els.automationPattern.append(options);
        els.automationPattern.value = String(selected);
    }

    function clearFloatingTooltips() {
        document.querySelectorAll('.tooltip').forEach(tooltip => tooltip.remove());
    }

    function hasSoundfontChannels() {
        return state.channels.some(channel => channel.source === 'soundfont');
    }

    function syncGlobalSoundfontButton() {
        if (!els.globalSoundfont) return;
        const enabled = hasSoundfontChannels();
        els.globalSoundfont.disabled = !enabled;
        els.globalSoundfont.setAttribute('data-tooltip', enabled ? 'set all SoundFont channels' : 'add a SoundFont channel first');
        if (!enabled && els.soundfontMenu) els.soundfontMenu.classList.add('fb-hidden');
    }

    function emptyProjectChannel() {
        const channel = makeChannel('track-1', 'channel 1', 'synth', COLORS[0], Array(stepCount()).fill(false), 'C4');
        channel.synthType = 'wave-oscillator';
        channel.patterns = Array.from({ length: MAX_PATTERNS }, () => Array.from({ length: stepCount() }, () => []));
        channel.pattern = channel.patterns[0];
        return channel;
    }

    function makeChannel(id, name, source, color, gates, note) {
        const safeSource = source === 'wave' ? 'synth' : (source || 'synth');
        const pattern = Array.from({ length: stepCount() }, (_, index) => gates[index] ? note : null);
        const patterns = Array.from({ length: MAX_PATTERNS }, (_, index) => index === 0 ? pattern.slice() : Array(stepCount()).fill(null));
        return {
            id,
            name,
            source: safeSource,
            color,
            muted: false,
            solo: false,
            wave: 'sawtooth',
            waveUnison: 1,
            waveDetune: 0.08,
            synthType: 'wave-oscillator',
            synthSettings: {},
            volume: safeSource === 'sample' ? 0.82 : 0.42,
            pan: 0,
            attack: 0.006,
            release: safeSource === 'sample' ? 0.18 : 0.11,
            sampleName: safeSource === 'sample' ? 'synthetic kick' : '',
            sampleType: 'one-shot',
            sampleKeepDuration: true,
            sampleSource: 'custom',
            sampleUrl: '',
            sampleStart: 0,
            sampleEnd: 1,
            sampleZones: [],
            sampleAsset: null,
            sampleBuffer: null,
            soundfontName: 'Roland SC-55',
            soundfontSource: 'bundled',
            soundfontUrl: DEFAULT_SOUNDFONT_URL,
            soundfontPreset: 'Acoustic Grand Piano',
            soundfontProgram: 0,
            soundfontBankNumber: 0,
            activePattern: 0,
            collapsed: true,
            effects: [],
            automation: [],
            patterns,
            pattern
        };
    }

    function ensureChannelPatterns(channel) {
        if (!Array.isArray(channel.patterns)) {
            channel.patterns = Array.from({ length: MAX_PATTERNS }, (_, index) => {
                if (index === 0 && Array.isArray(channel.pattern)) return channel.pattern.slice(0, stepCount());
                return Array(stepCount()).fill(null);
            });
        }
        channel.patterns = channel.patterns.slice(0, MAX_PATTERNS);
        while (channel.patterns.length < MAX_PATTERNS) channel.patterns.push(Array(stepCount()).fill(null));
        channel.patterns = channel.patterns.map(pattern => {
            const normalized = Array.isArray(pattern) ? pattern.slice(0, stepCount()) : Array(stepCount()).fill([]);
            while (normalized.length < stepCount()) normalized.push(null);
            return normalized.map(normalizeStepEvents);
        });
        channel.activePattern = Math.max(0, Math.min(MAX_PATTERNS - 1, Number(channel.activePattern) || 0));
        channel.pattern = channel.patterns[channel.activePattern];
    }

    function normalizeNoteEvent(value) {
        if (!value) return null;
        if (typeof value === 'string') return { note: value, length: 1 };
        if (typeof value === 'object' && typeof value.note === 'string') {
            const length = Math.min(stepCount(), snapNoteLength(value.length));
            const rawVelocity = Number(value.velocity);
            const velocity = Math.max(0, Math.min(1, Number.isFinite(rawVelocity) ? rawVelocity : 1));
            const normalized = { note: value.note, length, velocity };
            if (typeof value.slideTo === 'string' && /^([A-G]#?)([0-9])$/.test(value.slideTo) && value.slideTo !== value.note) {
                normalized.slideTo = value.slideTo;
            }
            return normalized;
        }
        return null;
    }

    function noteVelocity(event) {
        const rawVelocity = Number(event && event.velocity);
        return Math.max(0, Math.min(1, Number.isFinite(rawVelocity) ? rawVelocity : 1));
    }

    function velocityGain(value) {
        const gain = Math.max(0, Math.min(1, Number(value)));
        return Number.isFinite(gain) ? gain : 1;
    }

    function normalizeStepEvents(value) {
        if (!value) return [];
        const rawEvents = Array.isArray(value) ? value : [value];
        return rawEvents.map(normalizeNoteEvent).filter(Boolean);
    }

    function getStepEvents(pattern, step) {
        pattern[step] = normalizeStepEvents(pattern[step]);
        return pattern[step];
    }

    function findStepEvent(pattern, step, note) {
        return getStepEvents(pattern, step).find(event => event.note === note) || null;
    }

    function getPattern(channel, index = channel.activePattern) {
        ensureChannelPatterns(channel);
        const safeIndex = Math.max(0, Math.min(MAX_PATTERNS - 1, Number(index) || 0));
        return channel.patterns[safeIndex];
    }

    function ensureClipMap() {
        state.barCount = normalizeBarCount();
        if (currentBar >= state.barCount) currentBar = 0;
        if (state.loopRange) {
            const start = Math.max(0, Math.min(state.barCount - 1, Number(state.loopRange.start) || 0));
            const end = Math.max(start, Math.min(state.barCount - 1, Number(state.loopRange.end) || start));
            state.loopRange = { start, end };
        }
        state.channels.forEach(channel => {
            ensureChannelPatterns(channel);
            if (!Array.isArray(state.clips[channel.id])) {
                state.clips[channel.id] = Array.from({ length: state.barCount }, (_, index) => index === 0 ? 0 : null);
            }
            state.clips[channel.id] = state.clips[channel.id].slice(0, state.barCount);
            state.clips[channel.id] = state.clips[channel.id].map(value => {
                if (value === true) return 0;
                if (value === false || value === undefined) return null;
                const patternIndex = Number(value);
                if (patternIndex === DISABLED_CLIP) return DISABLED_CLIP;
                return Number.isInteger(patternIndex) && patternIndex >= 0 && patternIndex < MAX_PATTERNS ? patternIndex : null;
            });
            while (state.clips[channel.id].length < state.barCount) state.clips[channel.id].push(null);
        });
        Object.keys(state.clips).forEach(id => {
            if (!state.channels.some(channel => channel.id === id)) delete state.clips[id];
        });
    }

    renderPatternOptions();
    ensureClipMap();

    function selectedChannel() {
        return state.channels.find(channel => channel.id === selectedId) || state.channels[0];
    }

    function resizeAutomationValues(values, length = stepCount()) {
        const resized = Array.isArray(values) ? values.slice(0, length) : [];
        while (resized.length < length) resized.push(null);
        return resized.map(value => value === '' || value === undefined ? null : value);
    }

    function normalizeAutomationPatternIndex(value) {
        const number = Number(value);
        return Number.isInteger(number) && number >= 0 && number < MAX_PATTERNS ? number : 0;
    }

    function automationPatternValues(lane) {
        if (!lane.valuesByPattern || typeof lane.valuesByPattern !== 'object' || Array.isArray(lane.valuesByPattern)) {
            lane.valuesByPattern = {};
        }
        if (Array.isArray(lane.values)) {
            const legacyPattern = normalizeAutomationPatternIndex(lane.patternIndex);
            if (!Array.isArray(lane.valuesByPattern[legacyPattern])) {
                lane.valuesByPattern[legacyPattern] = lane.values;
            }
            delete lane.values;
        }
        Object.keys(lane.valuesByPattern).forEach(key => {
            const normalizedKey = String(normalizeAutomationPatternIndex(key));
            const values = resizeAutomationValues(lane.valuesByPattern[key]);
            if (normalizedKey !== key) delete lane.valuesByPattern[key];
            lane.valuesByPattern[normalizedKey] = values;
        });
        return lane.valuesByPattern;
    }

    function automationValuesForPattern(lane, patternIndex, create = false) {
        const valuesByPattern = automationPatternValues(lane);
        const key = String(normalizeAutomationPatternIndex(patternIndex));
        if (!Array.isArray(valuesByPattern[key])) {
            if (!create) return resizeAutomationValues([]);
            valuesByPattern[key] = resizeAutomationValues([]);
        }
        valuesByPattern[key] = resizeAutomationValues(valuesByPattern[key]);
        return valuesByPattern[key];
    }

    function setAutomationValuesForPattern(lane, patternIndex, values) {
        const valuesByPattern = automationPatternValues(lane);
        valuesByPattern[String(normalizeAutomationPatternIndex(patternIndex))] = resizeAutomationValues(values);
    }

    function ensureChannelAutomation(channel) {
        if (!Array.isArray(channel.automation)) channel.automation = [];
        channel.automation = channel.automation.slice(0, MAX_AUTOMATION_LANES).map(lane => {
            const normalized = lane && typeof lane === 'object' ? lane : {};
            normalized.id = normalized.id || ('automation-' + Date.now() + '-' + Math.random().toString(16).slice(2));
            normalized.targetType = normalized.targetType || 'synth';
            normalized.effectId = normalized.effectId || '';
            normalized.paramId = normalized.paramId || '';
            normalized.enabled = normalized.enabled !== false;
            normalized.collapsed = normalized.collapsed === true;
            normalized.mode = normalized.mode === 'smooth' ? 'smooth' : 'step';
            if (Array.isArray(normalized.values) && normalized.patternIndex === undefined) {
                normalized.patternIndex = channel.activePattern || 0;
            }
            automationPatternValues(normalized);
            delete normalized.patternIndex;
            return normalized;
        });
    }

    function automationTargets(channel = selectedChannel()) {
        const targets = [
            {
                id: 'channel:volume',
                targetType: 'channel',
                paramId: 'volume',
                label: 'channel / volume',
                param: { id: 'volume', label: 'volume', min: 0, max: 1, step: 0.01, default: channel.volume ?? 0.5 }
            },
            {
                id: 'channel:pan',
                targetType: 'channel',
                paramId: 'pan',
                label: 'channel / pan',
                param: { id: 'pan', label: 'pan', min: -1, max: 1, step: 0.01, default: channel.pan ?? 0 }
            }
        ];

        if (channel.source === 'synth') {
            const definition = synthDefinitionForChannel(channel);
            if (definition) {
                ensureChannelSynth(channel);
                (definition.params || []).forEach(param => {
                    if (param.type === 'select') return;
                    targets.push({
                        id: 'synth:' + param.id,
                        targetType: 'synth',
                        paramId: param.id,
                        label: 'synth / ' + (param.label || param.id),
                        definition,
                        param
                    });
                });
            }
        }

        ensureChannelEffects(channel);
        channel.effects.forEach(effect => {
            const definition = effectDefinitions.get(effect.type);
            if (!definition) return;
            syncEffectSettings(definition, effect);
            (definition.params || []).forEach(param => {
                if (param.type === 'select') return;
                targets.push({
                    id: 'effect:' + effect.id + ':' + param.id,
                    targetType: 'effect',
                    effectId: effect.id,
                    paramId: param.id,
                    label: (definition.name || effect.type) + ' / ' + (param.label || param.id),
                    definition,
                    effect,
                    param
                });
            });
        });

        return targets;
    }

    function automationTargetForLane(channel, lane) {
        return automationTargets(channel).find(target => {
            if (target.targetType !== lane.targetType || target.paramId !== lane.paramId) return false;
            return target.targetType !== 'effect' || target.effectId === lane.effectId;
        }) || null;
    }

    function clampAutomationValue(param, value) {
        if (value === null || value === undefined || value === '') return null;
        if (param.type === 'select') {
            return param.options && param.options.includes(value) ? value : null;
        }
        const number = Number(value);
        if (!Number.isFinite(number)) return null;
        return Math.max(param.min ?? number, Math.min(param.max ?? number, number));
    }

    function automationValueAtStep(lane, param, step, patternIndex) {
        const values = automationValuesForPattern(lane, patternIndex, false);
        const direct = clampAutomationValue(param, values[step]);
        if (direct !== null || param.type === 'select' || lane.mode !== 'smooth') return direct;
        let previousIndex = -1;
        let previousValue = null;
        for (let index = step - 1; index >= 0; index -= 1) {
            const value = clampAutomationValue(param, values[index]);
            if (value !== null) {
                previousIndex = index;
                previousValue = value;
                break;
            }
        }
        let nextIndex = -1;
        let nextValue = null;
        for (let index = step + 1; index < values.length; index += 1) {
            const value = clampAutomationValue(param, values[index]);
            if (value !== null) {
                nextIndex = index;
                nextValue = value;
                break;
            }
        }
        if (previousValue === null && nextValue === null) return null;
        if (previousValue === null) return nextValue;
        if (nextValue === null) return previousValue;
        const ratio = (step - previousIndex) / Math.max(1, nextIndex - previousIndex);
        return previousValue + ((nextValue - previousValue) * ratio);
    }

    function setAutomationTargetValue(channel, target, value) {
        const clamped = clampAutomationValue(target.param, value);
        if (clamped === null) return false;
        if (target.targetType === 'channel') {
            channel[target.paramId] = clamped;
            return false;
        }
        if (target.targetType === 'synth' && target.definition) {
            setSynthParamById(channel, target.definition, target.paramId, clamped);
            return false;
        }
        if (target.targetType === 'effect' && target.definition && target.effect) {
            const before = target.effect.settings[target.paramId];
            target.effect.settings[target.paramId] = clamped;
            syncEffectSettings(target.definition, target.effect);
            return target.effect.settings[target.paramId] !== before;
        }
        return false;
    }

    function applyAutomationStep(step, bar = currentBar) {
        const needsRebuild = new Set();
        const channelPatterns = currentView === 'roll'
            ? [{ channel: selectedChannel(), patternIndex: selectedChannel().activePattern || 0 }]
            : audibleChannels().map(channel => ({
                channel,
                patternIndex: state.clips[channel.id] ? state.clips[channel.id][bar] : null
            })).filter(item => item.patternIndex !== null && item.patternIndex !== DISABLED_CLIP);

        channelPatterns.forEach(({ channel, patternIndex }) => {
            ensureChannelAutomation(channel);
            channel.automation.forEach(lane => {
                if (!lane.enabled) return;
                const target = automationTargetForLane(channel, lane);
                if (!target) return;
                const value = automationValueAtStep(lane, target.param, step, patternIndex);
                if (value === null) return;
                const changedEffect = setAutomationTargetValue(channel, target, value);
                if (changedEffect) needsRebuild.add(channel);
            });
        });
        needsRebuild.forEach(channel => rebuildChannelOutput(channel, true));
        if (currentView === 'automation' && bar === currentBar) renderAutomation(false);
    }

    function ensureChannelEffects(channel) {
        if (!Array.isArray(channel.effects)) channel.effects = [];
        channel.effects = channel.effects.map(effect => {
            const normalized = effect && typeof effect === 'object' ? effect : {};
            normalized.id = normalized.id || ('effect-' + Date.now() + '-' + Math.random().toString(16).slice(2));
            normalized.type = normalized.type || 'distortion';
            normalized.enabled = normalized.enabled !== false;
            normalized.collapsed = normalized.collapsed !== false;
            normalized.settings = normalized.settings && typeof normalized.settings === 'object' ? normalized.settings : {};
            return normalized;
        });
    }

    function normalizeEffectSettings(definition, settings = {}) {
        const normalized = {};
        (definition.params || []).forEach(param => {
            const raw = settings[param.id];
            const fallback = param.default !== undefined ? param.default : param.min || 0;
            const value = Number.isFinite(Number(raw)) ? Number(raw) : fallback;
            if (param.type === 'select') {
                normalized[param.id] = param.options && param.options.includes(raw) ? raw : fallback;
            } else {
                normalized[param.id] = Math.max(param.min ?? value, Math.min(param.max ?? value, value));
            }
        });
        return normalized;
    }

    function normalizeParamSettings(definition, settings = {}) {
        const normalized = {};
        (definition.params || []).forEach(param => {
            const raw = settings[param.id];
            const fallback = param.default !== undefined ? param.default : param.min || 0;
            if (param.type === 'select') {
                normalized[param.id] = param.options && param.options.includes(raw) ? raw : fallback;
            } else {
                const value = Number.isFinite(Number(raw)) ? Number(raw) : Number(fallback) || 0;
                normalized[param.id] = Math.max(param.min ?? value, Math.min(param.max ?? value, value));
            }
        });
        return normalized;
    }

    function synthDefinitionForChannel(channel) {
        const selected = channel && channel.synthType ? channel.synthType : 'analog-mono';
        if (synthDefinitions.has(selected)) return synthDefinitions.get(selected);
        return channel && channel.synthType ? null : (synthDefinitions.values().next().value || null);
    }

    function ensureChannelSynth(channel) {
        if (!channel.synthType) channel.synthType = 'analog-mono';
        if (!channel.synthSettings || typeof channel.synthSettings !== 'object') channel.synthSettings = {};
        const definition = synthDefinitionForChannel(channel);
        if (!definition) return channel.synthSettings;
        if (!channel.synthType) channel.synthType = definition.id;
        const normalized = normalizeParamSettings(definition, channel.synthSettings);
        Object.keys(channel.synthSettings).forEach(key => {
            if (!Object.prototype.hasOwnProperty.call(normalized, key)) delete channel.synthSettings[key];
        });
        Object.assign(channel.synthSettings, normalized);
        return channel.synthSettings;
    }

    function setSynthParam(channel, definition, param, value) {
        ensureChannelSynth(channel);
        channel.synthSettings[param.id] = param.type === 'select' ? value : Number(value);
        ensureChannelSynth(channel);
        if (param.type === 'select') renderSynthEditor();
    }

    function setSynthParamById(channel, definition, paramId, value) {
        const param = (definition.params || []).find(item => item.id === paramId);
        if (!param) return;
        setSynthParam(channel, definition, param, value);
    }

    function migrateWaveChannel(channel) {
        if (!channel || channel.source !== 'wave') return channel;
        channel.source = 'synth';
        channel.synthType = 'wave-oscillator';
        channel.synthSettings = {
            wave: channel.wave || 'sawtooth',
            unison: Math.max(1, Math.min(16, Math.round(Number(channel.waveUnison) || 1))),
            detune: Math.max(0, Math.min(1, Number(channel.waveDetune) || 0)),
            attack: Math.max(0.001, Number(channel.attack) || 0.006),
            release: Math.max(0.01, Number(channel.release) || 0.11)
        };
        return channel;
    }

    function syncEffectSettings(definition, effect) {
        if (!effect.settings || typeof effect.settings !== 'object') effect.settings = {};
        const normalized = normalizeEffectSettings(definition, effect.settings);
        Object.keys(effect.settings).forEach(key => {
            if (!Object.prototype.hasOwnProperty.call(normalized, key)) delete effect.settings[key];
        });
        Object.assign(effect.settings, normalized);
        return effect.settings;
    }

    function setEffectParam(channel, effect, definition, param, value) {
        ensureChannelEffects(channel);
        const target = channel.effects.find(item => item.id === effect.id) || effect;
        syncEffectSettings(definition, target);
        target.settings[param.id] = param.type === 'select' ? value : Number(value);
        syncEffectSettings(definition, target);
        effect.settings = target.settings;
        rebuildChannelOutput(channel);
    }

    function setEffectParamById(channel, effect, definition, paramId, value) {
        const param = (definition.params || []).find(item => item.id === paramId);
        if (!param) return;
        setEffectParam(channel, effect, definition, param, value);
    }

    function effectRuntimeSettings(definition, settings) {
        const runtime = { ...settings };
        if (definition.id === 'delay') {
            const divisions = { '1/16': 1, '1/8': 2, '1/4': 4, '1/2': 8, '1 bar': 16 };
            const steps = divisions[runtime.division] || Math.max(1, Math.min(16, Math.round(Number(runtime.time) || 4)));
            runtime.timeSeconds = stepSeconds() * steps;
        }
        return runtime;
    }

    function enabledEffectSettings(channel, type) {
        ensureChannelEffects(channel);
        return channel.effects
            .filter(effect => effect.enabled && effect.type === type && effectDefinitions.has(effect.type))
            .map(effect => {
                const definition = effectDefinitions.get(effect.type);
                syncEffectSettings(definition, effect);
                return effect.settings;
            });
    }

    function channelPitchRatio(channel) {
        const semitones = enabledEffectSettings(channel, 'pitch-shift').reduce((total, settings) => {
            return total + (Number(settings.semitones) || 0) + ((Number(settings.cents) || 0) / 100);
        }, 0);
        return Math.max(0.0625, Math.min(16, Math.pow(2, semitones / 12)));
    }

    function nearestProjectTempo(sampleBpm) {
        const projectBpm = Math.max(1, Number(state.bpm) || 128);
        return [projectBpm / 2, projectBpm, projectBpm * 2]
            .reduce((best, tempo) => Math.abs(tempo - sampleBpm) < Math.abs(best - sampleBpm) ? tempo : best, projectBpm);
    }

    function sampleSpeedRatio(channel) {
        if (!channel || channel.source !== 'sample') return 1;
        return enabledEffectSettings(channel, 'sample-speed').reduce((ratio, settings) => {
            const speed = Math.max(0.125, Math.min(8, Number(settings.speed) || 1));
            const sampleBpm = Number(settings.sampleBpm) || 0;
            const syncRatio = settings.sync === 'on' && sampleBpm > 0
                ? nearestProjectTempo(sampleBpm) / sampleBpm
                : 1;
            return ratio * speed * syncRatio;
        }, 1);
    }

    function registerEffect(definition) {
        if (!definition || !definition.id || typeof definition.create !== 'function') return;
        effectDefinitions.set(definition.id, {
            params: [],
            ...definition,
            name: definition.name || definition.id
        });
        if (definition.css && !document.getElementById('fb-effect-style-' + definition.id)) {
            const style = document.createElement('style');
            style.id = 'fb-effect-style-' + definition.id;
            style.textContent = definition.css;
            document.head.append(style);
        }
        renderEffectPicker();
    }

    window.frdgBeatsEffects = window.frdgBeatsEffects || {};
    window.frdgBeatsEffects.register = registerEffect;

    function registerSynth(definition) {
        if (!definition || !definition.id || typeof definition.createVoice !== 'function') return;
        synthDefinitions.set(definition.id, {
            params: [],
            ...definition,
            name: definition.name || definition.id
        });
        if (definition.css && !document.getElementById('fb-synth-style-' + definition.id)) {
            const style = document.createElement('style');
            style.id = 'fb-synth-style-' + definition.id;
            style.textContent = definition.css;
            document.head.append(style);
        }
        state.channels.forEach(channel => {
            if (channel.source === 'synth') ensureChannelSynth(channel);
        });
        renderChannels();
        renderSynthEditor();
    }

    window.frdgBeatsSynths = window.frdgBeatsSynths || {};
    window.frdgBeatsSynths.register = registerSynth;

    function disconnectNode(node) {
        if (!node || typeof node.disconnect !== 'function') return;
        if (typeof node.stop === 'function') {
            try {
                node.stop();
            } catch (_) {
                /* no-op */
            }
        }
        try {
            node.disconnect();
        } catch (_) {
            /* no-op */
        }
    }

    function outputNodeForChannel(channel) {
        const engine = createAudio();
        const cached = channelOutputs.get(channel.id);
        if (cached) return cached.input;
        return rebuildChannelOutput(channel);
    }

    function rebuildChannelOutput(channel, preserveOld = false) {
        const engine = createAudio();
        const old = channelOutputs.get(channel.id);
        if (old && preserveOld) {
            retiredChannelOutputs.add(old);
            window.setTimeout(() => {
                old.nodes.forEach(disconnectNode);
                retiredChannelOutputs.delete(old);
            }, 8000);
        } else if (old) {
            old.nodes.forEach(disconnectNode);
        }
        ensureChannelEffects(channel);

        const input = engine.context.createGain();
        let current = input;
        const nodes = [input];
        channel.effects.forEach(effect => {
            if (!effect.enabled) return;
            const definition = effectDefinitions.get(effect.type);
            if (!definition) return;
            syncEffectSettings(definition, effect);
            try {
                const chain = definition.create(engine.context, effectRuntimeSettings(definition, effect.settings));
                if (!chain || !chain.input || !chain.output) return;
                current.connect(chain.input);
                current = chain.output;
                nodes.push(chain.input);
                if (chain.output !== chain.input) nodes.push(chain.output);
                if (Array.isArray(chain.nodes)) nodes.push(...chain.nodes);
            } catch (_) {
                updateStatus('effect failed: ' + definition.name);
            }
        });
        current.connect(engine.master);
        channelOutputs.set(channel.id, { input, nodes });
        return input;
    }

    function rebuildAllChannelOutputs() {
        state.channels.forEach(channel => {
            if (channelOutputs.has(channel.id)) rebuildChannelOutput(channel);
        });
    }

    function panicStopSounds() {
        stopRollPreviewVoice();
        placingNote = null;
        movingNote = null;
        stopKeyboardNotes();
        activeSamplePlayheads.length = 0;
        channelOutputs.forEach(output => output.nodes.forEach(disconnectNode));
        channelOutputs.clear();
        retiredChannelOutputs.forEach(output => output.nodes.forEach(disconnectNode));
        retiredChannelOutputs.clear();
        syncUtilityMeters();
        drawWaveform(true);
        if (currentView === 'waveform') drawSampleEditor();
    }

    function renderEffectPicker() {
        if (!els.effectPicker) return;
        const selected = els.effectPicker.value;
        els.effectPicker.innerHTML = '';
        const definitions = Array.from(effectDefinitions.values()).sort((a, b) => a.name.localeCompare(b.name));
        if (!definitions.length) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'loading effects';
            els.effectPicker.append(option);
            els.effectPicker.disabled = true;
            if (els.addEffect) els.addEffect.disabled = true;
            return;
        }
        definitions.forEach(definition => {
            const option = document.createElement('option');
            option.value = definition.id;
            option.textContent = definition.name;
            els.effectPicker.append(option);
        });
        els.effectPicker.disabled = false;
        if (els.addEffect) els.addEffect.disabled = false;
        els.effectPicker.value = effectDefinitions.has(selected) ? selected : definitions[0].id;
    }

    function createAudio() {
        if (audio) return audio;
        const context = new (window.AudioContext || window.webkitAudioContext)();
        const master = context.createGain();
        const analyser = context.createAnalyser();
        analyser.fftSize = 128;
        master.gain.value = state.masterVolume;
        master.connect(analyser);
        analyser.connect(context.destination);
        audio = {
            context,
            master,
            analyser,
            meterData: new Uint8Array(analyser.frequencyBinCount),
            waveData: new Uint8Array(analyser.fftSize),
            waveformContext: els.waveform ? els.waveform.getContext('2d') : null
        };
        makeSyntheticKick(state.channels[0]);
        return audio;
    }

    function makeSyntheticKick(channel) {
        const engine = audio || createAudio();
        const sampleRate = engine.context.sampleRate;
        const length = Math.floor(sampleRate * 0.38);
        const buffer = engine.context.createBuffer(1, length, sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i += 1) {
            const t = i / sampleRate;
            const envelope = Math.exp(-t * 10.5);
            const pitch = 76 * Math.exp(-t * 21) + 38;
            data[i] = Math.sin(2 * Math.PI * pitch * t) * envelope;
        }
        channel.sampleBuffer = buffer;
    }

    function updateStatus(text) {
        els.status.textContent = text;
    }

    function nextFrame() {
        return new Promise(resolve => {
            window.requestAnimationFrame(() => window.requestAnimationFrame(resolve));
        });
    }

    function wait(ms) {
        return new Promise(resolve => window.setTimeout(resolve, ms));
    }

    function syncUtilityMeters() {
        if (!audio || !isPlaying) {
            els.meterL.style.height = '4%';
            els.meterR.style.height = Math.max(4, levelDecay * 100) + '%';
            return;
        }
        const lookahead = nextStepTime - audio.context.currentTime;
        const lag = lookahead < 0 ? 1 : Math.max(0, 1 - (lookahead / 0.12));
        els.meterL.style.height = Math.max(4, Math.min(100, lag * 100)) + '%';
        audio.analyser.getByteFrequencyData(audio.meterData);
        const avg = audio.meterData.reduce((sum, value) => sum + value, 0) / Math.max(1, audio.meterData.length);
        const level = Math.max(0.04, Math.min(1, avg / 160));
        levelDecay = Math.max(level, levelDecay * 0.9);
        els.meterR.style.height = Math.max(4, levelDecay * 100) + '%';
    }

    function showExportProgress(title, detail = '') {
        const overlay = document.createElement('div');
        overlay.className = 'fb-export-overlay';
        overlay.setAttribute('role', 'status');
        overlay.setAttribute('aria-live', 'polite');
        overlay.innerHTML = '<div class="fb-export-dialog"><div class="fb-export-title"></div><div class="fb-export-detail-row"><div class="fb-export-detail"></div><div class="fb-export-percent">0%</div></div></div>';
        const titleEl = overlay.querySelector('.fb-export-title');
        const detailEl = overlay.querySelector('.fb-export-detail');
        const percentEl = overlay.querySelector('.fb-export-percent');
        titleEl.textContent = title;
        detailEl.textContent = detail;
        document.body.append(overlay);
        return {
            set(progress, text = detailEl.textContent) {
                const value = Math.max(0, Math.min(100, Number(progress) || 0));
                percentEl.textContent = Math.round(value) + '%';
                detailEl.textContent = text;
            },
            close() {
                overlay.classList.add('is-closing');
                window.setTimeout(() => overlay.remove(), 160);
            }
        };
    }

    function showConfirmDialog(title, detail, confirmText = 'confirm', cancelText = 'cancel') {
        closeMenus();
        closeVelocityEditor();
        return new Promise(resolve => {
            const overlay = document.createElement('div');
            overlay.className = 'fb-export-overlay fb-confirm-overlay';
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-modal', 'true');
            overlay.innerHTML = '<div class="fb-export-dialog fb-confirm-dialog"><div class="fb-export-title"></div><div class="fb-confirm-detail"></div><div class="fb-confirm-actions"><button class="fb-button fb-confirm-cancel" type="button"></button><button class="fb-button fb-confirm-ok" type="button"></button></div></div>';
            const titleEl = overlay.querySelector('.fb-export-title');
            const detailEl = overlay.querySelector('.fb-confirm-detail');
            const cancel = overlay.querySelector('.fb-confirm-cancel');
            const ok = overlay.querySelector('.fb-confirm-ok');
            titleEl.textContent = title;
            detailEl.textContent = detail;
            cancel.textContent = cancelText;
            ok.textContent = confirmText;
            const close = (value) => {
                document.removeEventListener('keydown', onKeydown);
                overlay.classList.add('is-closing');
                window.setTimeout(() => overlay.remove(), 160);
                resolve(value);
            };
            const onKeydown = (event) => {
                if (event.key === 'Escape') close(false);
                if (event.key === 'Enter') close(true);
            };
            cancel.addEventListener('click', () => close(false));
            ok.addEventListener('click', () => close(true));
            overlay.addEventListener('click', event => {
                if (event.target === overlay) close(false);
            });
            document.addEventListener('keydown', onKeydown);
            document.body.append(overlay);
            ok.focus();
        });
    }

    async function setExportProgress(progress, value, text, delay = 80) {
        progress.set(value, text);
        await nextFrame();
        if (delay > 0) await wait(delay);
    }

    function stepSeconds() {
        return (60 / state.bpm) / 4;
    }

    function snapNoteLength(value) {
        const raw = Number(value);
        const snapped = Math.round((Number.isFinite(raw) ? raw : 1) / noteLengthSnap) * noteLengthSnap;
        return Math.max(noteLengthSnap, snapped);
    }

    function noteLengthSteps(event) {
        const raw = Number(event && event.length);
        return Math.max(0.001, Number.isFinite(raw) ? raw : 1);
    }

    function clampedNoteLength(event, step) {
        return Math.max(0.001, Math.min(stepCount() - step, noteLengthSteps(event)));
    }

    function noteDurationSeconds(event, step = null) {
        const length = step === null ? noteLengthSteps(event) : clampedNoteLength(event, step);
        return stepSeconds() * length;
    }

    function noteFrequency(note) {
        const parsed = /^([A-G]#?)([0-9])$/.exec(note || 'C4');
        if (!parsed) return 261.63;
        const index = CHROMATIC.indexOf(parsed[1]);
        const semitones = index + ((Number(parsed[2]) - 4) * 12);
        return 261.63 * Math.pow(2, semitones / 12);
    }

    function octavePage(value) {
        const raw = Number(value);
        if (raw >= 1 && raw <= 3) return Math.round(raw);
        if (raw >= 4 && raw <= 6) return Math.max(1, Math.min(3, Math.ceil((raw - 2) / 2)));
        return 2;
    }

    function octavePageBase(value) {
        return ((octavePage(value) - 1) * 2) + 1;
    }

    function waveUnison(channel) {
        return Math.max(1, Math.min(16, Math.round(Number(channel.waveUnison) || 1)));
    }

    function waveDetune(channel) {
        return Math.max(0, Math.min(1, Number(channel.waveDetune) || 0));
    }

    function unisonVoiceSettings(channel) {
        const voices = waveUnison(channel);
        const detune = waveDetune(channel);
        const maxCents = 64;
        const panSpread = voices > 1 ? 0.45 : 0;
        return Array.from({ length: voices }, (_, index) => {
            const position = voices === 1 ? 0 : (index / (voices - 1)) * 2 - 1;
            return {
                cents: position * detune * maxCents,
                pan: Math.max(-1, Math.min(1, channel.pan + (position * panSpread))),
                gain: Math.max(0.001, channel.volume) / Math.sqrt(voices)
            };
        });
    }

    function playWave(channel, note, time, duration, velocity = 1, slideTo = null) {
        const noteGain = velocityGain(velocity);
        if (noteGain <= 0) return;
        const engine = createAudio();
        const attack = Math.max(0.002, channel.attack);
        const release = Math.max(0.02, channel.release);
        const end = time + duration;
        const releaseEnd = end + release;
        const pitchRatio = channelPitchRatio(channel);
        const frequency = noteFrequency(note) * pitchRatio;
        const targetFrequency = slideTo && slideTo !== note ? noteFrequency(slideTo) * pitchRatio : null;

        unisonVoiceSettings({ ...channel, volume: channel.volume * noteGain }).forEach(voice => {
            const osc = engine.context.createOscillator();
            const gain = engine.context.createGain();
            const pan = engine.context.createStereoPanner();
            osc.type = channel.wave;
            osc.frequency.setValueAtTime(frequency, time);
            if (targetFrequency) {
                osc.frequency.exponentialRampToValueAtTime(Math.max(1, targetFrequency), Math.max(time + 0.01, end));
            }
            osc.detune.setValueAtTime(voice.cents, time);
            gain.gain.setValueAtTime(0.0001, time);
            gain.gain.exponentialRampToValueAtTime(Math.max(0.001, voice.gain), time + attack);
            gain.gain.setValueAtTime(Math.max(0.001, voice.gain), Math.max(time + attack, end));
            gain.gain.exponentialRampToValueAtTime(0.0001, releaseEnd);
            pan.pan.value = voice.pan;
            osc.connect(gain);
            gain.connect(pan);
            pan.connect(outputNodeForChannel(channel));
            osc.start(time);
            osc.stop(releaseEnd + 0.02);
        });
    }

    function startWaveVoice(channel, note) {
        const engine = createAudio();
        const time = engine.context.currentTime;
        const attack = Math.max(0.002, channel.attack);
        const frequency = noteFrequency(note) * channelPitchRatio(channel);
        const voices = unisonVoiceSettings(channel).map(voice => {
            const osc = engine.context.createOscillator();
            const gain = engine.context.createGain();
            const pan = engine.context.createStereoPanner();
            osc.type = channel.wave;
            osc.frequency.setValueAtTime(frequency, time);
            osc.detune.setValueAtTime(voice.cents, time);
            gain.gain.setValueAtTime(0.0001, time);
            gain.gain.exponentialRampToValueAtTime(Math.max(0.001, voice.gain), time + attack);
            pan.pan.value = voice.pan;
            osc.connect(gain);
            gain.connect(pan);
            pan.connect(outputNodeForChannel(channel));
            osc.start(time);
            return { osc, gain };
        });
        let stopped = false;

        return {
            stop() {
                if (stopped) return;
                stopped = true;
                const releaseStart = engine.context.currentTime;
                const release = Math.max(0.02, channel.release);
                voices.forEach(({ osc, gain }) => {
                    gain.gain.cancelScheduledValues(releaseStart);
                    gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), releaseStart);
                    gain.gain.exponentialRampToValueAtTime(0.0001, releaseStart + release);
                    osc.stop(releaseStart + release + 0.02);
                });
            }
        };
    }

    function synthVoiceApi(channel, note, time, duration, velocity = 1, slideTo = null) {
        const definition = synthDefinitionForChannel(channel);
        if (!definition) return null;
        const settings = ensureChannelSynth(channel);
        return {
            channel,
            note,
            frequency: noteFrequency(note) * channelPitchRatio(channel),
            targetFrequency: slideTo && slideTo !== note ? noteFrequency(slideTo) * channelPitchRatio(channel) : null,
            time,
            duration,
            velocity: velocityGain(velocity),
            slideTo,
            settings,
            output: outputNodeForChannel(channel),
            stepSeconds,
            noteFrequency
        };
    }

    function playSynth(channel, note, time, duration, velocity = 1, slideTo = null) {
        const noteGain = velocityGain(velocity);
        if (noteGain <= 0) return;
        const engine = createAudio();
        const definition = synthDefinitionForChannel(channel);
        if (!definition) {
            playWave(channel, note, time, duration, velocity, slideTo);
            return;
        }
        try {
            const voice = definition.createVoice(engine.context, synthVoiceApi(channel, note, time, duration, velocity, slideTo));
            if (voice && Array.isArray(voice.nodes) && duration) {
                const waitSeconds = Math.max(0, time - engine.context.currentTime) + duration + Math.max(0.08, channel.release || 0.1) + 0.08;
                window.setTimeout(() => voice.nodes.forEach(disconnectNode), Math.max(80, waitSeconds * 1000));
            }
        } catch (_) {
            updateStatus('synth failed: ' + definition.name);
            playWave(channel, note, time, duration, velocity, slideTo);
        }
    }

    function startSynthVoice(channel, note) {
        const engine = createAudio();
        const definition = synthDefinitionForChannel(channel);
        if (!definition) return startWaveVoice(channel, note);
        try {
            const voice = definition.createVoice(engine.context, synthVoiceApi(channel, note, engine.context.currentTime, null, 1, null));
            if (voice && typeof voice.stop === 'function') return voice;
        } catch (_) {
            updateStatus('synth failed: ' + definition.name);
        }
        return startWaveVoice(channel, note);
    }

    function sampleType(channel) {
        return ['one-shot', 'loop', 'reverse'].includes(channel.sampleType)
            ? channel.sampleType
            : 'one-shot';
    }

    function sampleRateForNote(channel, note) {
        return Math.max(0.25, Math.min(4, noteFrequency(note) / noteFrequency('C4')));
    }

    function sampleKeepsDuration(channel) {
        return !channel || channel.sampleKeepDuration !== false;
    }

    function samplePitchCacheFor(buffer) {
        if (!samplePitchCache.has(buffer)) samplePitchCache.set(buffer, new Map());
        return samplePitchCache.get(buffer);
    }

    function samplePitchPendingCacheFor(buffer) {
        if (!samplePitchPendingCache.has(buffer)) samplePitchPendingCache.set(buffer, new Map());
        return samplePitchPendingCache.get(buffer);
    }

    function samplePitchCacheKey(context, start, end, rate) {
        return [
            context.sampleRate,
            context.destination && context.destination.channelCount ? context.destination.channelCount : 2,
            'rubberband',
            Math.round(start * 10000),
            Math.round(end * 10000),
            Math.round(rate * 1000)
        ].join(':');
    }

    function createRubberBandWorker() {
        if (rubberBandUnavailable || typeof Worker === 'undefined') return null;
        if (rubberBandWorker) return rubberBandWorker;
        try {
            rubberBandWorker = new Worker(RUBBERBAND_WORKER_URL);
            rubberBandWorker.addEventListener('message', event => {
                const data = event.data || {};
                if (!data.id || !rubberBandJobs.has(data.id)) return;
                const job = rubberBandJobs.get(data.id);
                rubberBandJobs.delete(data.id);
                if (data.type === 'pitch-shift-result') {
                    job.resolve(data);
                } else {
                    job.reject(new Error(data.message || 'Rubber Band pitch shift failed'));
                }
            });
            rubberBandWorker.addEventListener('error', event => {
                rubberBandUnavailable = true;
                rubberBandJobs.forEach(job => job.reject(event.error || new Error('Rubber Band worker failed')));
                rubberBandJobs.clear();
                rubberBandWorker = null;
            });
        } catch (_) {
            rubberBandUnavailable = true;
            return null;
        }
        return rubberBandWorker;
    }

    function requestRubberBandPitchShift(context, source, startSeconds, endSeconds, rate, cache, key) {
        if (rubberBandUnavailable || Math.abs(rate - 1) < 0.001) return null;
        const pending = samplePitchPendingCacheFor(source);
        if (pending.has(key)) return pending.get(key);
        const worker = createRubberBandWorker();
        if (!worker) return null;

        const startFrame = Math.max(0, Math.min(source.length - 1, Math.floor(startSeconds * source.sampleRate)));
        const endFrame = Math.max(startFrame + 1, Math.min(source.length, Math.ceil(endSeconds * source.sampleRate)));
        const channelBuffers = [];
        const transfer = [];
        for (let channelIndex = 0; channelIndex < source.numberOfChannels; channelIndex += 1) {
            const segment = source.getChannelData(channelIndex).slice(startFrame, endFrame);
            channelBuffers.push(segment.buffer);
            transfer.push(segment.buffer);
        }

        const id = rubberBandJobId;
        rubberBandJobId += 1;
        const promise = new Promise((resolve, reject) => {
            rubberBandJobs.set(id, { resolve, reject });
            worker.postMessage({
                id,
                type: 'pitch-shift',
                sampleRate: source.sampleRate,
                targetSampleRate: context.sampleRate,
                pitchScale: rate,
                channels: channelBuffers
            }, transfer);
        }).then(result => {
            if (!result || result.fallback || !Array.isArray(result.channels) || !result.channels.length) return null;
            const length = Math.max(1, new Float32Array(result.channels[0]).length);
            const output = context.createBuffer(result.channels.length, length, result.sampleRate || source.sampleRate);
            result.channels.forEach((buffer, channelIndex) => {
                output.getChannelData(channelIndex).set(new Float32Array(buffer).subarray(0, length));
            });
            cache.set(key, output);
            if (cache.size > 72) cache.delete(cache.keys().next().value);
            updateStatus('high quality sample pitch ready');
            return output;
        }).catch(() => {
            rubberBandUnavailable = true;
            updateStatus('Rubber Band unavailable; using classic sample pitch');
            return null;
        }).finally(() => {
            pending.delete(key);
        });
        pending.set(key, promise);
        return promise;
    }

    function sampleValueAt(data, frame, minFrame, maxFrame) {
        const index = Math.max(minFrame, Math.min(maxFrame, Math.floor(frame)));
        const next = Math.max(minFrame, Math.min(maxFrame, index + 1));
        const frac = frame - index;
        return (data[index] * (1 - frac)) + (data[next] * frac);
    }

    function wrapFrame(frame, startFrame, endFrame) {
        const span = Math.max(1, endFrame - startFrame);
        return startFrame + ((((frame - startFrame) % span) + span) % span);
    }

    function stableNoise(index, seed) {
        const value = Math.sin((index + 1) * 12.9898 + seed * 78.233) * 43758.5453;
        return (value - Math.floor(value)) * 2 - 1;
    }

    function pitchShiftedSegment(context, source, startSeconds, endSeconds, rate) {
        if (Math.abs(rate - 1) < 0.001) return null;
        const start = Math.max(0, Math.min(source.duration - 0.001, startSeconds));
        const end = Math.max(start + 0.001, Math.min(source.duration, endSeconds));
        const cache = samplePitchCacheFor(source);
        const key = samplePitchCacheKey(context, start, end, rate);
        if (cache.has(key)) return cache.get(key);
        if (!rubberBandUnavailable) {
            requestRubberBandPitchShift(context, source, start, end, rate, cache, key);
            return null;
        }

        const startFrame = Math.max(0, Math.min(source.length - 1, Math.floor(start * source.sampleRate)));
        const endFrame = Math.max(startFrame + 1, Math.min(source.length, Math.ceil(end * source.sampleRate)));
        const outputLength = Math.max(1, Math.ceil((end - start) * context.sampleRate));
        const output = context.createBuffer(source.numberOfChannels, outputLength, context.sampleRate);
        const segmentFrames = endFrame - startFrame;
        const grainSeconds = rate > 1 ? 0.09 : 0.125;
        const grain = Math.min(
            Math.max(256, Math.floor(context.sampleRate * grainSeconds)),
            Math.max(256, outputLength)
        );
        const hop = Math.max(64, Math.floor(grain / 4));
        const sourceFramesPerOutputFrame = source.sampleRate / context.sampleRate;
        const jitterFrames = Math.min(segmentFrames * 0.055, hop * sourceFramesPerOutputFrame * 0.55);
        const weights = new Float32Array(outputLength);
        const grains = [];

        for (let grainStart = -grain; grainStart < outputLength + grain; grainStart += hop) {
            const grainIndex = grains.length;
            const jitter = stableNoise(grainIndex, rate) * jitterFrames;
            const baseFrame = wrapFrame(
                startFrame + (grainStart * sourceFramesPerOutputFrame) + jitter,
                startFrame,
                endFrame
            );
            grains.push({ start: grainStart, baseFrame });
            for (let i = 0; i < grain; i += 1) {
                const outIndex = grainStart + i;
                if (outIndex < 0 || outIndex >= outputLength) continue;
                const phase = i / Math.max(1, grain - 1);
                const windowGain = 0.5 - (0.5 * Math.cos(Math.PI * 2 * phase));
                weights[outIndex] += windowGain;
            }
        }

        for (let channelIndex = 0; channelIndex < output.numberOfChannels; channelIndex += 1) {
            const input = source.getChannelData(Math.min(channelIndex, source.numberOfChannels - 1));
            const data = output.getChannelData(channelIndex);
            grains.forEach(grainInfo => {
                for (let i = 0; i < grain; i += 1) {
                    const outIndex = grainInfo.start + i;
                    if (outIndex < 0 || outIndex >= outputLength) continue;
                    const phase = i / Math.max(1, grain - 1);
                    const windowGain = 0.5 - (0.5 * Math.cos(Math.PI * 2 * phase));
                    const frame = wrapFrame(
                        grainInfo.baseFrame + (i * rate * sourceFramesPerOutputFrame),
                        startFrame,
                        endFrame
                    );
                    data[outIndex] += sampleValueAt(input, frame, startFrame, endFrame - 1) * windowGain;
                }
            });
            for (let i = 0; i < outputLength; i += 1) {
                if (weights[i] > 0.0001) data[i] /= weights[i];
            }
        }

        cache.set(key, output);
        if (cache.size > 72) cache.delete(cache.keys().next().value);
        return output;
    }

    function sampleTrimValue(value, fallback) {
        const number = Number(value);
        return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : fallback;
    }

    function ensureSampleZones(channel) {
        if (!Array.isArray(channel.sampleZones)) channel.sampleZones = [];
        channel.sampleZones = channel.sampleZones.map(zone => ({
            note: typeof zone.note === 'string' ? zone.note : 'C4',
            start: sampleTrimValue(zone.start, 0),
            end: sampleTrimValue(zone.end, 1)
        })).filter(zone => zone.end > zone.start + 0.005);
        return channel.sampleZones;
    }

    function sampleZoneForNote(channel, note) {
        return ensureSampleZones(channel).find(zone => zone.note === note) || null;
    }

    function sampleRatioBounds(channel, note = null) {
        const zone = note ? sampleZoneForNote(channel, note) : null;
        return {
            start: zone ? zone.start : sampleTrimValue(channel.sampleStart, 0),
            end: zone ? zone.end : sampleTrimValue(channel.sampleEnd, 1)
        };
    }

    function sampleBounds(channel, note = null) {
        const buffer = channel.sampleBuffer;
        const duration = buffer ? buffer.duration : 0.38;
        const zone = note ? sampleZoneForNote(channel, note) : null;
        const startRatio = zone ? zone.start : sampleTrimValue(channel.sampleStart, 0);
        const endRatio = zone ? zone.end : sampleTrimValue(channel.sampleEnd, 1);
        const start = Math.min(startRatio, Math.max(0, endRatio - 0.01)) * duration;
        const end = Math.max(endRatio, Math.min(1, startRatio + 0.01)) * duration;
        return {
            start: Math.max(0, Math.min(duration - 0.001, start)),
            end: Math.max(0.001, Math.min(duration, end))
        };
    }

    function sampleSegmentBuffer(channel, reverse = false, note = null) {
        const engine = createAudio();
        if (!channel.sampleBuffer) makeSyntheticKick(channel);
        const source = channel.sampleBuffer;
        const bounds = sampleBounds(channel, note);
        const startFrame = Math.max(0, Math.min(source.length - 1, Math.floor(bounds.start * source.sampleRate)));
        const endFrame = Math.max(startFrame + 1, Math.min(source.length, Math.ceil(bounds.end * source.sampleRate)));
        const length = endFrame - startFrame;
        const buffer = engine.context.createBuffer(source.numberOfChannels, length, source.sampleRate);
        for (let channelIndex = 0; channelIndex < source.numberOfChannels; channelIndex += 1) {
            const input = source.getChannelData(channelIndex);
            const output = buffer.getChannelData(channelIndex);
            for (let index = 0; index < length; index += 1) {
                output[index] = reverse ? input[endFrame - 1 - index] : input[startFrame + index];
            }
        }
        return buffer;
    }

    function samplePlaybackBuffer(context, channel, note, mode, playbackRate) {
        const bounds = sampleBounds(channel, note);
        if (mode === 'reverse') {
            const segment = sampleSegmentBuffer(channel, true, note);
            const shifted = pitchShiftedSegment(context, segment, 0, segment.duration, playbackRate);
            return {
                buffer: shifted || segment,
                offset: 0,
                duration: segment.duration,
                loop: false,
                loopStart: 0,
                loopEnd: segment.duration,
                playbackRate: shifted ? 1 : playbackRate
            };
        }
        const shifted = pitchShiftedSegment(context, channel.sampleBuffer, bounds.start, bounds.end, playbackRate);
        return {
            buffer: shifted || channel.sampleBuffer,
            offset: shifted ? 0 : bounds.start,
            duration: Math.max(0.01, bounds.end - bounds.start),
            loop: mode === 'loop',
            loopStart: shifted ? 0 : bounds.start,
            loopEnd: shifted ? Math.max(0.001, bounds.end - bounds.start) : bounds.end,
            playbackRate: shifted ? 1 : playbackRate
        };
    }

    function sampleClassicPlayback(channel, note, mode) {
        const bounds = sampleBounds(channel, note);
        if (mode === 'reverse') {
            const segment = sampleSegmentBuffer(channel, true, note);
            return {
                buffer: segment,
                offset: 0,
                duration: segment.duration,
                loop: false,
                loopStart: 0,
                loopEnd: segment.duration
            };
        }
        return {
            buffer: channel.sampleBuffer,
            offset: bounds.start,
            duration: Math.max(0.01, bounds.end - bounds.start),
            loop: mode === 'loop',
            loopStart: bounds.start,
            loopEnd: bounds.end
        };
    }

    function warmSamplePitchCache(channel = selectedChannel()) {
        if (!channel || channel.source !== 'sample' || !channel.sampleBuffer) return;
        const baseOctave = octavePageBase(state.octave);
        const notes = [baseOctave, baseOctave + 1].flatMap(octave => CHROMATIC.map(name => name + octave));
        const mode = sampleType(channel);
        const queueKey = channel.id + ':' + mode + ':' + baseOctave + ':' + sampleTrimValue(channel.sampleStart, 0) + ':' + sampleTrimValue(channel.sampleEnd, 1) + ':' + Math.round(channelPitchRatio(channel) * 1000);
        if (samplePitchWarmQueue.has(queueKey)) return;
        samplePitchWarmQueue.add(queueKey);
        let index = 0;
        const warmNext = () => {
            const note = notes[index];
            index += 1;
            if (!note || channel.sampleBuffer === null) {
                samplePitchWarmQueue.delete(queueKey);
                return;
            }
            try {
                const rate = sampleRateForNote(channel, note) * channelPitchRatio(channel);
                if (rate !== 1) samplePlaybackBuffer(createAudio().context, channel, note, mode, rate);
            } catch (_) {
                samplePitchWarmQueue.delete(queueKey);
                return;
            }
            if (index < notes.length) {
                if (window.requestIdleCallback) window.requestIdleCallback(warmNext, { timeout: 80 });
                else window.setTimeout(warmNext, 8);
            } else {
                samplePitchWarmQueue.delete(queueKey);
            }
        };
        if (window.requestIdleCallback) window.requestIdleCallback(warmNext, { timeout: 120 });
        else window.setTimeout(warmNext, 8);
    }

    function playSample(channel, note, time, duration, velocity = 1, slideTo = null) {
        const noteGain = velocityGain(velocity);
        if (noteGain <= 0) return;
        const engine = createAudio();
        if (!channel.sampleBuffer) makeSyntheticKick(channel);
        const mode = sampleType(channel);
        const bounds = sampleBounds(channel, note, false);
        const pitchRate = sampleRateForNote(channel, note) * channelPitchRatio(channel);
        const speedRate = sampleSpeedRatio(channel);
        const segmentDuration = Math.max(0.01, (bounds.end - bounds.start) / speedRate);
        const requestedDuration = Math.max(0.03, duration || segmentDuration);
        const playDuration = mode === 'loop'
            ? requestedDuration
            : Math.min(segmentDuration, requestedDuration);

        const startSource = (when, reverse = false, stopAfter = segmentDuration) => {
            const source = engine.context.createBufferSource();
            const gain = engine.context.createGain();
            const pan = engine.context.createStereoPanner();
            const keepDuration = sampleKeepsDuration(channel);
            const playback = keepDuration
                ? samplePlaybackBuffer(engine.context, channel, note, reverse ? 'reverse' : mode, pitchRate)
                : sampleClassicPlayback(channel, note, reverse ? 'reverse' : mode);
            const effectivePlaybackRate = (keepDuration ? (playback.playbackRate || 1) : pitchRate) * speedRate;
            source.buffer = playback.buffer;
            source.playbackRate.setValueAtTime(effectivePlaybackRate, when);
            if (playback.loop || (keepDuration && stopAfter > (playback.duration / Math.max(0.001, effectivePlaybackRate)))) {
                source.loop = true;
                source.loopStart = playback.loopStart;
                source.loopEnd = playback.loopEnd;
            }
            const level = Math.max(0.0001, channel.volume * noteGain);
            const release = Math.max(0.02, channel.release);
            const releaseEnd = when + stopAfter + release;
            gain.gain.setValueAtTime(level, when);
            gain.gain.setValueAtTime(level, Math.max(when, when + stopAfter));
            gain.gain.exponentialRampToValueAtTime(0.0001, releaseEnd);
            pan.pan.value = channel.pan;
            source.connect(gain);
            gain.connect(pan);
            pan.connect(outputNodeForChannel(channel));
            source.start(when, playback.offset);
            source.stop(releaseEnd + 0.02);
            trackSamplePlayback(channel, note, mode, when, stopAfter, bounds, effectivePlaybackRate);
            return source;
        };

        if (mode === 'reverse') {
            startSource(time, true, segmentDuration);
        } else {
            startSource(time, false, playDuration);
        }
    }

    function startSampleVoice(channel, note) {
        const engine = createAudio();
        if (!channel.sampleBuffer) makeSyntheticKick(channel);
        const time = engine.context.currentTime;
        const mode = sampleType(channel);
        const bounds = sampleBounds(channel, note, false);
        const pitchRate = sampleRateForNote(channel, note) * channelPitchRatio(channel);
        const speedRate = sampleSpeedRatio(channel);
        const segmentDuration = Math.max(0.01, (bounds.end - bounds.start) / speedRate);
        const playDuration = mode === 'loop' ? 3600 : segmentDuration;
        const sources = [];
        const gains = [];
        let playheadPlaybackRate = pitchRate * speedRate;
        let stopped = false;

        const startSource = (when, reverse = false, stopAfter = segmentDuration) => {
            const source = engine.context.createBufferSource();
            const gain = engine.context.createGain();
            const pan = engine.context.createStereoPanner();
            const keepDuration = sampleKeepsDuration(channel);
            const playback = keepDuration
                ? samplePlaybackBuffer(engine.context, channel, note, reverse ? 'reverse' : mode, pitchRate)
                : sampleClassicPlayback(channel, note, reverse ? 'reverse' : mode);
            const effectivePlaybackRate = (keepDuration ? (playback.playbackRate || 1) : pitchRate) * speedRate;
            playheadPlaybackRate = effectivePlaybackRate;
            source.buffer = playback.buffer;
            source.playbackRate.setValueAtTime(effectivePlaybackRate, when);
            if (playback.loop || (keepDuration && stopAfter > (playback.duration / Math.max(0.001, effectivePlaybackRate)))) {
                source.loop = true;
                source.loopStart = playback.loopStart;
                source.loopEnd = playback.loopEnd;
            }
            gain.gain.setValueAtTime(Math.max(0.0001, channel.volume), when);
            pan.pan.value = channel.pan;
            source.connect(gain);
            gain.connect(pan);
            pan.connect(outputNodeForChannel(channel));
            source.start(when, playback.offset);
            if (mode !== 'loop') source.stop(when + stopAfter + 0.02);
            sources.push(source);
            gains.push(gain);
        };

        if (mode === 'reverse') {
            startSource(time, true, segmentDuration);
        } else {
            startSource(time, false, playDuration);
        }
        const playhead = trackSamplePlayback(channel, note, mode, time, mode === 'loop' ? null : playDuration, bounds, playheadPlaybackRate);

        return {
            stop() {
                if (stopped) return;
                stopped = true;
                const releaseStart = engine.context.currentTime;
                const release = Math.max(0.02, channel.release);
                gains.forEach(gain => {
                    gain.gain.cancelScheduledValues(releaseStart);
                    gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), releaseStart);
                    gain.gain.exponentialRampToValueAtTime(0.0001, releaseStart + release);
                });
                sources.forEach(source => {
                    try {
                        source.stop(releaseStart + release + 0.02);
                    } catch (_) {}
                });
                playhead.endTime = releaseStart + release;
            }
        };
    }

    function trackSamplePlayback(channel, note, mode, startTime, duration, bounds, playbackRate) {
        const playhead = {
            channelId: channel.id,
            note,
            mode,
            startTime,
            endTime: duration ? startTime + duration : null,
            bounds: sampleRatioBounds(channel, note),
            sampleDuration: channel.sampleBuffer ? channel.sampleBuffer.duration : 1,
            playbackRate: Math.max(0.001, playbackRate || 1)
        };
        activeSamplePlayheads.push(playhead);
        if (!meterAnimation) animateMeter();
        return playhead;
    }

    function activeSamplePlayheadFor(channel) {
        if (!audio) return null;
        const now = audio.context.currentTime;
        pruneSamplePlayheads(now);
        for (let index = activeSamplePlayheads.length - 1; index >= 0; index -= 1) {
            const item = activeSamplePlayheads[index];
            if (item.channelId === channel.id && now >= item.startTime && (!item.endTime || now <= item.endTime)) return item;
        }
        return null;
    }

    function pruneSamplePlayheads(now = audio ? audio.context.currentTime : 0) {
        for (let index = activeSamplePlayheads.length - 1; index >= 0; index -= 1) {
            const item = activeSamplePlayheads[index];
            if (item.endTime && now > item.endTime + 0.08) {
                activeSamplePlayheads.splice(index, 1);
            }
        }
    }

    function samplePlayheadRatio(playhead) {
        if (!audio || !playhead) return null;
        const elapsed = (Math.max(0, audio.context.currentTime - playhead.startTime) * playhead.playbackRate) / Math.max(0.001, playhead.sampleDuration || 1);
        const start = playhead.bounds.start;
        const end = playhead.bounds.end;
        const duration = Math.max(0.001, end - start);
        const progress = elapsed % duration;
        if (playhead.mode === 'reverse') return Math.max(0, Math.min(1, end - progress));
        if (playhead.mode === 'loop') return Math.max(0, Math.min(1, start + progress));
        return Math.max(0, Math.min(1, start + Math.min(progress, duration)));
    }

    function playSoundfont(channel, note, time, duration, velocity = 1, slideTo = null) {
        const noteGain = velocityGain(velocity);
        if (noteGain <= 0) return;
        const engine = createAudio();
        const bank = soundfontBankForChannel(channel);
        const preset = findSoundfontPreset(channel, bank);
        const midiNote = noteNumber(note);
        const zone = preset && Array.isArray(preset.zones)
            ? (preset.zones.find(item => midiNote >= item.keyRange[0] && midiNote <= item.keyRange[1]) || preset.zones[0])
            : null;
        if (!zone || !zone.sample || !bank.sampleData) {
            const fallbackWave = (channel.soundfontProgram || 0) < 8 ? 'triangle' : 'sawtooth';
            playWave({ ...channel, wave: fallbackWave, attack: 0.012, release: Math.max(0.16, channel.release), volume: channel.volume * 0.78 }, note, time, duration, noteGain, slideTo);
            return;
        }

        const source = engine.context.createBufferSource();
        const gain = engine.context.createGain();
        const pan = engine.context.createStereoPanner();
        const rootKey = Number.isFinite(zone.rootKey) ? zone.rootKey : (zone.sample.originalPitch || 60);
        const cents = (zone.coarseTune || 0) * 100 + (zone.fineTune || 0) + (zone.sample.pitchCorrection || 0);
        const pitchRatio = channelPitchRatio(channel);
        const playbackRate = Math.pow(2, ((midiNote - rootKey) * 100 + cents) / 1200) * pitchRatio;
        const playDuration = Math.max(0.03, duration || 0.5);
        const release = Math.max(0.03, channel.release);
        const releaseEnd = time + playDuration + release;
        const attenuation = Math.pow(10, -(zone.attenuation || 0) / 200);

        const buffer = soundfontAudioBuffer(zone, engine.context, bank);
        if (!buffer) {
            playWave({ ...channel, wave: 'triangle', attack: 0.012, release: Math.max(0.16, channel.release), volume: channel.volume * 0.78 }, note, time, duration, noteGain, slideTo);
            return;
        }
        source.buffer = buffer;
        source.playbackRate.setValueAtTime(playbackRate, time);
        if (slideTo && slideTo !== note) {
            const targetRate = Math.pow(2, ((noteNumber(slideTo) - rootKey) * 100 + cents) / 1200) * pitchRatio;
            source.playbackRate.exponentialRampToValueAtTime(Math.max(0.001, targetRate), time + playDuration);
        }
        if (zone.loop && zone.loopEnd > zone.loopStart) {
            source.loop = true;
            source.loopStart = Math.max(0, (zone.loopStart - zone.sample.start) / zone.sample.sampleRate);
            source.loopEnd = Math.max(source.loopStart + 0.001, (zone.loopEnd - zone.sample.start) / zone.sample.sampleRate);
        }
        const level = Math.max(0.0001, channel.volume * attenuation * noteGain);
        gain.gain.setValueAtTime(level, time);
        gain.gain.setValueAtTime(level, Math.max(time, time + playDuration));
        gain.gain.exponentialRampToValueAtTime(0.0001, releaseEnd);
        pan.pan.value = Math.max(-1, Math.min(1, channel.pan + (zone.pan || 0)));
        source.connect(gain);
        gain.connect(pan);
        pan.connect(outputNodeForChannel(channel));
        source.start(time);
        source.stop(releaseEnd + 0.02);
    }

    function startSoundfontVoice(channel, note) {
        const engine = createAudio();
        const bank = soundfontBankForChannel(channel);
        const preset = findSoundfontPreset(channel, bank);
        const midiNote = noteNumber(note);
        const zone = preset && Array.isArray(preset.zones)
            ? (preset.zones.find(item => midiNote >= item.keyRange[0] && midiNote <= item.keyRange[1]) || preset.zones[0])
            : null;
        if (!zone || !zone.sample || !bank.sampleData) {
            const fallbackWave = (channel.soundfontProgram || 0) < 8 ? 'triangle' : 'sawtooth';
            return startWaveVoice({ ...channel, wave: fallbackWave, attack: 0.012, release: Math.max(0.16, channel.release), volume: channel.volume * 0.78 }, note);
        }

        const time = engine.context.currentTime;
        const source = engine.context.createBufferSource();
        const gain = engine.context.createGain();
        const pan = engine.context.createStereoPanner();
        const rootKey = Number.isFinite(zone.rootKey) ? zone.rootKey : (zone.sample.originalPitch || 60);
        const cents = (zone.coarseTune || 0) * 100 + (zone.fineTune || 0) + (zone.sample.pitchCorrection || 0);
        const playbackRate = Math.pow(2, ((midiNote - rootKey) * 100 + cents) / 1200) * channelPitchRatio(channel);
        const attenuation = Math.pow(10, -(zone.attenuation || 0) / 200);
        const buffer = soundfontAudioBuffer(zone, engine.context, bank);
        let stopped = false;

        if (!buffer) {
            return startWaveVoice({ ...channel, wave: 'triangle', attack: 0.012, release: Math.max(0.16, channel.release), volume: channel.volume * 0.78 }, note);
        }
        source.buffer = buffer;
        source.playbackRate.setValueAtTime(playbackRate, time);
        source.loop = true;
        if (zone.loop && zone.loopEnd > zone.loopStart) {
            source.loopStart = Math.max(0, (zone.loopStart - zone.sample.start) / zone.sample.sampleRate);
            source.loopEnd = Math.max(source.loopStart + 0.001, (zone.loopEnd - zone.sample.start) / zone.sample.sampleRate);
        } else {
            source.loopStart = 0;
            source.loopEnd = buffer.duration;
        }
        gain.gain.setValueAtTime(Math.max(0.0001, channel.volume * attenuation), time);
        pan.pan.value = Math.max(-1, Math.min(1, channel.pan + (zone.pan || 0)));
        source.connect(gain);
        gain.connect(pan);
        pan.connect(outputNodeForChannel(channel));
        source.start(time);

        return {
            stop() {
                if (stopped) return;
                stopped = true;
                const releaseStart = engine.context.currentTime;
                const release = Math.max(0.03, channel.release);
                gain.gain.cancelScheduledValues(releaseStart);
                gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), releaseStart);
                gain.gain.exponentialRampToValueAtTime(0.0001, releaseStart + release);
                source.stop(releaseStart + release + 0.02);
            }
        };
    }

    function soundfontBankForChannel(channel) {
        if (channel && channel.soundfontSource === 'custom' && customSoundfontBank) return customSoundfontBank;
        const url = channel && channel.soundfontUrl ? channel.soundfontUrl : DEFAULT_SOUNDFONT_URL;
        return soundfontBankCache.get(url) || (soundfontBank.url === url ? soundfontBank : soundfontBank);
    }

    function findSoundfontPreset(channel, bank = soundfontBankForChannel(channel)) {
        const presets = bank && Array.isArray(bank.presets) ? bank.presets : [];
        const program = Number(channel.soundfontProgram) || 0;
        const bankNumber = Number(channel.soundfontBankNumber) || 0;
        return presets.find(item => item.program === program && item.bank === bankNumber)
            || presets.find(item => item.program === program)
            || presets.find(item => item.name === channel.soundfontPreset)
            || presets[0]
            || null;
    }

    function applySoundfontPresetToChannel(channel, bank = soundfontBankForChannel(channel)) {
        const preset = findSoundfontPreset(channel, bank);
        if (!preset) return null;
        channel.soundfontName = bank.name;
        channel.soundfontPreset = preset.name;
        channel.soundfontProgram = preset.program;
        channel.soundfontBankNumber = preset.bank || 0;
        return preset;
    }

    function applySoundfontPresetsToChannels(channels = state.channels) {
        channels.forEach(channel => {
            if (channel.source === 'soundfont') applySoundfontPresetToChannel(channel);
        });
    }

    function soundfontAudioBuffer(zone, context, bank = soundfontBank) {
        if (!zone || !zone.sample || !bank.sampleData) return null;
        if (!zone.bufferCache) zone.bufferCache = new WeakMap();
        const cached = zone.bufferCache.get(context);
        if (cached) return cached;
        const sample = zone.sample;
        const start = Math.max(0, Math.min(bank.sampleData.length - 1, sample.start));
        const end = Math.max(start + 1, Math.min(bank.sampleData.length, sample.end));
        const buffer = context.createBuffer(1, end - start, sample.sampleRate || 44100);
        const channelData = buffer.getChannelData(0);
        for (let index = 0; index < channelData.length; index += 1) {
            channelData[index] = bank.sampleData[start + index] / 32768;
        }
        zone.bufferCache.set(context, buffer);
        return buffer;
    }

    function audibleChannels() {
        const soloed = state.channels.some(channel => channel.solo);
        return state.channels.filter(channel => !channel.muted && (!soloed || channel.solo));
    }

    function playChannelNote(channel, note, time, duration, velocity = 1, slideTo = null) {
        if (channel.source === 'sample') {
            playSample(channel, note, time, duration, velocity, slideTo);
        } else if (channel.source === 'soundfont') {
            playSoundfont(channel, note, time, duration, velocity, slideTo);
        } else if (channel.source === 'synth') {
            playSynth(channel, note, time, duration, velocity, slideTo);
        } else {
            playSynth({ ...channel, source: 'synth', synthType: channel.synthType || 'wave-oscillator' }, note, time, duration, velocity, slideTo);
        }
    }

    async function previewPianoRollNote(channel, event) {
        if (!event || typeof event.note !== 'string') return;
        const engine = createAudio();
        try {
            await engine.context.resume();
        } catch (_) {
            return;
        }
        const duration = Math.max(0.08, noteDurationSeconds(event));
        playChannelNote(channel, event.note, engine.context.currentTime + 0.01, duration, noteVelocity(event), event.slideTo);
        if (!meterAnimation) animateMeter();
    }

    function stopRollPreviewVoice(pointerId = null) {
        if (!rollPreviewVoice || (pointerId !== null && rollPreviewVoice.pointerId !== pointerId)) return;
        const voice = rollPreviewVoice.voice;
        const channelId = rollPreviewVoice.channelId;
        const output = channelId ? channelOutputs.get(channelId) : null;
        rollPreviewVoice = null;
        if (output) {
            output.nodes.forEach(disconnectNode);
            channelOutputs.delete(channelId);
        }
        if (voice && typeof voice.stop === 'function') voice.stop();
    }

    function rollPreviewChannel(channel) {
        return {
            ...channel,
            id: channel.id + '-roll-preview',
            release: 0.006,
            effects: (channel.effects || []).map(effect => ({
                ...effect,
                settings: effect.settings && typeof effect.settings === 'object' ? { ...effect.settings } : {}
            })),
            synthSettings: channel.synthSettings && typeof channel.synthSettings === 'object' ? { ...channel.synthSettings } : {}
        };
    }

    async function startRollPreviewVoice(channel, noteEvent, pointerId) {
        if (!noteEvent || typeof noteEvent.note !== 'string') return;
        stopRollPreviewVoice();
        const previewChannel = rollPreviewChannel(channel);
        const serial = rollPreviewSerial + 1;
        rollPreviewSerial = serial;
        rollPreviewVoice = { pointerId, voice: null, channelId: previewChannel.id, serial };
        const engine = createAudio();
        try {
            await engine.context.resume();
        } catch (_) {
            stopRollPreviewVoice(pointerId);
            return;
        }
        if (!rollPreviewVoice || rollPreviewVoice.pointerId !== pointerId || rollPreviewVoice.serial !== serial) return;
        const voice = previewChannel.source === 'sample'
            ? startSampleVoice(previewChannel, noteEvent.note)
            : previewChannel.source === 'soundfont'
                ? startSoundfontVoice(previewChannel, noteEvent.note)
                : previewChannel.source === 'synth'
                    ? startSynthVoice(previewChannel, noteEvent.note)
                    : startSynthVoice({ ...previewChannel, source: 'synth', synthType: previewChannel.synthType || 'wave-oscillator' }, noteEvent.note);
        if (!rollPreviewVoice || rollPreviewVoice.pointerId !== pointerId || rollPreviewVoice.serial !== serial) {
            if (voice && typeof voice.stop === 'function') voice.stop();
            return;
        }
        rollPreviewVoice.voice = voice;
        if (!meterAnimation) animateMeter();
    }

    function scheduleStep(step, bar, time) {
        applyAutomationStep(step, bar);
        if (currentView === 'roll') {
            const channel = selectedChannel();
            getStepEvents(getPattern(channel), step).forEach(event => {
                playChannelNote(channel, event.note, time, noteDurationSeconds(event, step), noteVelocity(event), event.slideTo);
            });
            return;
        }
        audibleChannels().forEach(channel => {
            const patternIndex = state.clips[channel.id] ? state.clips[channel.id][bar] : null;
            if (patternIndex === null || patternIndex === DISABLED_CLIP) return;
            getStepEvents(getPattern(channel, patternIndex), step).forEach(event => {
                playChannelNote(channel, event.note, time, noteDurationSeconds(event, step), noteVelocity(event), event.slideTo);
            });
        });
    }

    function scheduler() {
        if (!root.isConnected) {
            stop(false);
            return;
        }
        const engine = createAudio();
        while (nextStepTime < engine.context.currentTime + 0.12) {
            scheduleStep(currentStep, currentBar, nextStepTime);
            paintPlayhead();
            nextStepTime += stepSeconds();
            currentStep += 1;
            if (currentStep >= stepCount()) {
                currentStep = 0;
                if (currentView === 'roll') {
                    currentBar = 0;
                } else if (state.loopRange && currentBar >= state.loopRange.end) {
                    currentBar = state.loopRange.start;
                } else {
                    currentBar = (currentBar + 1) % state.barCount;
                    if (state.loopRange && currentBar < state.loopRange.start) currentBar = state.loopRange.start;
                }
            }
        }
    }

    async function start() {
        const engine = createAudio();
        await engine.context.resume();
        if (isPlaying) return;
        if (state.loopRange) currentBar = Math.max(state.loopRange.start, Math.min(state.loopRange.end, currentBar));
        if (currentView === 'roll') currentBar = 0;
        isPlaying = true;
        nextStepTime = engine.context.currentTime + 0.04;
        els.play.classList.add('is-active');
        els.play.innerHTML = '<i class="fa-solid fa-pause"></i>';
        updateStatus(currentView === 'roll' ? 'playing selected pattern' : 'playing bar ' + (currentBar + 1));
        schedulerTimer = window.setInterval(scheduler, 25);
        animateMeter();
    }

    function stop(resetPosition) {
        isPlaying = false;
        if (schedulerTimer) window.clearInterval(schedulerTimer);
        schedulerTimer = null;
        els.play.classList.remove('is-active');
        els.play.innerHTML = '<i class="fa-solid fa-play"></i>';
        if (resetPosition) {
            currentStep = 0;
            currentBar = 0;
        }
        paintPlayhead();
        updateStatus('stopped');
    }

    function stopButtonPressed() {
        if (isPlaying) {
            stop(true);
            return;
        }
        stop(true);
        panicStopSounds();
        updateStatus('all sounds stopped');
    }

    function togglePlayback() {
        if (isPlaying) {
            stop(false);
        } else {
            start();
        }
    }

    function animateMeter() {
        if (!root.isConnected) {
            meterAnimation = null;
            return;
        }
        if (!audio) {
            meterAnimation = null;
            return;
        }
        pruneSamplePlayheads();
        if (!isPlaying && !isRecording && !activeKeyboardVoices.size && !activeSamplePlayheads.length) {
            syncUtilityMeters();
            drawWaveform(true);
            if (currentView === 'waveform') drawSampleEditor();
            meterAnimation = null;
            return;
        }
        syncUtilityMeters();
        drawWaveform(false);
        if (currentView === 'waveform') drawSampleEditor();
        meterAnimation = window.requestAnimationFrame(animateMeter);
    }

    function drawWaveform(idle) {
        if (!audio || !audio.waveformContext || !els.waveform) return;
        const canvas = els.waveform;
        const ctx = audio.waveformContext;
        const rect = canvas.getBoundingClientRect();
        const scale = Math.max(1, window.devicePixelRatio || 1);
        const cssWidth = Math.max(1, Math.round(rect.width || canvas.clientWidth || 150));
        const cssHeight = Math.max(1, Math.round(rect.height || canvas.clientHeight || 30));
        const pixelWidth = Math.max(1, Math.round(cssWidth * scale));
        const pixelHeight = Math.max(1, Math.round(cssHeight * scale));
        if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
            canvas.width = pixelWidth;
            canvas.height = pixelHeight;
        }
        ctx.setTransform(scale, 0, 0, scale, 0, 0);
        ctx.clearRect(0, 0, cssWidth, cssHeight);
        ctx.fillStyle = '#050505';
        ctx.fillRect(0, 0, cssWidth, cssHeight);
        ctx.strokeStyle = idle ? 'rgba(134, 211, 207, 0.32)' : 'rgba(134, 211, 207, 0.95)';
        ctx.lineWidth = 1.4;
        ctx.shadowColor = idle ? 'transparent' : 'rgba(134, 211, 207, 0.45)';
        ctx.shadowBlur = idle ? 0 : 2;
        ctx.beginPath();
        if (idle) {
            const y = cssHeight / 2;
            ctx.moveTo(0, y);
            ctx.lineTo(cssWidth, y);
        } else {
            audio.analyser.getByteTimeDomainData(audio.waveData);
            const center = cssHeight / 2;
            const amplitude = cssHeight * 0.46;
            for (let x = 0; x < cssWidth; x += 1) {
                const index = Math.min(audio.waveData.length - 1, Math.floor((x / Math.max(1, cssWidth - 1)) * audio.waveData.length));
                const value = (audio.waveData[index] - 128) / 128;
                const y = center + (value * amplitude);
                if (x === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    function renderChannels() {
        els.channelList.innerHTML = '';
        state.channels.forEach(migrateWaveChannel);
        syncGlobalSoundfontButton();
        syncWaveformTab();
        syncSynthTab();
        state.channels.forEach((channel, channelIndex) => {
            const card = document.createElement('div');
            const collapsed = channel.collapsed !== false;
            card.className = 'fb-channel'
                + (channel.id === selectedId ? ' is-selected' : '')
                + (collapsed ? ' is-collapsed' : '');
            card.dataset.channelId = channel.id;

            const head = document.createElement('div');
            head.className = 'fb-channel-head';

            const color = document.createElement('input');
            color.className = 'fb-color-input';
            color.type = 'color';
            color.value = channel.color;
            color.setAttribute('aria-label', 'channel color');
            color.addEventListener('click', event => event.stopPropagation());
            color.addEventListener('input', () => {
                channel.color = color.value;
            });
            color.addEventListener('change', () => {
                renderChannels();
                renderRoll();
                renderPlaylist();
            });

            const name = document.createElement('input');
            name.className = 'fb-channel-name';
            name.value = channel.name;
            name.readOnly = true;
            name.setAttribute('aria-label', 'channel name');
            name.addEventListener('click', event => {
                event.stopPropagation();
                selectedId = channel.id;
                ensureChannelPatterns(channel);
                els.pattern.value = String(channel.activePattern);
                root.querySelectorAll('.fb-channel').forEach(el => el.classList.toggle('is-selected', el.dataset.channelId === channel.id));
                renderRoll();
                name.readOnly = false;
                name.focus();
                name.select();
            });
            name.addEventListener('input', () => {
                channel.name = name.value || 'channel';
                renderRoll();
                renderPlaylist();
            });
            name.addEventListener('focus', () => {
                selectedId = channel.id;
                root.querySelectorAll('.fb-channel').forEach(el => el.classList.toggle('is-selected', el.dataset.channelId === channel.id));
            });
            name.addEventListener('blur', () => {
                channel.name = name.value.trim() || 'channel';
                name.value = channel.name;
                name.readOnly = true;
                renderRoll();
                renderPlaylist();
            });
            name.addEventListener('keydown', event => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    name.blur();
                } else if (event.key === 'Escape') {
                    event.preventDefault();
                    name.value = channel.name;
                    name.blur();
                }
            });

            const mute = miniButton('M', 'mute channel', channel.muted);
            mute.addEventListener('click', event => {
                event.stopPropagation();
                channel.muted = !channel.muted;
                renderChannels();
            });

            const solo = miniButton('S', 'solo channel', channel.solo);
            solo.addEventListener('click', event => {
                event.stopPropagation();
                channel.solo = !channel.solo;
                renderChannels();
            });

            const remove = miniButton('<i class="fa-solid fa-trash"></i>', 'remove channel', false);
            remove.classList.add('fb-remove-button');
            remove.addEventListener('click', event => {
                event.stopPropagation();
                removeChannel(channel.id);
            });

            head.append(color, name, mute, solo, remove);
            const expand = miniButton('<i class="fa-solid fa-chevron-down"></i>', 'expand channel', false);
            expand.classList.add('fb-channel-expand-button');
            expand.addEventListener('click', event => {
                event.stopPropagation();
                channel.collapsed = false;
                selectedId = channel.id;
                renderChannels();
                renderRoll();
            });
            const minimize = miniButton('<i class="fa-solid fa-chevron-up"></i>', 'minimize channel', false);
            minimize.classList.add('fb-channel-expand-button');
            minimize.addEventListener('click', event => {
                event.stopPropagation();
                channel.collapsed = true;
                selectedId = channel.id;
                renderChannels();
                renderRoll();
            });

            const controls = document.createElement('div');
            controls.className = 'fb-channel-controls';
            const sourceField = field('source', select(['synth', 'sample', 'soundfont'], channel.source === 'wave' ? 'synth' : channel.source, value => {
                channel.source = value;
                if (value === 'sample' && !channel.sampleBuffer) {
                    createAudio();
                    makeSyntheticKick(channel);
                    channel.sampleName = channel.sampleName || 'synthetic kick';
                    channel.sampleType = sampleType(channel);
                    channel.sampleSource = channel.sampleSource || 'custom';
                    channel.sampleStart = sampleTrimValue(channel.sampleStart, 0);
                    channel.sampleEnd = sampleTrimValue(channel.sampleEnd, 1);
                }
                if (value === 'soundfont') {
                    loadDefaultSoundfont();
                    channel.soundfontName = soundfontBank.name;
                    channel.soundfontSource = channel.soundfontSource || 'bundled';
                    channel.soundfontUrl = channel.soundfontUrl || soundfontBank.url || DEFAULT_SOUNDFONT_URL;
                    channel.soundfontPreset = channel.soundfontPreset || soundfontBank.presets[0].name;
                    channel.soundfontProgram = Number(channel.soundfontProgram) || soundfontBank.presets[0].program;
                    channel.soundfontBankNumber = Number(channel.soundfontBankNumber) || soundfontBank.presets[0].bank || 0;
                }
                if (value === 'synth') {
                    ensureChannelSynth(channel);
                    loadSynthCatalog();
                }
                syncGlobalSoundfontButton();
                renderChannels();
                syncSynthTab();
                renderSynthEditor();
                renderAutomation();
            }));
            controls.append(sourceField, instrumentField(channel));
            if (channel.source === 'soundfont') controls.append(soundfontBankField(channel), soundfontCustomField(channel));
            if (channel.source === 'sample') controls.append(sampleSourceField(channel), sampleCustomField(channel), sampleKeepDurationField(channel));
            controls.append(
                field('volume', range(channel.volume, 0, 1, 0.01, value => {
                    channel.volume = value;
                })),
                field('pan', range(channel.pan, -1, 1, 0.01, value => {
                    channel.pan = value;
                }))
            );

            const steps = document.createElement('div');
            steps.className = 'fb-steps';
            const pattern = getPattern(channel);
            for (let step = 0; step < stepCount(); step += 1) {
                const events = getStepEvents(pattern, step);
                const button = document.createElement('button');
                button.className = 'fb-step' + (events.length ? ' is-on' : '');
                button.type = 'button';
                button.dataset.step = String(step);
                button.dataset.channelIndex = String(channelIndex);
                button.setAttribute('aria-label', channel.name + ' step ' + (step + 1));
                button.addEventListener('click', event => {
                    event.stopPropagation();
                    selectChannel(channel.id);
                    const active = getPattern(channel);
                    const events = getStepEvents(active, step);
                    if (events.length) {
                        active[step] = [];
                    } else {
                        events.push({ note: defaultNoteFor(channel), length: 1, velocity: 1 });
                    }
                    renderChannels();
                    renderRoll();
                });
                steps.append(button);
            }

            card.addEventListener('click', () => selectChannel(channel.id));
            card.append(head);
            if (collapsed) {
                card.append(expand);
            } else {
                card.append(controls, steps, minimize);
            }
            els.channelList.append(card);
        });
    }

    function miniButton(text, label, active) {
        const button = document.createElement('button');
        button.className = 'fb-button fb-mini-button' + (active ? ' is-active' : '');
        button.type = 'button';
        button.innerHTML = text;
        button.setAttribute('data-tooltip', label);
        return button;
    }

    function field(labelText, control) {
        const label = document.createElement('label');
        label.className = 'fb-field';
        const span = document.createElement('span');
        span.textContent = labelText;
        label.append(span, control);
        return label;
    }

    function instrumentField(channel) {
        if (channel.source === 'sample') {
            return field('type', select(['one-shot', 'loop', 'reverse'], sampleType(channel), value => {
                channel.sampleType = value;
                drawSampleEditor();
            }));
        }
        if (channel.source === 'soundfont') {
            return field('preset', soundfontInput(channel));
        }
        if (channel.source === 'synth') {
            return field('synth', synthInput(channel));
        }
        return field('synth', synthInput(channel));
    }

    function synthInput(channel) {
        const definitions = Array.from(synthDefinitions.values()).sort((a, b) => a.name.localeCompare(b.name));
        const input = document.createElement('select');
        input.className = 'fb-select';
        if (!definitions.length) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'loading synths';
            input.append(option);
            input.disabled = true;
            return input;
        }
        const current = synthDefinitionForChannel(channel);
        if (!current && channel.synthType) {
            const option = document.createElement('option');
            option.value = channel.synthType;
            option.textContent = channel.synthType + ' (loading)';
            option.selected = true;
            input.append(option);
        }
        definitions.forEach(definition => {
            const option = document.createElement('option');
            option.value = definition.id;
            option.textContent = definition.name;
            option.selected = current ? definition.id === current.id : !channel.synthType && definition === definitions[0];
            input.append(option);
        });
        input.addEventListener('change', () => {
            channel.synthType = input.value;
            channel.synthSettings = normalizeParamSettings(synthDefinitionForChannel(channel) || definitions[0], channel.synthSettings || {});
            renderChannels();
            renderSynthEditor();
            renderAutomation();
            updateStatus('selected synth: ' + ((synthDefinitionForChannel(channel) || {}).name || input.value));
        });
        return input;
    }

    function soundfontBankField(channel) {
        const catalog = soundfontCatalog.length ? soundfontCatalog : [{ name: 'Roland SC-55', filename: 'Roland_SC-55.sf2', url: DEFAULT_SOUNDFONT_URL }];
        const currentUrl = channel.soundfontUrl || DEFAULT_SOUNDFONT_URL;
        const input = document.createElement('select');
        input.className = 'fb-select';
        const customOption = document.createElement('option');
        customOption.value = '__custom';
        customOption.textContent = 'custom...';
        customOption.selected = channel.soundfontSource === 'custom';
        input.append(customOption);
        catalog.forEach(item => {
            const option = document.createElement('option');
            option.value = item.url;
            option.textContent = item.name;
            option.selected = item.url === currentUrl && channel.soundfontSource !== 'custom';
            input.append(option);
        });
        input.addEventListener('change', async () => {
            if (input.value === '__custom') {
                channel.soundfontSource = 'custom';
                channel.soundfontUrl = '';
                if (customSoundfontBank) {
                    channel.soundfontName = customSoundfontBank.name;
                    applySoundfontPresetToChannel(channel, customSoundfontBank);
                    renderRoll();
                } else {
                    updateStatus('choose a custom soundfont');
                }
                renderChannels();
                return;
            }
            const selected = catalog.find(item => item.url === input.value) || catalog[0];
            input.disabled = true;
            const bank = await loadChannelSoundfontFromUrl(channel, selected.url, selected.name);
            applySoundfontPresetToChannel(channel, bank);
            renderChannels();
            renderRoll();
        });
        return field('bank', input);
    }

    function miniField(labelText, control) {
        const wrap = document.createElement('label');
        wrap.className = 'fb-mini-field';
        const label = document.createElement('span');
        label.textContent = labelText;
        wrap.append(label, control);
        return wrap;
    }

    function select(options, value, onChange) {
        const el = document.createElement('select');
        el.className = 'fb-select';
        options.forEach(option => {
            const item = document.createElement('option');
            item.value = option;
            item.textContent = option;
            if (option === value) item.selected = true;
            el.append(item);
        });
        el.addEventListener('change', () => onChange(el.value));
        return el;
    }

    function range(value, min, max, step, onInput) {
        const el = document.createElement('input');
        el.className = 'fb-range';
        el.type = 'range';
        el.min = String(min);
        el.max = String(max);
        el.step = String(step);
        el.value = String(value);
        const commit = () => onInput(Number(el.value));
        el.addEventListener('input', commit);
        el.addEventListener('change', commit);
        return el;
    }

    function numberInput(value, min, max, step, onInput) {
        const el = document.createElement('input');
        el.className = 'fb-control';
        el.type = 'number';
        el.min = String(min);
        el.max = String(max);
        el.step = String(step);
        el.value = String(value);
        el.addEventListener('input', () => onInput(Number(el.value)));
        el.addEventListener('blur', () => {
            const clamped = Math.max(min, Math.min(max, Math.round(Number(el.value) || min)));
            el.value = String(clamped);
            onInput(clamped);
        });
        return el;
    }

    function sampleSourceField(channel) {
        const input = document.createElement('select');
        input.className = 'fb-select';
        const customOption = document.createElement('option');
        customOption.value = '__custom';
        customOption.textContent = 'custom...';
        customOption.selected = channel.sampleSource === 'custom' || !channel.sampleUrl;
        input.append(customOption);
        sampleCatalog.forEach(item => {
            const option = document.createElement('option');
            option.value = item.url;
            option.textContent = item.name;
            option.selected = channel.sampleSource !== 'custom' && channel.sampleUrl === item.url;
            input.append(option);
        });
        input.addEventListener('change', async () => {
            if (input.value === '__custom') {
                channel.sampleSource = 'custom';
                renderChannels();
                return;
            }
            const selected = sampleCatalog.find(item => item.url === input.value);
            if (!selected) return;
            input.disabled = true;
            await loadSampleFromUrl(channel, selected.url, selected.name);
            channel.sampleSource = 'bundled';
            channel.sampleUrl = selected.url;
            channel.sampleAsset = null;
            renderChannels();
            renderRoll();
        });
        return field('sample', input);
    }

    function sampleCustomField(channel) {
        return field('custom', sampleInput(channel, channel.sampleSource !== 'custom' && !!channel.sampleUrl));
    }

    function checkbox(checked, onChange) {
        const el = document.createElement('input');
        el.className = 'fb-checkbox';
        el.type = 'checkbox';
        el.checked = !!checked;
        el.addEventListener('click', event => event.stopPropagation());
        el.addEventListener('change', event => {
            event.stopPropagation();
            onChange(el.checked);
        });
        return el;
    }

    function sampleKeepDurationField(channel) {
        const wrap = document.createElement('label');
        wrap.className = 'fb-field fb-checkbox-field';
        wrap.addEventListener('click', event => event.stopPropagation());
        const text = document.createElement('span');
        text.className = 'fb-checkbox-label';
        text.textContent = 'keep duration';
        const input = checkbox(sampleKeepsDuration(channel), value => {
            channel.sampleKeepDuration = value;
            if (value) warmSamplePitchCache(channel);
            drawSampleEditor();
        });
        const mark = document.createElement('span');
        mark.className = 'fb-checkbox-mark';
        mark.setAttribute('aria-hidden', 'true');
        wrap.append(text, input, mark);
        return wrap;
    }

    function sampleTrimControls(channel) {
        const wrap = document.createElement('div');
        wrap.className = 'fb-sample-trim-row';
        const start = range(sampleTrimValue(channel.sampleStart, 0), 0, 0.99, 0.01, value => {
            channel.sampleStart = Math.max(0, Math.min(value, sampleTrimValue(channel.sampleEnd, 1) - 0.01));
            start.value = String(channel.sampleStart);
            drawSampleEditor();
        });
        const end = range(sampleTrimValue(channel.sampleEnd, 1), 0.01, 1, 0.01, value => {
            channel.sampleEnd = Math.min(1, Math.max(value, sampleTrimValue(channel.sampleStart, 0) + 0.01));
            end.value = String(channel.sampleEnd);
            drawSampleEditor();
        });
        wrap.append(field('start', start), field('end', end));
        return wrap;
    }

    function sampleInput(channel, disabled = false) {
        const wrap = document.createElement('div');
        wrap.className = 'fb-sample-upload';
        const picker = document.createElement('label');
        picker.className = 'fb-upload-button';
        picker.classList.toggle('is-disabled', disabled);
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'audio/*';
        input.disabled = disabled;
        input.setAttribute('aria-label', 'import sample');
        const buttonText = document.createElement('span');
        buttonText.textContent = 'browse...';
        input.addEventListener('change', async () => {
            const file = input.files && input.files[0];
            if (!file) return;
            const progress = showExportProgress('importing sample...', 'reading ' + file.name);
            try {
                await setExportProgress(progress, 8, 'reading ' + file.name, 40);
                const engine = createAudio();
                const asset = await fileToAsset(file);
                await setExportProgress(progress, 45, 'decoding audio', 40);
                const data = base64ToArrayBuffer(asset.data);
                channel.sampleBuffer = await engine.context.decodeAudioData(data.slice(0));
                await setExportProgress(progress, 78, 'building waveform', 40);
                channel.sampleName = file.name;
                channel.sampleSource = 'custom';
                channel.sampleUrl = '';
                channel.sampleAsset = asset;
                updateStatus('loaded sample: ' + file.name);
                renderChannels();
                renderSampleEditor();
                warmSamplePitchCache(channel);
                await setExportProgress(progress, 100, 'loaded sample', 100);
            } catch (_) {
                updateStatus('sample import failed');
            } finally {
                progress.close();
            }
        });
        picker.append(input, buttonText);
        wrap.append(picker);
        return wrap;
    }

    function soundfontInput(channel) {
        const bank = soundfontBankForChannel(channel);
        const resolvedPreset = applySoundfontPresetToChannel(channel, bank) || bank.presets[0];
        return select(bank.presets.map(item => item.name), resolvedPreset.name, value => {
            const selected = bank.presets.find(item => item.name === value) || bank.presets[0];
            channel.soundfontPreset = selected.name;
            channel.soundfontProgram = selected.program;
            channel.soundfontBankNumber = selected.bank || 0;
            channel.soundfontName = bank.name;
        });
    }

    function soundfontCustomField(channel) {
        const isCustom = channel.soundfontSource === 'custom';
        const picker = document.createElement('label');
        picker.className = 'fb-upload-button' + (isCustom ? '' : ' is-disabled');
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.sf2,audio/x-soundfont';
        input.disabled = !isCustom;
        input.setAttribute('aria-label', 'import soundfont');
        const text = document.createElement('span');
        text.textContent = isCustom ? 'browse...' : 'disabled';
        input.addEventListener('change', async () => {
            const file = input.files && input.files[0];
            if (!file) return;
            try {
                const asset = await fileToAsset(file);
                soundfontBank = parseSoundfont(base64ToArrayBuffer(asset.data), file.name.replace(/\.sf2$/i, ''));
                soundfontBank.asset = asset;
                soundfontBank.url = null;
                customSoundfontBank = soundfontBank;
                useCustomSoundfont = true;
                channel.soundfontSource = 'custom';
                channel.soundfontUrl = '';
                applySoundfontPresetToChannel(channel, customSoundfontBank);
                updateStatus('loaded soundfont: ' + soundfontBank.name);
                renderChannels();
            } catch (_) {
                updateStatus('soundfont import failed');
            }
        });
        picker.append(input, text);
        return field('custom', picker);
    }

    function parseSoundfont(arrayBuffer, fallbackName) {
        const bytes = new Uint8Array(arrayBuffer);
        const view = new DataView(arrayBuffer);
        const readString = (offset, length) => {
            let text = '';
            for (let i = 0; i < length && offset + i < bytes.length; i += 1) {
                const code = bytes[offset + i];
                if (code === 0) break;
                text += String.fromCharCode(code);
            }
            return text.trim();
        };
        const chunks = {};
        const remember = (id, offset, size) => {
            if (!chunks[id]) chunks[id] = [];
            chunks[id].push({ offset, size });
        };
        const walk = (start, end) => {
            for (let offset = start; offset + 8 <= end;) {
                const id = readString(offset, 4);
                const size = view.getUint32(offset + 4, true);
                const dataOffset = offset + 8;
                if (id === 'LIST') {
                    const type = readString(dataOffset, 4);
                    remember('LIST:' + type, dataOffset + 4, size - 4);
                    walk(dataOffset + 4, dataOffset + size);
                } else {
                    remember(id, dataOffset, size);
                }
                offset = dataOffset + size + (size % 2);
            }
        };
        walk(12, bytes.length);

        const firstChunk = id => chunks[id] && chunks[id][0] ? chunks[id][0] : null;
        const nameChunk = firstChunk('INAM');
        const name = nameChunk ? (readString(nameChunk.offset, Math.min(nameChunk.size, 96)) || fallbackName) : (fallbackName || 'imported soundfont');
        const smpl = firstChunk('smpl');
        let sampleData = null;
        if (smpl) {
            sampleData = new Int16Array(Math.floor(smpl.size / 2));
            for (let index = 0; index < sampleData.length; index += 1) {
                sampleData[index] = view.getInt16(smpl.offset + index * 2, true);
            }
        }
        const readGenAmount = (offset) => {
            const oper = view.getUint16(offset, true);
            const raw = view.getUint16(offset + 2, true);
            const signed = view.getInt16(offset + 2, true);
            if (oper === 43 || oper === 44) return { oper, amount: [raw & 0xff, (raw >> 8) & 0xff] };
            if (oper === 41 || oper === 53 || oper === 54 || oper === 58) return { oper, amount: raw };
            return { oper, amount: signed };
        };
        const readRecords = (id, size, reader) => {
            const chunk = firstChunk(id);
            if (!chunk) return [];
            const records = [];
            const count = Math.floor(chunk.size / size);
            for (let index = 0; index < count; index += 1) records.push(reader(chunk.offset + index * size, index));
            return records;
        };
        const phdr = readRecords('phdr', 38, offset => ({
            name: readString(offset, 20),
            program: view.getUint16(offset + 20, true),
            bank: view.getUint16(offset + 22, true),
            bagIndex: view.getUint16(offset + 24, true)
        }));
        const pbag = readRecords('pbag', 4, offset => ({ genIndex: view.getUint16(offset, true) }));
        const pgen = readRecords('pgen', 4, offset => readGenAmount(offset));
        const inst = readRecords('inst', 22, offset => ({
            name: readString(offset, 20),
            bagIndex: view.getUint16(offset + 20, true)
        }));
        const ibag = readRecords('ibag', 4, offset => ({ genIndex: view.getUint16(offset, true) }));
        const igen = readRecords('igen', 4, offset => readGenAmount(offset));
        const shdr = readRecords('shdr', 46, offset => ({
            name: readString(offset, 20),
            start: view.getUint32(offset + 20, true),
            end: view.getUint32(offset + 24, true),
            loopStart: view.getUint32(offset + 28, true),
            loopEnd: view.getUint32(offset + 32, true),
            sampleRate: view.getUint32(offset + 36, true) || 44100,
            originalPitch: view.getUint8(offset + 40) || 60,
            pitchCorrection: view.getInt8(offset + 41) || 0
        }));
        const zoneGenerators = (bags, gens, zoneIndex) => {
            const start = bags[zoneIndex] ? bags[zoneIndex].genIndex : 0;
            const end = bags[zoneIndex + 1] ? bags[zoneIndex + 1].genIndex : gens.length;
            const map = {};
            for (let index = start; index < end; index += 1) map[gens[index].oper] = gens[index].amount;
            return map;
        };
        const mergeZone = (...maps) => Object.assign({}, ...maps.filter(Boolean));
        const keyRange = gens => Array.isArray(gens[43]) ? gens[43] : [0, 127];
        const buildSampleZone = gens => {
            const sample = shdr[gens[53]];
            if (!sample || !sampleData) return null;
            const start = Math.max(0, sample.start + (gens[0] || 0) + ((gens[4] || 0) * 32768));
            const end = Math.min(sampleData.length, Math.max(start + 1, sample.end + (gens[1] || 0) + ((gens[12] || 0) * 32768)));
            const loopStart = Math.max(start, sample.loopStart + (gens[2] || 0) + ((gens[45] || 0) * 32768));
            const loopEnd = Math.min(end, Math.max(loopStart + 1, sample.loopEnd + (gens[3] || 0) + ((gens[50] || 0) * 32768)));
            return {
                keyRange: keyRange(gens),
                sample: { ...sample, start, end },
                rootKey: gens[58] >= 0 && gens[58] <= 127 ? gens[58] : sample.originalPitch,
                coarseTune: gens[51] || 0,
                fineTune: gens[52] || 0,
                attenuation: Math.max(0, gens[48] || 0),
                pan: Math.max(-1, Math.min(1, (gens[17] || 0) / 500)),
                loop: (gens[54] || 0) === 1 || (gens[54] || 0) === 3,
                loopStart,
                loopEnd,
                bufferCache: new WeakMap()
            };
        };
        const buildInstrumentZones = (instrumentIndex) => {
            const instrument = inst[instrumentIndex];
            if (!instrument || !ibag.length) return [];
            const next = inst[instrumentIndex + 1] ? inst[instrumentIndex + 1].bagIndex : ibag.length - 1;
            let global = {};
            const zones = [];
            for (let zoneIndex = instrument.bagIndex; zoneIndex < next; zoneIndex += 1) {
                const gens = zoneGenerators(ibag, igen, zoneIndex);
                if (gens[53] === undefined) {
                    global = mergeZone(global, gens);
                } else {
                    const zone = buildSampleZone(mergeZone(global, gens));
                    if (zone) zones.push(zone);
                }
            }
            return zones;
        };
        const presets = [];
        for (let presetIndex = 0; presetIndex < Math.max(0, phdr.length - 1); presetIndex += 1) {
            const preset = phdr[presetIndex];
            const next = phdr[presetIndex + 1] ? phdr[presetIndex + 1].bagIndex : pbag.length - 1;
            let global = {};
            const zones = [];
            for (let zoneIndex = preset.bagIndex; zoneIndex < next; zoneIndex += 1) {
                const gens = zoneGenerators(pbag, pgen, zoneIndex);
                if (gens[41] === undefined) {
                    global = mergeZone(global, gens);
                } else {
                    const presetZone = mergeZone(global, gens);
                    buildInstrumentZones(presetZone[41]).forEach(zone => {
                        const range = keyRange(presetZone);
                        const mergedRange = [Math.max(range[0], zone.keyRange[0]), Math.min(range[1], zone.keyRange[1])];
                        if (mergedRange[0] <= mergedRange[1]) zones.push({ ...zone, keyRange: mergedRange });
                    });
                }
            }
            presets.push({ name: preset.name + ' [' + preset.bank + ':' + preset.program + ']', program: preset.program, bank: preset.bank, zones });
        }
        return { name, sampleData, presets: presets.length ? presets : [{ name: 'Acoustic Grand Piano [0:0]', program: 0, bank: 0, zones: [] }] };
    }

    function defaultNoteFor(channel) {
        if (channel.source === 'sample') return 'C4';
        const baseOctave = octavePageBase(state.octave);
        return channel.id === 'bass' ? 'C' + baseOctave : 'C' + (baseOctave + 1);
    }

    function keyboardNote(event) {
        const key = event.key.toLowerCase();
        const offset = FL_KEYBOARD[key] ?? BRITISH_QWERTY_KEYBOARD[key];
        if (offset === undefined) return null;
        const baseOctave = octavePageBase(els.octave.value || state.octave);
        const midi = (baseOctave + 1) * 12 + offset;
        return midiToNote(midi);
    }

    async function startKeyboardNote(key, note) {
        const channel = selectedChannel();
        const engine = createAudio();
        await engine.context.resume();
        if (!heldKeys.has(key) || activeKeyboardVoices.has(key)) return;
        const voice = channel.source === 'sample'
            ? startSampleVoice(channel, note)
            : channel.source === 'soundfont'
                ? startSoundfontVoice(channel, note)
                : channel.source === 'synth'
                    ? startSynthVoice(channel, note)
                    : startSynthVoice({ ...channel, source: 'synth', synthType: channel.synthType || 'wave-oscillator' }, note);
        activeKeyboardVoices.set(key, voice);
        if (!meterAnimation) animateMeter();
    }

    function stopKeyboardNote(key) {
        const voice = activeKeyboardVoices.get(key);
        if (!voice) return;
        activeKeyboardVoices.delete(key);
        voice.stop();
    }

    function stopKeyboardNotes() {
        heldKeys.clear();
        Array.from(activeKeyboardVoices.keys()).forEach(stopKeyboardNote);
    }

    async function startFromBar(bar) {
        currentBar = Math.max(0, Math.min(state.barCount - 1, Number(bar) || 0));
        currentStep = 0;
        if (isPlaying) {
            const engine = createAudio();
            nextStepTime = engine.context.currentTime + 0.04;
            paintPlayhead();
            updateStatus('playing bar ' + (currentBar + 1));
            return;
        }
        await start();
    }

    function isBarInLoop(bar) {
        return !state.loopRange || (bar >= state.loopRange.start && bar <= state.loopRange.end);
    }

    function togglePlaylistLoop(bar) {
        const safeBar = Math.max(0, Math.min(state.barCount - 1, Number(bar) || 0));
        if (!state.loopRange) {
            state.loopRange = { start: safeBar, end: safeBar };
        } else if (state.loopRange.start === safeBar && state.loopRange.end === safeBar) {
            state.loopRange = null;
        } else if (safeBar >= state.loopRange.start - 1 && safeBar <= state.loopRange.end + 1) {
            if (safeBar === state.loopRange.start && state.loopRange.start < state.loopRange.end) {
                state.loopRange.start += 1;
            } else if (safeBar === state.loopRange.end && state.loopRange.start < state.loopRange.end) {
                state.loopRange.end -= 1;
            } else {
                state.loopRange = {
                    start: Math.min(state.loopRange.start, safeBar),
                    end: Math.max(state.loopRange.end, safeBar)
                };
            }
        } else {
            state.loopRange = { start: safeBar, end: safeBar };
        }
        if (state.loopRange && (currentBar < state.loopRange.start || currentBar > state.loopRange.end)) {
            currentBar = state.loopRange.start;
            currentStep = 0;
        }
        renderPlaylist();
        paintPlayhead();
        updateStatus(state.loopRange ? 'looping bar ' + (state.loopRange.start + 1) + '-' + (state.loopRange.end + 1) : 'playlist loop off');
    }

    function rollStepRect(step) {
        const label = els.pianoRoll.querySelector('.fb-bar-label[data-step="' + step + '"]');
        return label ? label.getBoundingClientRect() : null;
    }

    function noteLengthAtPointer(step, clientX) {
        const maxLength = Math.max(noteLengthSnap, stepCount() - step);
        const startRect = rollStepRect(step);
        if (!startRect || startRect.width <= 0) return noteLengthSnap;
        if (clientX <= startRect.left) return noteLengthSnap;
        for (let index = step; index < stepCount(); index += 1) {
            const rect = rollStepRect(index);
            if (!rect || rect.width <= 0) continue;
            if (clientX < rect.left) return Math.max(noteLengthSnap, index - step);
            if (clientX <= rect.right) {
                return Math.max(noteLengthSnap, (index - step) + ((clientX - rect.left) / rect.width));
            }
        }
        return maxLength;
    }

    function noteEndX(step, length) {
        const end = Math.min(stepCount(), step + length);
        if (end >= stepCount()) {
            const lastRect = rollStepRect(stepCount() - 1);
            return lastRect ? lastRect.right : null;
        }
        const endStep = Math.floor(end);
        const fraction = end - endStep;
        if (fraction <= 0) {
            const rect = rollStepRect(endStep);
            return rect ? rect.left : null;
        }
        const rect = rollStepRect(endStep);
        return rect ? rect.left + (rect.width * fraction) : null;
    }

    function setNoteBlockLengthStyles(block, handle, step, length) {
        const startRect = rollStepRect(step);
        const endX = noteEndX(step, length);
        if (!startRect || startRect.width <= 0 || endX === null) {
            if (block) block.style.width = 'calc(' + (length * 100) + '% - 8px)';
            if (handle) handle.style.left = 'calc(' + (length * 100) + '% - 5px)';
            return;
        }
        const noteWidth = Math.max(10, endX - startRect.left - 8);
        if (block) block.style.width = noteWidth + 'px';
        if (handle) handle.style.left = (endX - startRect.left - 5) + 'px';
    }

    function renderRoll() {
        const channel = selectedChannel();
        ensureChannelPatterns(channel);
        const baseOctave = octavePageBase(els.octave.value);
        const selectedPattern = Number(els.pattern.value);
        const patternIndex = Number.isInteger(selectedPattern) ? selectedPattern : (channel.activePattern || 0);
        channel.activePattern = Math.max(0, Math.min(MAX_PATTERNS - 1, patternIndex));
        const pattern = getPattern(channel);
        els.selectedLabel.textContent = 'selected: ' + channel.name + ' / pattern ' + (channel.activePattern + 1) + ' / ' + stepCount() + ' beats';
        els.pianoRoll.innerHTML = '';
        els.pianoRoll.style.gridTemplateColumns = '72px repeat(' + stepCount() + ', minmax(34px, 1fr))';

        const corner = document.createElement('div');
        corner.className = 'fb-bar-label';
        corner.textContent = 'note';
        els.pianoRoll.append(corner);
        for (let step = 0; step < stepCount(); step += 1) {
            const label = document.createElement('div');
            label.className = 'fb-bar-label';
            label.textContent = String(step + 1);
            label.dataset.step = String(step);
            els.pianoRoll.append(label);
        }

        const notes = [baseOctave, baseOctave + 1].flatMap(octave => CHROMATIC.map(name => name + octave)).reverse();
        notes.forEach(note => {
            const label = document.createElement('div');
            const isBlack = note.includes('#');
            label.className = 'fb-note-label' + (isBlack ? ' is-black-key' : '');
            label.dataset.note = note;
            const key = document.createElement('span');
            key.className = 'fb-piano-key';
            const text = document.createElement('span');
            text.textContent = note;
            label.append(key, text);
            els.pianoRoll.append(label);

            for (let step = 0; step < stepCount(); step += 1) {
                const stepEvents = getStepEvents(pattern, step);
                const event = stepEvents.find(item => item.note === note) || null;
                const isActiveNote = !!event;
                const cell = document.createElement('div');
                cell.className = 'fb-cell' + (isActiveNote ? ' is-on' : '');
                cell.setAttribute('role', 'button');
                cell.tabIndex = 0;
                cell.dataset.step = String(step);
                cell.dataset.note = note;
                cell.setAttribute('aria-label', note + ' step ' + (step + 1));
                if (isActiveNote) {
                    const eventIndex = stepEvents.indexOf(event);
                    const block = document.createElement('span');
                    block.className = 'fb-note-block' + (event.slideTo ? ' is-slide' : '');
                    block.dataset.step = String(step);
                    block.dataset.note = note;
                    block.dataset.eventIndex = String(eventIndex);
                    block.dataset.velocity = String(noteVelocity(event));
                    if (event.slideTo) {
                        block.dataset.slideTo = event.slideTo;
                        block.title = 'slides to ' + event.slideTo;
                        const slideText = document.createElement('span');
                        slideText.className = 'fb-slide-text';
                        slideText.textContent = event.slideTo;
                        block.append(slideText);
                    }
                    block.style.opacity = String(Math.max(0.28, noteVelocity(event)));
                    const length = clampedNoteLength(event, step);
                    const handle = document.createElement('span');
                    handle.className = 'fb-note-resize';
                    handle.dataset.step = String(step);
                    handle.dataset.note = note;
                    handle.dataset.eventIndex = String(eventIndex);
                    cell.append(block, handle);
                    setNoteBlockLengthStyles(block, handle, step, length);
                }
                els.pianoRoll.append(cell);
            }
        });
    }

    function renderPlaylist() {
        ensureClipMap();
        els.playlist.innerHTML = '';
        els.playlist.style.setProperty('--fb-playlist-columns', '110px repeat(' + state.channels.length + ', minmax(86px, 1fr))');
        els.playlist.style.setProperty('--fb-playlist-min-width', (110 + (state.channels.length * 96)) + 'px');
        const first = document.createElement('div');
        first.className = 'fb-playlist-track';
        first.textContent = 'bars';
        els.playlist.append(first);

        state.channels.forEach(channel => {
            const columnLabel = document.createElement('div');
            columnLabel.className = 'fb-playlist-track';
            columnLabel.dataset.channelId = channel.id;
            const color = document.createElement('div');
            color.className = 'fb-playlist-track-color';
            color.style.background = channel.color;
            const name = document.createElement('span');
            name.textContent = channel.name;
            columnLabel.append(color, name);
            columnLabel.addEventListener('click', () => selectChannel(channel.id));
            els.playlist.append(columnLabel);
        });

        for (let bar = 0; bar < state.barCount; bar += 1) {
            const head = document.createElement('div');
            head.className = 'fb-bar-label fb-playlist-head'
                + (state.loopRange && !isBarInLoop(bar) ? ' is-loop-muted' : '')
                + (state.loopRange && isBarInLoop(bar) ? ' is-looped' : '');
            head.dataset.bar = String(bar);
            const label = document.createElement('button');
            label.className = 'fb-playlist-start-column';
            label.type = 'button';
            label.textContent = String(bar + 1);
            label.setAttribute('aria-label', 'play from playlist row ' + (bar + 1));
            label.addEventListener('click', event => {
                event.stopPropagation();
                startFromBar(bar);
            });
            const loop = document.createElement('button');
            loop.className = 'fb-playlist-loop-column' + (state.loopRange && isBarInLoop(bar) ? ' is-active' : '');
            loop.type = 'button';
            loop.innerHTML = '<i class="fa-solid fa-repeat"></i>';
            loop.setAttribute('aria-label', 'toggle loop row ' + (bar + 1));
            loop.addEventListener('click', event => {
                event.stopPropagation();
                togglePlaylistLoop(bar);
            });
            const deleteColumn = document.createElement('button');
            deleteColumn.className = 'fb-playlist-delete-column';
            deleteColumn.type = 'button';
            deleteColumn.disabled = state.barCount <= 1;
            deleteColumn.innerHTML = '<i class="fa-solid fa-trash"></i>';
            deleteColumn.setAttribute('aria-label', 'delete playlist row ' + (bar + 1));
            deleteColumn.addEventListener('click', event => {
                event.stopPropagation();
                removePlaylistColumn(bar);
            });
            head.append(label, loop, deleteColumn);
            els.playlist.append(head);

            state.channels.forEach(channel => {
                const clipPattern = state.clips[channel.id][bar];
                const cell = document.createElement('button');
                cell.className = 'fb-playlist-cell'
                    + (clipPattern !== null && clipPattern !== DISABLED_CLIP ? ' is-on' : '')
                    + (clipPattern === DISABLED_CLIP ? ' is-disabled' : '')
                    + (state.loopRange && !isBarInLoop(bar) ? ' is-loop-muted' : '')
                    + (state.loopRange && isBarInLoop(bar) ? ' is-looped' : '');
                cell.type = 'button';
                cell.dataset.bar = String(bar);
                cell.dataset.channelId = channel.id;
                cell.textContent = clipPattern === DISABLED_CLIP ? '0' : (clipPattern !== null ? String(clipPattern + 1) : '');
                cell.addEventListener('click', () => {
                    const current = state.clips[channel.id][bar];
                    if (current === null) {
                        state.clips[channel.id][bar] = channel.id === selectedId ? channel.activePattern : 0;
                    } else if (current === DISABLED_CLIP) {
                        state.clips[channel.id][bar] = 0;
                    } else if (current < MAX_PATTERNS - 1) {
                        state.clips[channel.id][bar] = current + 1;
                    } else {
                        state.clips[channel.id][bar] = null;
                    }
                    renderPlaylist();
                });
                cell.addEventListener('contextmenu', event => {
                    event.preventDefault();
                    const current = state.clips[channel.id][bar];
                    if (current === null) {
                        state.clips[channel.id][bar] = DISABLED_CLIP;
                    } else if (current === DISABLED_CLIP) {
                        state.clips[channel.id][bar] = null;
                    } else if (current > 0) {
                        state.clips[channel.id][bar] = current - 1;
                    } else {
                        state.clips[channel.id][bar] = DISABLED_CLIP;
                    }
                    renderPlaylist();
                });
                els.playlist.append(cell);
            });
        }

        const addColumn = document.createElement('button');
        addColumn.className = 'fb-playlist-column-button';
        addColumn.type = 'button';
        addColumn.disabled = state.barCount >= MAX_BARS;
        addColumn.innerHTML = '<i class="fa-solid fa-plus"></i>';
        addColumn.setAttribute('aria-label', state.barCount >= MAX_BARS ? 'maximum rows reached' : 'add playlist row');
        addColumn.addEventListener('click', addPlaylistColumn);
        els.playlist.append(addColumn);
        state.channels.forEach(() => {
            const spacer = document.createElement('div');
            spacer.className = 'fb-playlist-column-spacer';
            els.playlist.append(spacer);
        });
    }

    function renderMixer() {
        const channel = selectedChannel();
        ensureChannelEffects(channel);
        els.mixerLabel.textContent = 'mixer: ' + channel.name;
        renderEffectPicker();
        els.mixer.innerHTML = '';

        const strip = document.createElement('div');
        strip.className = 'fb-mixer-strip';
        const color = document.createElement('div');
        color.className = 'fb-mixer-strip-color';
        color.style.background = channel.color;
        const title = document.createElement('div');
        title.className = 'fb-mixer-strip-title';
        title.textContent = channel.name;
        const summary = document.createElement('div');
        summary.className = 'fb-mixer-strip-summary';
        summary.textContent = channel.effects.length
            ? channel.effects.length + ' effect' + (channel.effects.length === 1 ? '' : 's')
            : 'dry signal';
        strip.append(color, title, summary);
        els.mixer.append(strip);

        if (!channel.effects.length) {
            const empty = document.createElement('div');
            empty.className = 'fb-empty-state';
            empty.textContent = 'no effects on this channel';
            els.mixer.append(empty);
            return;
        }

        channel.effects.forEach((effect, index) => {
            const definition = effectDefinitions.get(effect.type);
            const card = document.createElement('div');
            card.className = 'fb-effect-card' + (effect.enabled ? '' : ' is-bypassed');

            const head = document.createElement('div');
            head.className = 'fb-effect-head';
            const name = document.createElement('div');
            name.className = 'fb-effect-name';
            name.textContent = definition ? definition.name : effect.type;
            const actions = document.createElement('div');
            actions.className = 'fb-effect-actions';

            const collapse = miniButton(effect.collapsed ? '<i class="fa-solid fa-chevron-down"></i>' : '<i class="fa-solid fa-chevron-up"></i>', effect.collapsed ? 'expand effect' : 'minimize effect', false);
            collapse.addEventListener('click', event => {
                event.stopPropagation();
                effect.collapsed = !effect.collapsed;
                renderMixer();
            });

            const bypass = miniButton(effect.enabled ? '<i class="fa-solid fa-power-off"></i>' : '<i class="fa-regular fa-circle"></i>', effect.enabled ? 'bypass effect' : 'enable effect', effect.enabled);
            bypass.addEventListener('click', event => {
                event.stopPropagation();
                effect.enabled = !effect.enabled;
                rebuildChannelOutput(channel);
                renderMixer();
                renderAutomation();
            });

            const up = miniButton('<i class="fa-solid fa-arrow-up"></i>', 'move effect up', false);
            up.disabled = index === 0;
            up.addEventListener('click', event => {
                event.stopPropagation();
                if (index <= 0) return;
                channel.effects.splice(index - 1, 0, channel.effects.splice(index, 1)[0]);
                rebuildChannelOutput(channel);
                renderMixer();
                renderAutomation();
            });

            const down = miniButton('<i class="fa-solid fa-arrow-down"></i>', 'move effect down', false);
            down.disabled = index >= channel.effects.length - 1;
            down.addEventListener('click', event => {
                event.stopPropagation();
                if (index >= channel.effects.length - 1) return;
                channel.effects.splice(index + 1, 0, channel.effects.splice(index, 1)[0]);
                rebuildChannelOutput(channel);
                renderMixer();
                renderAutomation();
            });

            const remove = miniButton('<i class="fa-solid fa-trash"></i>', 'remove effect', false);
            remove.classList.add('fb-remove-button');
            remove.addEventListener('click', event => {
                event.stopPropagation();
                channel.effects.splice(index, 1);
                rebuildChannelOutput(channel);
                renderMixer();
                renderAutomation();
            });

            actions.append(collapse, bypass, up, down, remove);
            head.append(name, actions);
            card.append(head);

            if (effect.collapsed) {
                const summary = document.createElement('div');
                summary.className = 'fb-effect-summary';
                summary.textContent = definition ? effectSummary(definition, effect) : 'effect definition missing';
                card.append(summary);
            } else if (!definition) {
                const missing = document.createElement('div');
                missing.className = 'fb-empty-state';
                missing.textContent = 'effect definition missing';
                card.append(missing);
            } else {
                syncEffectSettings(definition, effect);
                const presets = renderEffectPresets(channel, effect, definition);
                if (presets) card.append(presets);
                if (typeof definition.renderGui === 'function') {
                    const custom = definition.renderGui({
                        channel,
                        effect,
                        definition,
                        settings: effect.settings,
                        params: definition.params || [],
                        setParam: (paramId, value) => setEffectParamById(channel, effect, definition, paramId, value),
                        rebuild: () => rebuildChannelOutput(channel),
                        stepSeconds,
                        makeField: field,
                        controls: { range, numberInput, select }
                    });
                    if (custom instanceof Node) {
                        card.append(custom);
                    } else {
                        card.append(renderDefaultEffectControls(channel, effect, definition));
                    }
                } else {
                    card.append(renderDefaultEffectControls(channel, effect, definition));
                }
            }

            els.mixer.append(card);
        });
    }

    function renderAutomationTargetPicker(channel = selectedChannel()) {
        if (!els.automationTarget) return;
        const selected = els.automationTarget.value;
        const targets = automationTargets(channel).filter(target => target.param);
        els.automationTarget.innerHTML = '';
        targets.forEach(target => {
            const option = document.createElement('option');
            option.value = target.id;
            option.textContent = target.label;
            els.automationTarget.append(option);
        });
        const hasTargets = targets.length > 0;
        els.automationTarget.disabled = !hasTargets;
        if (els.addAutomation) els.addAutomation.disabled = !hasTargets;
        if (hasTargets) {
            els.automationTarget.value = targets.some(target => target.id === selected) ? selected : targets[0].id;
        }
    }

    function renderAutomation(updatePicker = true) {
        if (!els.automation) return;
        const channel = selectedChannel();
        ensureChannelAutomation(channel);
        const patternIndex = normalizeAutomationPatternIndex(channel.activePattern || 0);
        if (els.automationLabel) els.automationLabel.textContent = 'automate: ' + channel.name + ' / pattern ' + (patternIndex + 1);
        renderAutomationPatternOptions(channel);
        if (updatePicker) renderAutomationTargetPicker(channel);
        els.automation.innerHTML = '';

        const help = document.createElement('div');
        help.className = 'fb-automation-help';
        help.textContent = 'automation edits only the selected pattern. click cells to set values, drag to draw, right-click or shift-click to blank a cell.';
        els.automation.append(help);

        if (!channel.automation.length) {
            const empty = document.createElement('div');
            empty.className = 'fb-empty-state';
            empty.textContent = 'no automation lanes yet';
            els.automation.append(empty);
            return;
        }

        let renderedLanes = 0;
        channel.automation.forEach((lane, index) => {
            const target = automationTargetForLane(channel, lane);
            if (!target) return;
            renderedLanes += 1;
            const card = document.createElement('div');
            card.className = 'fb-automation-lane' + (lane.enabled ? '' : ' is-bypassed');

            const head = document.createElement('div');
            head.className = 'fb-automation-head';
            const title = document.createElement('div');
            title.className = 'fb-automation-title';
            title.textContent = target.label;
            const actions = document.createElement('div');
            actions.className = 'fb-effect-actions';

            const mode = document.createElement('select');
            mode.className = 'fb-select fb-automation-mode';
            ['step', 'smooth'].forEach(value => {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = value;
                option.selected = lane.mode === value;
                mode.append(option);
            });
            mode.disabled = target.param.type === 'select';
            mode.addEventListener('change', () => {
                lane.mode = mode.value === 'smooth' ? 'smooth' : 'step';
                renderAutomation(false);
            });

            const enable = miniButton(lane.enabled ? '<i class="fa-solid fa-power-off"></i>' : '<i class="fa-regular fa-circle"></i>', lane.enabled ? 'disable lane' : 'enable lane', lane.enabled);
            enable.addEventListener('click', event => {
                event.stopPropagation();
                lane.enabled = !lane.enabled;
                renderAutomation(false);
            });

            const clear = miniButton('<i class="fa-solid fa-eraser"></i>', 'clear lane values', false);
            clear.addEventListener('click', event => {
                event.stopPropagation();
                setAutomationValuesForPattern(lane, patternIndex, []);
                renderAutomation(false);
                updateStatus('cleared automation for pattern ' + (patternIndex + 1));
            });

            const remove = miniButton('<i class="fa-solid fa-trash"></i>', 'remove lane', false);
            remove.classList.add('fb-remove-button');
            remove.addEventListener('click', event => {
                event.stopPropagation();
                channel.automation.splice(index, 1);
                renderAutomation();
            });

            actions.append(mode, enable, clear, remove);
            head.append(title, actions);

            const grid = document.createElement('div');
            grid.className = 'fb-automation-grid';
            grid.style.gridTemplateColumns = 'repeat(' + stepCount() + ', minmax(32px, 1fr))';
            for (let step = 0; step < stepCount(); step += 1) {
                grid.append(automationCell(channel, lane, target, step, patternIndex));
            }

            const footer = document.createElement('div');
            footer.className = 'fb-automation-footer';
            footer.textContent = automationLaneSummary(lane, target, patternIndex);

            card.append(head, grid, footer);
            els.automation.append(card);
        });
        if (!renderedLanes) {
            const missing = document.createElement('div');
            missing.className = 'fb-empty-state';
            missing.textContent = 'automation targets are loading or missing';
            els.automation.append(missing);
        }
    }

    function automationCell(channel, lane, target, step, patternIndex) {
        const cell = document.createElement('button');
        const values = automationValuesForPattern(lane, patternIndex, true);
        const rawValue = clampAutomationValue(target.param, values[step]);
        const resolvedValue = automationValueAtStep(lane, target.param, step, patternIndex);
        const hasValue = rawValue !== null;
        cell.className = 'fb-automation-cell' + (hasValue ? ' is-set' : '') + (!hasValue && resolvedValue !== null ? ' is-filled' : '');
        cell.type = 'button';
        cell.dataset.step = String(step);
        cell.textContent = automationValueLabel(target.param, hasValue ? rawValue : resolvedValue);
        if (resolvedValue !== null && target.param.type !== 'select') {
            const min = target.param.min ?? 0;
            const max = target.param.max ?? 1;
            const ratio = (Number(resolvedValue) - min) / Math.max(0.00001, max - min);
            cell.style.setProperty('--fb-automation-fill', (Math.max(0, Math.min(1, ratio)) * 100) + '%');
        }
        cell.setAttribute('aria-label', target.label + ' automation step ' + (step + 1));
        cell.addEventListener('click', event => {
            event.preventDefault();
            if (suppressAutomationClick) return;
            const laneValues = automationValuesForPattern(lane, patternIndex, true);
            const current = clampAutomationValue(target.param, laneValues[step]);
            if (event.shiftKey || current !== null) {
                laneValues[step] = null;
            } else {
                laneValues[step] = automationCurrentValue(channel, target);
            }
            setAutomationValuesForPattern(lane, patternIndex, laneValues);
            renderAutomation(false);
        });
        cell.addEventListener('pointerdown', event => {
            if (event.button !== 0 || target.param.type === 'select') return;
            event.preventDefault();
            suppressAutomationClick = true;
            cell.setPointerCapture(event.pointerId);
            setAutomationCellFromPointer(cell, lane, target.param, event, patternIndex);
            const move = moveEvent => {
                const element = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
                const targetCell = element && element.closest ? element.closest('.fb-automation-cell') : null;
                if (!targetCell || !targetCell.dataset.step) return;
                setAutomationCellFromPointer(targetCell, lane, target.param, moveEvent, patternIndex);
            };
            const up = () => {
                cell.removeEventListener('pointermove', move);
                cell.removeEventListener('pointerup', up);
                cell.removeEventListener('pointercancel', up);
                renderAutomation(false);
                window.setTimeout(() => {
                    suppressAutomationClick = false;
                }, 0);
            };
            cell.addEventListener('pointermove', move);
            cell.addEventListener('pointerup', up, { once: true });
            cell.addEventListener('pointercancel', up, { once: true });
        });
        cell.addEventListener('contextmenu', event => {
            event.preventDefault();
            const laneValues = automationValuesForPattern(lane, patternIndex, true);
            laneValues[step] = null;
            setAutomationValuesForPattern(lane, patternIndex, laneValues);
            renderAutomation(false);
        });
        return cell;
    }

    function setAutomationCellFromPointer(cell, lane, param, event, patternIndex) {
        const step = Number(cell.dataset.step);
        if (!Number.isInteger(step)) return;
        const rect = cell.getBoundingClientRect();
        const min = param.min ?? 0;
        const max = param.max ?? 1;
        const ratio = 1 - Math.max(0, Math.min(1, (event.clientY - rect.top) / Math.max(1, rect.height)));
        const raw = min + ((max - min) * ratio);
        const snap = Number(param.step) || 0.01;
        const value = Math.round(raw / snap) * snap;
        const values = automationValuesForPattern(lane, patternIndex, true);
        values[step] = Number(value.toFixed(5));
        setAutomationValuesForPattern(lane, patternIndex, values);
    }

    function automationCurrentValue(channel, target) {
        if (target.targetType === 'channel') return channel[target.paramId];
        if (target.targetType === 'synth') return channel.synthSettings[target.paramId];
        if (target.targetType === 'effect' && target.effect) return target.effect.settings[target.paramId];
        return target.param.default ?? target.param.min ?? 0;
    }

    function automationValueLabel(param, value) {
        if (value === null || value === undefined) return '-';
        if (param.type === 'select') return String(value);
        const decimals = Number(param.step) && Number(param.step) < 1 ? 2 : 0;
        return Number(value).toFixed(decimals).replace(/\.?0+$/, '') + (param.unit || '');
    }

    function automationLaneSummary(lane, target, patternIndex) {
        const values = automationValuesForPattern(lane, patternIndex, false);
        const count = values.filter(value => clampAutomationValue(target.param, value) !== null).length;
        const type = target.param.type === 'select' ? 'stepped' : lane.mode;
        return 'pattern ' + (patternIndex + 1) + ' / ' + count + ' point' + (count === 1 ? '' : 's') + ' / ' + type;
    }

    function addAutomationLaneToSelectedChannel() {
        const channel = selectedChannel();
        const targetId = els.automationTarget ? els.automationTarget.value : '';
        const target = automationTargets(channel).find(item => item.id === targetId);
        if (!target) {
            updateStatus('no automation target selected');
            return;
        }
        ensureChannelAutomation(channel);
        const existing = channel.automation.find(lane => {
            return lane.targetType === target.targetType
                && lane.effectId === (target.effectId || '')
                && lane.paramId === target.paramId;
        });
        if (existing) {
            updateStatus('automation lane already exists');
            return;
        }
        channel.automation.push({
            id: 'automation-' + Date.now() + '-' + Math.random().toString(16).slice(2),
            targetType: target.targetType,
            effectId: target.effectId || '',
            paramId: target.paramId,
            enabled: true,
            collapsed: false,
            mode: target.param.type === 'select' ? 'step' : 'smooth',
            valuesByPattern: {
                [String(normalizeAutomationPatternIndex(channel.activePattern || 0))]: resizeAutomationValues([])
            }
        });
        renderAutomation();
        updateStatus('added automation for ' + target.label);
    }

    function renderEffectPresets(channel, effect, definition) {
        const presets = Array.isArray(definition.presets) ? definition.presets.filter(preset => preset && preset.name && preset.settings) : [];
        if (!presets.length) return null;
        const wrap = document.createElement('label');
        wrap.className = 'fb-effect-preset';
        const label = document.createElement('span');
        label.textContent = 'preset';
        const picker = document.createElement('select');
        picker.className = 'fb-select';
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = 'choose preset...';
        picker.append(placeholder);
        presets.forEach(preset => {
            const option = document.createElement('option');
            option.value = preset.name;
            option.textContent = preset.name;
            picker.append(option);
        });
        picker.addEventListener('change', () => {
            const preset = presets.find(item => item.name === picker.value);
            if (!preset) return;
            effect.settings = normalizeEffectSettings(definition, { ...effect.settings, ...preset.settings });
            rebuildChannelOutput(channel);
            renderMixer();
            renderAutomation();
            updateStatus('loaded ' + preset.name + ' preset');
        });
        wrap.append(label, picker);
        return wrap;
    }

    function effectSummary(definition, effect) {
        syncEffectSettings(definition, effect);
        const params = (definition.params || []).slice(0, 3);
        if (!params.length) return 'custom effect';
        return params.map(param => {
            const value = effect.settings[param.id];
            const suffix = param.unit || '';
            return (param.label || param.id) + ': ' + value + suffix;
        }).join(' / ');
    }

    function renderDefaultEffectControls(channel, effect, definition) {
        const controls = document.createElement('div');
        controls.className = 'fb-effect-controls';
        definition.params.forEach(param => {
            controls.append(effectParamControl(channel, effect, definition, param));
        });
        return controls;
    }

    function effectParamControl(channel, effect, definition, param) {
        const wrap = document.createElement('label');
        wrap.className = 'fb-field';
        const label = document.createElement('span');
        label.textContent = param.label || param.id;
        let control;
        if (param.type === 'select') {
            control = select(param.options || [], effect.settings[param.id], value => {
                setEffectParam(channel, effect, definition, param, value);
            });
        } else if (param.type === 'number') {
            control = numberInput(effect.settings[param.id], param.min ?? 0, param.max ?? 1, param.step ?? 1, value => {
                setEffectParam(channel, effect, definition, param, value);
            });
        } else {
            control = range(effect.settings[param.id], param.min ?? 0, param.max ?? 1, param.step ?? 0.01, value => {
                setEffectParam(channel, effect, definition, param, value);
            });
        }
        control.setAttribute('aria-label', (definition.name || effect.type) + ' ' + (param.label || param.id));
        wrap.append(label, control);
        return wrap;
    }

    function addEffectToSelectedChannel() {
        const channel = selectedChannel();
        const type = els.effectPicker.value;
        const definition = effectDefinitions.get(type);
        if (!definition) {
            updateStatus('no effect selected');
            return;
        }
        ensureChannelEffects(channel);
        channel.effects.push({
            id: 'effect-' + Date.now() + '-' + Math.random().toString(16).slice(2),
            type,
            enabled: true,
            collapsed: true,
            settings: normalizeEffectSettings(definition)
        });
        rebuildChannelOutput(channel);
        renderMixer();
        renderAutomation();
        updateStatus('added ' + definition.name + ' to ' + channel.name);
    }

    function selectedSampleEditorNote(channel = selectedChannel()) {
        const note = channel.sampleEditorNote;
        return typeof note === 'string' && /^([A-G]#?)([1-6])$/.test(note) ? note : 'C4';
    }

    function syncWaveformTab() {
        if (!els.waveformTab) return;
        const enabled = selectedChannel().source === 'sample';
        els.waveformTab.disabled = !enabled;
        els.waveformTab.setAttribute('data-tooltip', enabled ? 'edit sample waveform' : 'select a sample instrument first');
        if (!enabled && currentView === 'waveform') showView('roll');
    }

    function syncSynthTab() {
        if (!els.synthTab) return;
        const enabled = selectedChannel().source === 'synth';
        els.synthTab.disabled = !enabled;
        els.synthTab.setAttribute('data-tooltip', enabled ? 'edit synth instrument' : 'select a synth instrument first');
        if (!enabled && currentView === 'synth') showView('roll');
    }

    function renderSynthEditor() {
        if (!els.synthEditor) return;
        const channel = selectedChannel();
        syncSynthTab();
        els.synthLabel.textContent = channel.source === 'synth' ? 'synth: ' + channel.name : 'synth';
        els.synthEditor.innerHTML = '';
        if (channel.source !== 'synth') {
            const empty = document.createElement('div');
            empty.className = 'fb-empty-state';
            empty.textContent = 'select a synth instrument';
            els.synthEditor.append(empty);
            return;
        }
        const definition = synthDefinitionForChannel(channel);
        if (!definition) {
            const empty = document.createElement('div');
            empty.className = 'fb-empty-state';
            empty.textContent = 'loading synths';
            els.synthEditor.append(empty);
            return;
        }
        ensureChannelSynth(channel);
        const head = document.createElement('div');
        head.className = 'fb-synth-editor-head';
        const title = document.createElement('div');
        title.className = 'fb-synth-editor-title';
        title.textContent = definition.name;
        const picker = synthInput(channel);
        const presetPicker = renderSynthPresets(channel, definition);
        head.append(title, picker);
        if (presetPicker) head.append(presetPicker);
        els.synthEditor.append(head);
        const stage = document.createElement('div');
        stage.className = 'fb-synth-stage';
        if (typeof definition.renderGui === 'function') {
            const custom = definition.renderGui({
                channel,
                definition,
                settings: channel.synthSettings,
                params: definition.params || [],
                setParam: (paramId, value) => setSynthParamById(channel, definition, paramId, value),
                stepSeconds,
                makeField: field,
                controls: { range, numberInput, select }
            });
            if (custom instanceof Node) {
                stage.append(custom);
                els.synthEditor.append(stage);
                return;
            }
        }
        stage.append(renderDefaultSynthControls(channel, definition));
        els.synthEditor.append(stage);
    }

    function renderSynthPresets(channel, definition) {
        const presets = Array.isArray(definition.presets) ? definition.presets.filter(preset => preset && preset.name && preset.settings) : [];
        if (!presets.length) return null;
        const wrap = document.createElement('label');
        wrap.className = 'fb-synth-preset';
        const label = document.createElement('span');
        label.textContent = 'preset';
        const picker = document.createElement('select');
        picker.className = 'fb-select';
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = 'choose preset...';
        picker.append(placeholder);
        presets.forEach(preset => {
            const option = document.createElement('option');
            option.value = preset.name;
            option.textContent = preset.name;
            picker.append(option);
        });
        picker.addEventListener('change', () => {
            const preset = presets.find(item => item.name === picker.value);
            if (!preset) return;
            channel.synthSettings = normalizeParamSettings(definition, { ...channel.synthSettings, ...preset.settings });
            renderSynthEditor();
            updateStatus('loaded ' + preset.name + ' synth preset');
        });
        wrap.append(label, picker);
        return wrap;
    }

    function renderDefaultSynthControls(channel, definition) {
        const controls = document.createElement('div');
        controls.className = 'fb-synth-controls';
        (definition.params || []).forEach(param => {
            const wrap = document.createElement('label');
            wrap.className = 'fb-field';
            const label = document.createElement('span');
            label.textContent = param.label || param.id;
            let control;
            if (param.type === 'select') {
                control = select(param.options || [], channel.synthSettings[param.id], value => setSynthParam(channel, definition, param, value));
            } else if (param.type === 'number') {
                control = numberInput(channel.synthSettings[param.id], param.min ?? 0, param.max ?? 1, param.step ?? 1, value => setSynthParam(channel, definition, param, value));
            } else {
                control = range(channel.synthSettings[param.id], param.min ?? 0, param.max ?? 1, param.step ?? 0.01, value => setSynthParam(channel, definition, param, value));
            }
            control.setAttribute('aria-label', (definition.name || channel.synthType) + ' ' + (param.label || param.id));
            wrap.append(label, control);
            controls.append(wrap);
        });
        return controls;
    }

    function renderSampleEditor() {
        if (!els.sampleCanvas) return;
        const channel = selectedChannel();
        syncWaveformTab();
        els.waveformLabel.textContent = channel.source === 'sample' ? 'waveform: ' + channel.name : 'waveform';
        drawSampleEditor();
    }

    function sampleEditorRect() {
        const canvas = els.sampleCanvas;
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const cssWidth = Math.max(1, Math.round(rect.width || canvas.clientWidth || 900));
        const cssHeight = Math.max(1, Math.min(360, Math.round(rect.height || canvas.clientHeight || 300)));
        if (canvas.width !== Math.round(cssWidth * dpr) || canvas.height !== Math.round(cssHeight * dpr)) {
            canvas.width = Math.round(cssWidth * dpr);
            canvas.height = Math.round(cssHeight * dpr);
        }
        return { canvas, dpr, width: cssWidth, height: cssHeight };
    }

    function sampleEditorZoom(channel = selectedChannel()) {
        const zoom = Math.max(1, Math.min(32, Number(channel.sampleEditorZoom) || 1));
        const span = 1 / zoom;
        const start = Math.max(0, Math.min(1 - span, Number(channel.sampleEditorOffset) || 0));
        channel.sampleEditorZoom = zoom;
        channel.sampleEditorOffset = start;
        return { zoom, start, end: start + span, span };
    }

    function sampleRatioToX(channel, ratio, width) {
        const view = sampleEditorZoom(channel);
        return ((ratio - view.start) / view.span) * width;
    }

    function sampleXToRatio(channel, x) {
        const view = sampleEditorZoom(channel);
        return Math.max(0, Math.min(1, view.start + (x * view.span)));
    }

    function setSampleEditorZoom(multiplier) {
        const channel = selectedChannel();
        if (channel.source !== 'sample') return;
        const view = sampleEditorZoom(channel);
        const center = view.start + (view.span / 2);
        const zoom = Math.max(1, Math.min(32, view.zoom * multiplier));
        const span = 1 / zoom;
        channel.sampleEditorZoom = zoom;
        channel.sampleEditorOffset = Math.max(0, Math.min(1 - span, center - (span / 2)));
        drawSampleEditor();
    }

    function panSampleEditor(delta) {
        const channel = selectedChannel();
        const view = sampleEditorZoom(channel);
        if (view.zoom <= 1) return;
        channel.sampleEditorOffset = Math.max(0, Math.min(1 - view.span, view.start + (delta * view.span)));
        drawSampleEditor();
    }

    function sampleMarkerHitRatio() {
        const rect = els.sampleCanvas.getBoundingClientRect();
        return sampleEditorZoom().span * (14 / Math.max(1, rect.width || els.sampleCanvas.clientWidth || 900));
    }

    function drawSampleMarker(ctx, x, height, color, dashed = false) {
        if (x < 0 || x > ctx.canvas.width) return;
        ctx.save();
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 2;
        if (dashed) ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillRect(x - 7, 0, 14, 8);
        ctx.fillRect(x - 7, height - 8, 14, 8);
        ctx.restore();
    }

    function drawSampleEditor() {
        if (!els.sampleCanvas) return;
        const { canvas, dpr, width, height } = sampleEditorRect();
        const ctx = canvas.getContext('2d');
        const channel = selectedChannel();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#050505';
        ctx.fillRect(0, 0, width, height);
        if (channel.source !== 'sample') {
            ctx.fillStyle = '#977eb6';
            ctx.fillText('select a sample instrument', 16, 28);
            return;
        }
        if (!channel.sampleBuffer) makeSyntheticKick(channel);
        ensureSampleZones(channel);
        const buffer = channel.sampleBuffer;
        const data = buffer.getChannelData(0);
        const view = sampleEditorZoom(channel);
        if (els.sampleScroll) {
            els.sampleScroll.disabled = view.zoom <= 1;
            els.sampleScroll.max = String(Math.max(0, 1 - view.span));
            els.sampleScroll.step = String(Math.max(0.0001, view.span / 200));
            els.sampleScroll.value = String(view.start);
        }
        const waveH = Math.floor(height * 0.68);
        const laneY = waveH + 12;
        const laneH = height - laneY - 10;
        ctx.strokeStyle = 'rgba(60, 120, 149, 0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, waveH / 2);
        ctx.lineTo(width, waveH / 2);
        ctx.stroke();
        ctx.strokeStyle = '#86d3cf';
        ctx.beginPath();
        for (let x = 0; x < width; x += 1) {
            const start = Math.floor((view.start + ((x / width) * view.span)) * data.length);
            const end = Math.max(start + 1, Math.floor((view.start + (((x + 1) / width) * view.span)) * data.length));
            let min = 1;
            let max = -1;
            for (let i = start; i < end; i += 1) {
                min = Math.min(min, data[i]);
                max = Math.max(max, data[i]);
            }
            ctx.moveTo(x, (waveH / 2) - (max * waveH * 0.42));
            ctx.lineTo(x, (waveH / 2) - (min * waveH * 0.42));
        }
        ctx.stroke();

        const startX = sampleRatioToX(channel, sampleTrimValue(channel.sampleStart, 0), width);
        const endX = sampleRatioToX(channel, sampleTrimValue(channel.sampleEnd, 1), width);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.48)';
        ctx.fillRect(0, 0, Math.max(0, startX), waveH);
        ctx.fillRect(Math.min(width, endX), 0, width - Math.min(width, endX), waveH);
        ctx.strokeStyle = '#c88420';
        [startX, endX].forEach(x => drawSampleMarker(ctx, x, waveH, '#c88420'));

        ctx.fillStyle = 'rgba(60, 120, 149, 0.14)';
        ctx.fillRect(0, laneY, width, laneH);
        const selectedNote = selectedSampleEditorNote(channel);
        channel.sampleZones.forEach(zone => {
            const x = sampleRatioToX(channel, zone.start, width);
            const zoneEndX = sampleRatioToX(channel, zone.end, width);
            if (zoneEndX < 0 || x > width) return;
            const w = Math.max(3, zoneEndX - x);
            ctx.fillStyle = zone.note === selectedNote ? 'rgba(134, 211, 207, 0.72)' : 'rgba(151, 126, 182, 0.52)';
            ctx.fillRect(x, laneY + 4, w, laneH - 8);
            ctx.strokeStyle = zone.note === selectedNote ? '#86d3cf' : '#977eb6';
            ctx.strokeRect(x, laneY + 4, w, laneH - 8);
            ctx.fillStyle = '#050505';
            ctx.font = '12px monospace';
            ctx.fillText(zone.note, x + 5, laneY + 22);
        });
        const playhead = activeSamplePlayheadFor(channel);
        const playheadRatio = samplePlayheadRatio(playhead);
        if (playheadRatio !== null) {
            const playheadX = sampleRatioToX(channel, playheadRatio, width);
            if (playheadX >= 0 && playheadX <= width) {
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(playheadX, 0);
                ctx.lineTo(playheadX, height);
                ctx.stroke();
            }
        }
        els.sampleEditorStatus.textContent = 'zoom: ' + view.zoom + 'x / trim: ' + Math.round(channel.sampleStart * 100) + '%-' + Math.round(channel.sampleEnd * 100) + '% / selected: ' + selectedNote;
    }

    function removeSampleZone() {
        const channel = selectedChannel();
        const note = selectedSampleEditorNote(channel);
        channel.sampleZones = ensureSampleZones(channel).filter(zone => zone.note !== note);
        drawSampleEditor();
    }

    function sampleEditorPosition(event) {
        const rect = els.sampleCanvas.getBoundingClientRect();
        const channel = selectedChannel();
        const localX = Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width)));
        return {
            x: sampleXToRatio(channel, localX),
            y: Math.max(0, Math.min(1, (event.clientY - rect.top) / Math.max(1, rect.height)))
        };
    }

    function beginSampleEditorDrag(event) {
        const channel = selectedChannel();
        if (channel.source !== 'sample' || event.button !== 0) return;
        event.preventDefault();
        const pos = sampleEditorPosition(event);
        const zones = ensureSampleZones(channel);
        const markerHit = Math.max(0.006, sampleMarkerHitRatio());
        const nearStart = Math.abs(pos.x - sampleTrimValue(channel.sampleStart, 0)) < markerHit;
        const nearEnd = Math.abs(pos.x - sampleTrimValue(channel.sampleEnd, 1)) < markerHit;
        if (pos.y < 0.72 && (nearStart || nearEnd)) {
            sampleEditorDrag = { type: nearStart ? 'trim-start' : 'trim-end' };
        } else {
            let zone = zones.find(item => pos.x >= item.start && pos.x <= item.end) || zones.find(item => item.note === selectedSampleEditorNote(channel));
            if (!zone) return;
            channel.sampleEditorNote = zone.note;
            const nearZoneStart = Math.abs(pos.x - zone.start) < 0.025;
            const nearZoneEnd = Math.abs(pos.x - zone.end) < 0.025;
            sampleEditorDrag = {
                type: nearZoneStart ? 'zone-start' : nearZoneEnd ? 'zone-end' : 'zone-move',
                note: zone.note,
                offset: pos.x - zone.start,
                width: zone.end - zone.start
            };
        }
        moveSampleEditorDrag(event);
    }

    function moveSampleEditorDrag(event) {
        if (!sampleEditorDrag) return;
        event.preventDefault();
        const channel = selectedChannel();
        const pos = sampleEditorPosition(event);
        if (sampleEditorDrag.type === 'trim-start') {
            channel.sampleStart = Math.max(0, Math.min(pos.x, sampleTrimValue(channel.sampleEnd, 1) - 0.01));
        } else if (sampleEditorDrag.type === 'trim-end') {
            channel.sampleEnd = Math.min(1, Math.max(pos.x, sampleTrimValue(channel.sampleStart, 0) + 0.01));
        } else {
            const zone = sampleZoneForNote(channel, sampleEditorDrag.note);
            if (!zone) return;
            if (sampleEditorDrag.type === 'zone-start') {
                zone.start = Math.max(0, Math.min(pos.x, zone.end - 0.01));
            } else if (sampleEditorDrag.type === 'zone-end') {
                zone.end = Math.min(1, Math.max(pos.x, zone.start + 0.01));
            } else {
                const width = sampleEditorDrag.width;
                zone.start = Math.max(0, Math.min(1 - width, pos.x - sampleEditorDrag.offset));
                zone.end = zone.start + width;
            }
        }
        drawSampleEditor();
    }

    function endSampleEditorDrag() {
        sampleEditorDrag = null;
    }

    function createSampleZoneAt(channel, note, start) {
        ensureSampleZones(channel);
        const zoneStart = Math.max(0, Math.min(0.99, start));
        const zoneEnd = Math.min(1, Math.max(zoneStart + 0.01, zoneStart + 0.16));
        const existing = sampleZoneForNote(channel, note);
        if (existing) {
            existing.start = zoneStart;
            existing.end = zoneEnd;
        } else {
            channel.sampleZones.push({ note, start: zoneStart, end: zoneEnd });
        }
        channel.sampleEditorNote = note;
        drawSampleEditor();
    }

    function showSampleZonePopup(event) {
        const channel = selectedChannel();
        if (channel.source !== 'sample') return;
        const pos = sampleEditorPosition(event);
        if (pos.y < 0.72) return;
        event.preventDefault();
        closeVelocityEditor();
        document.querySelectorAll('.fb-zone-popover').forEach(popover => popover.remove());

        const popover = document.createElement('div');
        popover.className = 'fb-zone-popover';
        const title = document.createElement('div');
        title.className = 'fb-zone-popover-title';
        title.textContent = 'create note zone';
        const keySelect = document.createElement('select');
        keySelect.className = 'fb-select';
        CHROMATIC.forEach(key => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = key;
            keySelect.append(option);
        });
        const octaveSelect = document.createElement('select');
        octaveSelect.className = 'fb-select';
        for (let octave = 1; octave <= 6; octave += 1) {
            const option = document.createElement('option');
            option.value = String(octave);
            option.textContent = String(octave);
            octaveSelect.append(option);
        }
        const selected = /^([A-G]#?)([1-6])$/.exec(selectedSampleEditorNote(channel));
        keySelect.value = selected ? selected[1] : 'C';
        octaveSelect.value = selected ? selected[2] : '4';
        const hint = document.createElement('div');
        hint.className = 'fb-zone-popover-hint';
        hint.textContent = 'or press a keyboard key';
        const actions = document.createElement('div');
        actions.className = 'fb-confirm-actions';
        const cancel = document.createElement('button');
        cancel.className = 'fb-button';
        cancel.type = 'button';
        cancel.textContent = 'cancel';
        const create = document.createElement('button');
        create.className = 'fb-button fb-confirm-ok';
        create.type = 'button';
        create.textContent = 'create';
        actions.append(cancel, create);
        popover.append(title, keySelect, octaveSelect, hint, actions);
        document.body.append(popover);

        const close = () => {
            document.removeEventListener('keydown', onKeydown, true);
            document.removeEventListener('click', onOutside, true);
            popover.remove();
        };
        const commit = note => {
            createSampleZoneAt(channel, note, pos.x);
            close();
        };
        const onKeydown = keyEvent => {
            if (keyEvent.key === 'Escape') {
                keyEvent.preventDefault();
                close();
                return;
            }
            const note = keyboardNote(keyEvent);
            if (note) {
                keyEvent.preventDefault();
                commit(note);
            }
        };
        const onOutside = clickEvent => {
            if (!popover.contains(clickEvent.target)) close();
        };
        cancel.addEventListener('click', close);
        create.addEventListener('click', () => commit(keySelect.value + octaveSelect.value));
        document.addEventListener('keydown', onKeydown, true);
        window.setTimeout(() => document.addEventListener('click', onOutside, true), 0);

        const rect = popover.getBoundingClientRect();
        popover.style.left = Math.min(window.innerWidth - rect.width - 8, Math.max(8, event.clientX)) + 'px';
        popover.style.top = Math.min(window.innerHeight - rect.height - 8, Math.max(8, event.clientY)) + 'px';
        keySelect.focus();
    }

    function addPlaylistColumn() {
        if (state.barCount >= MAX_BARS) {
            updateStatus('playlist is already at 128 rows');
            return;
        }
        clearFloatingTooltips();
        const newBar = state.barCount;
        state.barCount += 1;
        ensureClipMap();
        state.channels.forEach(channel => {
            state.clips[channel.id][newBar] = DISABLED_CLIP;
        });
        renderPlaylist();
        updateStatus('added playlist row ' + state.barCount);
    }

    function removePlaylistColumn(barIndex) {
        if (state.barCount <= 1) {
            updateStatus('keep at least one playlist row');
            return;
        }
        const removedColumn = Math.max(0, Math.min(state.barCount - 1, Number(barIndex) || 0));
        clearFloatingTooltips();
        state.barCount -= 1;
        currentBar = currentBar > removedColumn ? currentBar - 1 : Math.min(currentBar, state.barCount - 1);
        if (state.loopRange) {
            if (state.loopRange.start === removedColumn && state.loopRange.end === removedColumn) {
                state.loopRange = null;
            } else {
                state.loopRange = {
                    start: state.loopRange.start > removedColumn ? state.loopRange.start - 1 : state.loopRange.start,
                    end: state.loopRange.end >= removedColumn ? state.loopRange.end - 1 : state.loopRange.end
                };
                if (state.loopRange.end < state.loopRange.start) state.loopRange = null;
            }
        }
        state.channels.forEach(channel => {
            if (Array.isArray(state.clips[channel.id])) state.clips[channel.id].splice(removedColumn, 1);
        });
        ensureClipMap();
        renderPlaylist();
        updateStatus('deleted playlist row ' + (removedColumn + 1));
    }

    function resizeActiveNote(clientX, clientY = null) {
        if (!resizingNote) return;
        if (!resizingNote.locked) {
            const deltaX = clientX - resizingNote.startX;
            const deltaY = clientY === null ? 0 : clientY - resizingNote.startY;
            if (Math.abs(deltaY) > 5 && Math.abs(deltaY) > Math.abs(deltaX)) {
                slidingNote = {
                    channel: resizingNote.channel,
                    pattern: resizingNote.pattern,
                    step: resizingNote.step,
                    note: resizingNote.note,
                    eventIndex: resizingNote.eventIndex,
                    block: resizingNote.block,
                    startY: resizingNote.startY,
                    dragged: false
                };
                resizingNote = null;
                slideActiveNote(clientX, clientY);
                return;
            }
            if (Math.abs(deltaX) < 4) return;
            resizingNote.locked = true;
        }
        const rawLength = noteLengthAtPointer(resizingNote.step, clientX);
        const length = Math.max(noteLengthSnap, Math.min(stepCount() - resizingNote.step, snapNoteLength(rawLength)));
        const events = getStepEvents(resizingNote.pattern, resizingNote.step);
        const event = events[resizingNote.eventIndex];
        if (!event || event.note !== resizingNote.note) return;
        event.length = length;
        resizingNote.channel.pattern = resizingNote.pattern;
        setNoteBlockLengthStyles(resizingNote.block, resizingNote.handle, resizingNote.step, length);
    }

    function noteUnderPointer(clientY) {
        const labels = Array.from(els.pianoRoll.querySelectorAll('.fb-note-label[data-note]'));
        for (const label of labels) {
            const rect = label.getBoundingClientRect();
            if (clientY >= rect.top && clientY <= rect.bottom) return label.dataset.note;
        }
        return null;
    }

    function rollNoteAtPointer(clientX, clientY) {
        const target = document.elementFromPoint(clientX, clientY);
        const noteEl = target && target.closest('.fb-cell[data-note], .fb-note-label[data-note], .fb-note-block[data-note]');
        if (noteEl && els.pianoRoll.contains(noteEl) && noteEl.dataset.note) return noteEl.dataset.note;
        return noteUnderPointer(clientY);
    }

    function rollStepAtPointer(clientX, clientY) {
        const target = document.elementFromPoint(clientX, clientY);
        const stepEl = target && target.closest('.fb-cell[data-step], .fb-bar-label[data-step], .fb-note-block[data-step]');
        if (stepEl && els.pianoRoll.contains(stepEl) && stepEl.dataset.step !== undefined) {
            return Math.max(0, Math.min(stepCount() - 1, Number(stepEl.dataset.step) || 0));
        }
        const labels = Array.from(els.pianoRoll.querySelectorAll('.fb-bar-label[data-step]'));
        let closest = null;
        let closestDistance = Infinity;
        for (const label of labels) {
            const rect = label.getBoundingClientRect();
            const center = rect.left + (rect.width / 2);
            const distance = Math.abs(clientX - center);
            if (distance < closestDistance) {
                closestDistance = distance;
                closest = Number(label.dataset.step) || 0;
            }
        }
        return closest;
    }

    function slideActiveNote(clientX, clientY) {
        if (!slidingNote) return;
        if (!slidingNote.dragged && Math.abs(clientY - slidingNote.startY) < 5) return;
        const note = noteUnderPointer(clientY);
        if (!note) return;
        const events = getStepEvents(slidingNote.pattern, slidingNote.step);
        const event = events[slidingNote.eventIndex];
        if (!event || event.note !== slidingNote.note) return;
        slidingNote.dragged = true;
        suppressRollClick = true;
        if (note === slidingNote.note) {
            delete event.slideTo;
            if (slidingNote.block) {
                slidingNote.block.classList.remove('is-slide');
                slidingNote.block.classList.add('is-sliding');
                delete slidingNote.block.dataset.slideTo;
                slidingNote.block.removeAttribute('title');
                updateSlideDragLabel(slidingNote.block, 'no slide');
            }
            return;
        }
        event.slideTo = note;
        if (slidingNote.block) {
            slidingNote.block.classList.add('is-slide');
            slidingNote.block.classList.add('is-sliding');
            slidingNote.block.dataset.slideTo = note;
            slidingNote.block.title = 'slides to ' + note;
            updateSlideDragLabel(slidingNote.block, note);
        }
    }

    function moveNoteBlockDom(step, previousNote, note, eventIndex) {
        const oldCell = els.pianoRoll.querySelector('.fb-cell[data-step="' + step + '"][data-note="' + previousNote + '"]');
        const newCell = els.pianoRoll.querySelector('.fb-cell[data-step="' + step + '"][data-note="' + note + '"]');
        const oldBlock = oldCell ? oldCell.querySelector('.fb-note-block') : null;
        const oldHandle = oldCell ? oldCell.querySelector('.fb-note-resize') : null;
        if (!oldBlock || !newCell || newCell.querySelector('.fb-note-block')) return false;
        oldCell.classList.remove('is-on');
        oldCell.removeChild(oldBlock);
        if (oldHandle) oldCell.removeChild(oldHandle);
        oldBlock.dataset.note = note;
        oldBlock.dataset.eventIndex = String(eventIndex);
        oldBlock.classList.remove('is-slide');
        delete oldBlock.dataset.slideTo;
        oldBlock.removeAttribute('title');
        const slideText = oldBlock.querySelector('.fb-slide-text');
        if (slideText) slideText.remove();
        newCell.classList.add('is-on');
        newCell.append(oldBlock);
        if (oldHandle) {
            oldHandle.dataset.note = note;
            oldHandle.dataset.eventIndex = String(eventIndex);
            newCell.append(oldHandle);
        }
        return true;
    }

    function moveNoteVertically(state, clientX, clientY) {
        if (!state) return null;
        if (!state.dragged && Math.abs(clientY - state.startY) < 5) return null;
        const note = rollNoteAtPointer(clientX, clientY);
        if (!note || note === state.note) return null;
        state.pattern = getPattern(state.channel);
        const events = getStepEvents(state.pattern, state.step);
        if (events.some(item => item.note === note)) return null;
        const eventIndex = events.findIndex(item => item.note === state.note);
        if (eventIndex < 0) return null;
        const previousNote = state.note;
        const event = { ...events[eventIndex], note };
        delete event.slideTo;
        events.splice(eventIndex, 1, event);
        state.pattern[state.step] = events;
        state.dragged = true;
        suppressRollClick = true;
        state.noteEvent = event;
        state.eventIndex = eventIndex;
        state.note = note;
        state.channel.pattern = state.pattern;
        moveNoteBlockDom(state.step, previousNote, note, eventIndex);
        return event;
    }

    function movePlacedNote(clientX, clientY) {
        if (!placingNote) return;
        const event = moveNoteVertically(placingNote, clientX, clientY);
        if (!event) return;
        stopRollPreviewVoice(placingNote.pointerId);
        startRollPreviewVoice(placingNote.channel, event, placingNote.pointerId);
    }

    function moveExistingNote(clientX, clientY) {
        if (!movingNote) return;
        if (!movingNote.dragged && Math.abs(clientX - movingNote.startX) < 5) return;
        const targetStep = rollStepAtPointer(clientX, clientY);
        if (targetStep === null || targetStep === movingNote.step) return;
        movingNote.pattern = getPattern(movingNote.channel);
        const fromEvents = getStepEvents(movingNote.pattern, movingNote.step);
        const eventIndex = fromEvents.findIndex(item => item.note === movingNote.note);
        if (eventIndex < 0) return;
        const noteEvent = fromEvents[eventIndex];
        const maxStep = Math.max(0, Math.floor(stepCount() - noteLengthSteps(noteEvent)));
        const safeStep = Math.max(0, Math.min(maxStep, targetStep));
        if (safeStep === movingNote.step) return;
        const toEvents = getStepEvents(movingNote.pattern, safeStep);
        if (toEvents.some(item => item.note === movingNote.note)) return;
        fromEvents.splice(eventIndex, 1);
        movingNote.pattern[movingNote.step] = fromEvents;
        toEvents.push(noteEvent);
        movingNote.pattern[safeStep] = toEvents;
        movingNote.dragged = true;
        suppressRollClick = true;
        movingNote.channel.pattern = movingNote.pattern;
        movingNote.step = safeStep;
        movingNote.eventIndex = toEvents.length - 1;
        movingNote.noteEvent = noteEvent;
        renderRoll();
    }

    function updateSlideDragLabel(block, text) {
        let label = block.querySelector('.fb-slide-text');
        if (!label) {
            label = document.createElement('span');
            label.className = 'fb-slide-text';
            block.append(label);
        }
        label.textContent = text;
    }

    function removeNoteEvent(channel, pattern, step, note, eventIndex = null) {
        const events = getStepEvents(pattern, step);
        if (eventIndex !== null && events[eventIndex] && events[eventIndex].note === note) {
            events.splice(eventIndex, 1);
        } else {
            const index = events.findIndex(item => item.note === note);
            if (index > -1) events.splice(index, 1);
        }
        pattern[step] = events;
        channel.pattern = pattern;
    }

    function closeVelocityEditor() {
        if (!velocityEditor) return;
        velocityEditor.remove();
        velocityEditor = null;
    }

    function openVelocityEditor(block, event) {
        closeVelocityEditor();
        const channel = selectedChannel();
        const pattern = getPattern(channel);
        const step = Number(block.dataset.step);
        const eventIndex = Number(block.dataset.eventIndex);
        const events = getStepEvents(pattern, step);
        const noteEvent = events[eventIndex];
        if (!noteEvent || noteEvent.note !== block.dataset.note) return;

        const editor = document.createElement('div');
        editor.className = 'fb-velocity-popover';
        const label = document.createElement('span');
        label.textContent = 'velocity';
        const value = document.createElement('span');
        value.className = 'fb-velocity-value';
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '0';
        slider.max = '1';
        slider.step = '0.01';
        slider.value = String(noteVelocity(noteEvent));
        const syncValue = () => {
            const percent = Math.round(Number(slider.value) * 100);
            value.textContent = String(percent);
        };
        slider.addEventListener('input', () => {
            noteEvent.velocity = Math.max(0, Math.min(1, Number(slider.value) || 0));
            block.dataset.velocity = String(noteEvent.velocity);
            block.style.opacity = String(Math.max(0.28, noteEvent.velocity));
            channel.pattern = pattern;
            syncValue();
        });
        editor.append(label, slider, value);
        document.body.append(editor);
        const rect = editor.getBoundingClientRect();
        const x = Math.min(window.innerWidth - rect.width - 8, Math.max(8, event.clientX));
        const y = Math.min(window.innerHeight - rect.height - 8, Math.max(8, event.clientY));
        editor.style.left = x + 'px';
        editor.style.top = y + 'px';
        velocityEditor = editor;
        syncValue();
    }

    function noteBlockAtEvent(event) {
        const direct = event.target.closest('.fb-note-block');
        if (direct && els.pianoRoll.contains(direct)) return direct;
        const cell = event.target.closest('.fb-cell');
        const cellBlock = cell ? cell.querySelector('.fb-note-block') : null;
        if (cellBlock) return cellBlock;
        return Array.from(els.pianoRoll.querySelectorAll('.fb-note-block')).find(block => {
            const rect = block.getBoundingClientRect();
            return event.clientX >= rect.left
                && event.clientX <= rect.right
                && event.clientY >= rect.top
                && event.clientY <= rect.bottom;
        }) || null;
    }

    function placePianoRollNoteFromCell(cell) {
        const channel = selectedChannel();
        const pattern = getPattern(channel);
        const step = Number(cell.dataset.step);
        const note = cell.dataset.note;
        const events = getStepEvents(pattern, step);
        if (events.some(item => item.note === note)) return null;
        const noteEvent = { note, length: 1, velocity: 1 };
        events.push(noteEvent);
        channel.pattern = pattern;
        renderRoll();
        renderChannels();
        const renderedPattern = getPattern(channel);
        const renderedEvents = getStepEvents(renderedPattern, step);
        const renderedIndex = renderedEvents.findIndex(item => item.note === note);
        return {
            channel,
            pattern: renderedPattern,
            step,
            eventIndex: Math.max(0, renderedIndex),
            noteEvent: renderedEvents[renderedIndex] || noteEvent
        };
    }

    function handlePianoRollClick(event) {
        closeVelocityEditor();
        if (suppressRollClick) {
            event.preventDefault();
            event.stopPropagation();
            suppressRollClick = false;
            return;
        }
        if (resizingNote || slidingNote || event.target.closest('.fb-note-resize')) return;
        const channel = selectedChannel();
        const pattern = getPattern(channel);
        const block = event.target.closest('.fb-note-block');
        if (block && els.pianoRoll.contains(block)) {
            event.preventDefault();
            event.stopPropagation();
            const step = Number(block.dataset.step);
            const note = block.dataset.note;
            const eventIndex = Number(block.dataset.eventIndex);
            removeNoteEvent(channel, pattern, step, note, Number.isFinite(eventIndex) ? eventIndex : null);
            renderRoll();
            renderChannels();
            return;
        }

        const cell = event.target.closest('.fb-cell');
        if (!cell || !els.pianoRoll.contains(cell)) return;
        event.preventDefault();
        const placed = placePianoRollNoteFromCell(cell);
        if (placed) previewPianoRollNote(placed.channel, placed.noteEvent);
    }

    function handlePianoRollPointerDown(event) {
        if (event.button !== 0) return;
        const handle = event.target.closest('.fb-note-resize');

        const emptyCell = event.target.closest('.fb-cell');
        if (emptyCell && els.pianoRoll.contains(emptyCell) && !emptyCell.querySelector('.fb-note-block')) {
            event.preventDefault();
            event.stopPropagation();
            suppressRollClick = true;
            const placed = placePianoRollNoteFromCell(emptyCell);
            if (placed) {
                placingNote = {
                    channel: placed.channel,
                    pattern: placed.pattern,
                    step: placed.step,
                    eventIndex: placed.eventIndex,
                    noteEvent: placed.noteEvent,
                    note: placed.noteEvent.note,
                    pointerId: event.pointerId,
                    startY: event.clientY,
                    dragged: false
                };
                try {
                    els.pianoRoll.setPointerCapture(event.pointerId);
                } catch (_) {
                    /* no-op */
                }
                startRollPreviewVoice(placed.channel, placed.noteEvent, event.pointerId);
            }
            return;
        }

        if (!handle || !els.pianoRoll.contains(handle)) {
            const block = event.target.closest('.fb-note-block');
            if (!block || !els.pianoRoll.contains(block)) return;
            const channel = selectedChannel();
            const pattern = getPattern(channel);
            const step = Number(block.dataset.step);
            const eventIndex = Number(block.dataset.eventIndex);
            const note = block.dataset.note;
            movingNote = {
                channel,
                pattern,
                step,
                note,
                eventIndex,
                noteEvent: getStepEvents(pattern, step)[eventIndex] || null,
                startX: event.clientX,
                startY: event.clientY,
                dragged: false
            };
            try {
                els.pianoRoll.setPointerCapture(event.pointerId);
            } catch (_) {
                /* no-op */
            }
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        const cell = handle.closest('.fb-cell');
        const block = cell ? cell.querySelector('.fb-note-block[data-step="' + handle.dataset.step + '"][data-note="' + handle.dataset.note + '"][data-event-index="' + handle.dataset.eventIndex + '"]') : null;
        if (!cell || !block) return;
        const channel = selectedChannel();
        const pattern = getPattern(channel);
        const step = Number(handle.dataset.step);
        const eventIndex = Number(handle.dataset.eventIndex);
        const note = handle.dataset.note;
        resizingNote = { channel, pattern, step, note, eventIndex, block, handle, startX: event.clientX, startY: event.clientY, locked: false };
        try {
            handle.setPointerCapture(event.pointerId);
        } catch (_) {
            /* no-op */
        }
    }

    els.pianoRoll.addEventListener('contextmenu', event => {
        if (event.target.closest('.fb-note-resize')) {
            event.preventDefault();
            return;
        }
        const block = noteBlockAtEvent(event);
        if (block) {
            event.preventDefault();
            event.stopPropagation();
            openVelocityEditor(block, event);
            return;
        }
        if (event.target.closest('.fb-cell')) event.preventDefault();
    });

    function paintPlaylistHead() {
        root.querySelectorAll('.fb-playlist .is-playing').forEach(el => el.classList.remove('is-playing'));
        root.querySelectorAll('.fb-playlist [data-bar="' + currentBar + '"]').forEach(el => el.classList.add('is-playing'));
    }

    function activeBars() {
        ensureClipMap();
        return Array.from({ length: state.barCount }, (_, bar) => {
            return state.channels.some(channel => state.clips[channel.id][bar] !== null && state.clips[channel.id][bar] !== DISABLED_CLIP);
        });
    }

    function usedBarCount() {
        const bars = activeBars();
        const last = bars.lastIndexOf(true);
        return Math.max(1, last + 1);
    }

    function projectToExportObject() {
        state.projectName = els.projectName.value.trim() || 'Untitled';
        return {
            format: 'frdgbeats',
            version: 1,
            ...JSON.parse(serialize())
        };
    }

    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function safeFilename(name, extension) {
        return (name || 'frdgbeats').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + extension;
    }

    async function exportProjectFile() {
        const progress = showExportProgress('saving..', 'collecting project data');
        await setExportProgress(progress, 12, 'collecting project data');
        const json = JSON.stringify(projectToExportObject(), null, 2);
        await setExportProgress(progress, 70, 'packing .frdgbeats file');
        downloadBlob(new Blob([json], { type: 'application/json' }), safeFilename(state.projectName, '.frdgbeats'));
        await setExportProgress(progress, 100, 'saved', 120);
        updateStatus('exported project');
        progress.close();
    }

    async function importProjectFile(file) {
        const progress = showExportProgress('importing...', 'reading .frdgbeats file');
        try {
            await setExportProgress(progress, 5, 'reading .frdgbeats file');
            const text = await file.text();
            await importProjectText(text, progress);
            await setExportProgress(progress, 100, 'imported project', 120);
        } finally {
            progress.close();
        }
    }

    async function importProjectText(text, progress = null) {
        const ownProgress = progress || showExportProgress('importing...', 'reading .frdgbeats file');
        try {
        await setExportProgress(ownProgress, progress ? 22 : 5, 'parsing project data');
        const project = JSON.parse(text);
        await setExportProgress(ownProgress, 45, 'loading project assets');
        await hydrate(project);
        await setExportProgress(ownProgress, 82, 'building project view');
        renderAll();
        updateStatus('imported project');
        if (!progress) {
            await setExportProgress(ownProgress, 100, 'imported project', 120);
            ownProgress.close();
        }
        } catch (error) {
            if (!progress) ownProgress.close();
            throw error;
        }
    }

    function writeVarLen(value) {
        let buffer = value & 0x7f;
        const bytes = [];
        while ((value >>= 7)) {
            buffer <<= 8;
            buffer |= ((value & 0x7f) | 0x80);
        }
        while (true) {
            bytes.push(buffer & 0xff);
            if (buffer & 0x80) buffer >>= 8;
            else break;
        }
        return bytes;
    }

    function noteNumber(note) {
        const parsed = /^([A-G]#?)([0-9])$/.exec(note || 'C4');
        if (!parsed) return 60;
        const offset = CHROMATIC.indexOf(parsed[1]);
        return 12 + (Number(parsed[2]) * 12) + offset;
    }

    function midiToNote(number) {
        const names = CHROMATIC;
        return names[number % 12] + Math.floor(number / 12 - 1);
    }

    async function exportMidi() {
        const progress = showExportProgress('rendering...', 'building MIDI events');
        await setExportProgress(progress, 8, 'building MIDI events');
        const ticksPerQuarter = 480;
        const ticksPerStep = ticksPerQuarter / 4;
        const bytes = [];
        const push = (...items) => bytes.push(...items);
        const text = (value) => Array.from(value).map(char => char.charCodeAt(0));
        push(...text('MThd'), 0, 0, 0, 6, 0, 1, 0, 1, ticksPerQuarter >> 8, ticksPerQuarter & 255);
        const track = [];
        const add = (delta, data) => track.push(...writeVarLen(delta), ...data);
        const pitchBendData = (midiChannel, normalized) => {
            const value = Math.max(0, Math.min(16383, Math.round(8192 + (Math.max(-1, Math.min(1, normalized)) * 8191))));
            return [0xe0 + midiChannel, value & 0x7f, (value >> 7) & 0x7f];
        };
        const tempo = Math.round(60000000 / state.bpm);
        add(0, [0xff, 0x51, 0x03, (tempo >> 16) & 255, (tempo >> 8) & 255, tempo & 255]);
        let lastTick = 0;
        const events = [];
        const barCount = usedBarCount();
        state.channels.forEach((channel, channelIndex) => {
            for (let bar = 0; bar < barCount; bar += 1) {
                const patternIndex = state.clips[channel.id] ? state.clips[channel.id][bar] : null;
                if (patternIndex === null || patternIndex === DISABLED_CLIP) continue;
                getPattern(channel, patternIndex).forEach((stepEvents, step) => {
                    getStepEvents(getPattern(channel, patternIndex), step).forEach(event => {
                        const tick = ((bar * stepCount()) + step) * ticksPerStep;
                        const midiNote = noteNumber(event.note);
                        const midiChannel = channelIndex % 16;
                        const velocity = Math.max(1, Math.min(127, Math.round(noteVelocity(event) * 127)));
                        const eventTicks = Math.max(1, Math.floor(ticksPerStep * noteLengthSteps(event)));
                        if (event.slideTo && event.slideTo !== event.note) {
                            const semitones = Math.max(-2, Math.min(2, noteNumber(event.slideTo) - midiNote));
                            events.push({ tick, data: pitchBendData(midiChannel, 0) });
                            events.push({ tick: tick + Math.max(1, eventTicks - 1), data: pitchBendData(midiChannel, semitones / 2) });
                            events.push({ tick: tick + eventTicks + 1, data: pitchBendData(midiChannel, 0) });
                        }
                        events.push({ tick, data: [0x90 + midiChannel, midiNote, velocity] });
                        events.push({ tick: tick + eventTicks, data: [0x80 + midiChannel, midiNote, 0] });
                    });
                });
            }
        });
        await setExportProgress(progress, 62, 'sorting MIDI notes');
        events.sort((a, b) => a.tick - b.tick || a.data[0] - b.data[0]);
        events.forEach(event => {
            add(Math.max(0, event.tick - lastTick), event.data);
            lastTick = event.tick;
        });
        add(0, [0xff, 0x2f, 0]);
        push(...text('MTrk'), (track.length >> 24) & 255, (track.length >> 16) & 255, (track.length >> 8) & 255, track.length & 255, ...track);
        await setExportProgress(progress, 88, 'saving MIDI file');
        downloadBlob(new Blob([new Uint8Array(bytes)], { type: 'audio/midi' }), safeFilename(state.projectName, '.mid'));
        await setExportProgress(progress, 100, 'rendered', 120);
        updateStatus('exported MIDI');
        progress.close();
    }

    function mixTone(left, right, sampleRate, start, length, channel, note, velocity = 1, slideTo = null) {
        const noteGain = velocityGain(velocity);
        if (noteGain <= 0) return;
        const pitchRatio = channelPitchRatio(channel);
        const frequency = noteFrequency(note) * pitchRatio;
        const targetFrequency = slideTo && slideTo !== note ? noteFrequency(slideTo) * pitchRatio : frequency;
        const program = channel.soundfontProgram || 0;
        const synthSettings = channel.synthSettings && typeof channel.synthSettings === 'object' ? channel.synthSettings : {};
        const wave = channel.source === 'soundfont'
            ? (program < 8 ? 'triangle' : program < 24 ? 'sawtooth' : program < 56 ? 'square' : 'sine')
            : channel.source === 'synth'
                ? (synthSettings.wave || (channel.synthType === 'glass-fm' ? 'sine' : 'sawtooth'))
            : channel.wave;
        const voices = channel.source === 'synth' && channel.synthType === 'wave-oscillator'
            ? unisonVoiceSettings({
                ...channel,
                waveUnison: synthSettings.unison,
                waveDetune: synthSettings.detune,
                volume: channel.volume * noteGain
            })
            : [{ cents: 0, pan: Math.max(-1, Math.min(1, channel.pan)), gain: Math.max(0.001, channel.volume * noteGain) }];
        const phases = voices.map(() => 0);
        for (let i = 0; i < length && start + i < left.length; i += 1) {
            const progress = length > 1 ? i / (length - 1) : 1;
            const baseFrequency = frequency + ((targetFrequency - frequency) * progress);
            const fadeIn = Math.min(1, i / Math.max(1, sampleRate * 0.01));
            const fadeOut = Math.min(1, (length - i) / Math.max(1, sampleRate * 0.005));
            voices.forEach((voice, voiceIndex) => {
                const voiceFrequency = baseFrequency * Math.pow(2, voice.cents / 1200);
                phases[voiceIndex] = (phases[voiceIndex] + (voiceFrequency / sampleRate)) % 1;
                const cycle = phases[voiceIndex];
                let value = Math.sin(2 * Math.PI * cycle);
                if (wave === 'square') value = value >= 0 ? 1 : -1;
                if (wave === 'sawtooth') value = 2 * cycle - 1;
                if (wave === 'triangle') value = 2 * Math.abs(2 * cycle - 1) - 1;
                const pan = Math.max(-1, Math.min(1, voice.pan));
                const leftGain = Math.cos((pan + 1) * Math.PI / 4);
                const rightGain = Math.sin((pan + 1) * Math.PI / 4);
                const amp = value * voice.gain * 0.35 * fadeIn * fadeOut;
                left[start + i] += amp * leftGain;
                right[start + i] += amp * rightGain;
            });
        }
    }

    function mixSoundfont(left, right, sampleRate, start, length, channel, note, velocity = 1, slideTo = null) {
        const noteGain = velocityGain(velocity);
        if (noteGain <= 0) return;
        const bank = soundfontBankForChannel(channel);
        const preset = findSoundfontPreset(channel, bank);
        const midiNote = noteNumber(note);
        const zone = preset && Array.isArray(preset.zones)
            ? (preset.zones.find(item => midiNote >= item.keyRange[0] && midiNote <= item.keyRange[1]) || preset.zones[0])
            : null;
        if (!zone || !zone.sample || !bank.sampleData) {
            mixTone(left, right, sampleRate, start, length, channel, note, noteGain, slideTo);
            return;
        }

        const rootKey = Number.isFinite(zone.rootKey) ? zone.rootKey : (zone.sample.originalPitch || 60);
        const cents = (zone.coarseTune || 0) * 100 + (zone.fineTune || 0) + (zone.sample.pitchCorrection || 0);
        const pitchRatio = channelPitchRatio(channel);
        const playbackRate = Math.pow(2, ((midiNote - rootKey) * 100 + cents) / 1200) * pitchRatio;
        const targetRate = slideTo && slideTo !== note
            ? Math.pow(2, ((noteNumber(slideTo) - rootKey) * 100 + cents) / 1200) * pitchRatio
            : playbackRate;
        const sampleRatio = (zone.sample.sampleRate || sampleRate) / sampleRate;
        const attenuation = Math.pow(10, -(zone.attenuation || 0) / 200);
        const pan = Math.max(-1, Math.min(1, channel.pan + (zone.pan || 0)));
        const leftGain = Math.cos((pan + 1) * Math.PI / 4);
        const rightGain = Math.sin((pan + 1) * Math.PI / 4);
        const sampleEnd = Math.min(bank.sampleData.length - 1, zone.sample.end - 1);
        const loopStart = Math.max(zone.sample.start, zone.loopStart || zone.sample.start);
        const loopEnd = Math.min(zone.sample.end - 1, zone.loopEnd || zone.sample.end - 1);
        let cursor = zone.sample.start;

        for (let i = 0; i < length && start + i < left.length; i += 1) {
            if (cursor >= sampleEnd) {
                if (zone.loop && loopEnd > loopStart) {
                    cursor = loopStart + ((cursor - loopStart) % Math.max(1, loopEnd - loopStart));
                } else {
                    break;
                }
            }
            const index = Math.max(0, Math.min(sampleEnd, Math.floor(cursor)));
            const next = Math.min(sampleEnd, index + 1);
            const frac = cursor - index;
            const sample = ((bank.sampleData[index] * (1 - frac)) + (bank.sampleData[next] * frac)) / 32768;
            const fadeIn = Math.min(1, i / Math.max(1, sampleRate * 0.006));
            const fadeOut = Math.min(1, (length - i) / Math.max(1, sampleRate * 0.005));
            const amp = sample * channel.volume * attenuation * noteGain * fadeIn * fadeOut;
            left[start + i] += amp * leftGain;
            right[start + i] += amp * rightGain;
            const progress = length > 1 ? i / (length - 1) : 1;
            cursor += (playbackRate + ((targetRate - playbackRate) * progress)) * sampleRatio;
        }
    }

    function mixKick(left, right, sampleRate, start, length, channel, velocity = 1) {
        const noteGain = velocityGain(velocity);
        if (noteGain <= 0) return;
        const pan = Math.max(-1, Math.min(1, channel.pan));
        const leftGain = Math.cos((pan + 1) * Math.PI / 4);
        const rightGain = Math.sin((pan + 1) * Math.PI / 4);
        for (let i = 0; i < length && start + i < left.length; i += 1) {
            const t = i / sampleRate;
            const envelope = Math.exp(-t * 10.5);
            const pitch = 76 * Math.exp(-t * 21) + 38;
            const amp = Math.sin(2 * Math.PI * pitch * t) * envelope * channel.volume * noteGain * 0.85;
            left[start + i] += amp * leftGain;
            right[start + i] += amp * rightGain;
        }
    }

    function mixSample(left, right, sampleRate, start, length, channel, note, velocity = 1) {
        const noteGain = velocityGain(velocity);
        if (noteGain <= 0) return;
        if (!channel.sampleBuffer) {
            mixKick(left, right, sampleRate, start, Math.max(Math.floor(sampleRate * 0.38), length), channel, noteGain);
            return;
        }
        const mode = sampleType(channel);
        let renderMode = mode;
        let source = channel.sampleBuffer;
        let bounds = sampleBounds(channel, note);
        const speedRate = sampleSpeedRatio(channel);
        let playbackRate = sampleRateForNote(channel, note) * channelPitchRatio(channel);
        if (sampleKeepsDuration(channel) && playbackRate !== 1 && (mode === 'one-shot' || mode === 'loop')) {
            const shifted = pitchShiftedSegment(createAudio().context, source, bounds.start, bounds.end, playbackRate);
            if (shifted) {
                source = shifted;
                bounds = { start: 0, end: shifted.duration };
                playbackRate = 1;
            }
        } else if (sampleKeepsDuration(channel) && playbackRate !== 1 && mode === 'reverse') {
            const segment = sampleSegmentBuffer(channel, true, note);
            const shifted = pitchShiftedSegment(createAudio().context, segment, 0, segment.duration, playbackRate);
            if (shifted) {
                source = shifted;
                bounds = { start: 0, end: shifted.duration };
                playbackRate = 1;
                renderMode = 'one-shot';
            }
        }
        const startFrame = Math.max(0, Math.min(source.length - 1, Math.floor(bounds.start * source.sampleRate)));
        const endFrame = Math.max(startFrame + 1, Math.min(source.length, Math.ceil(bounds.end * source.sampleRate)));
        const segmentFrames = endFrame - startFrame;
        const step = playbackRate * speedRate * (source.sampleRate / sampleRate);
        const segmentOut = Math.max(1, Math.ceil(((segmentFrames / source.sampleRate) * sampleRate) / speedRate));
        const outputLength = renderMode === 'loop'
            ? length
            : segmentOut;
        const leftData = source.getChannelData(0);
        const rightData = source.numberOfChannels > 1 ? source.getChannelData(1) : leftData;
        const pan = Math.max(-1, Math.min(1, channel.pan));
        const leftGain = Math.cos((pan + 1) * Math.PI / 4);
        const rightGain = Math.sin((pan + 1) * Math.PI / 4);
        const maxLength = Math.min(outputLength, left.length - start);
        for (let i = 0; i < maxLength; i += 1) {
            let frameOffset = i * step;
            if (renderMode === 'loop') {
                frameOffset %= segmentFrames;
            } else if (renderMode === 'reverse') {
                frameOffset = playbackRate > 1
                    ? segmentFrames - 1 - (frameOffset % segmentFrames)
                    : segmentFrames - 1 - Math.min(segmentFrames - 1, frameOffset);
            } else {
                frameOffset = playbackRate > 1
                    ? frameOffset % segmentFrames
                    : Math.min(segmentFrames - 1, frameOffset);
            }
            const frame = Math.max(startFrame, Math.min(endFrame - 1, startFrame + Math.floor(frameOffset)));
            const fadeIn = Math.min(1, i / Math.max(1, sampleRate * 0.004));
            const fadeOut = Math.min(1, (maxLength - i) / Math.max(1, sampleRate * 0.005));
            const amp = channel.volume * noteGain * fadeIn * fadeOut;
            left[start + i] += leftData[frame] * amp * leftGain;
            right[start + i] += rightData[frame] * amp * rightGain;
        }
    }

    function encodeWav(left, right, sampleRate) {
        const length = left.length;
        const buffer = new ArrayBuffer(44 + length * 4);
        const view = new DataView(buffer);
        const write = (offset, text) => {
            for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
        };
        write(0, 'RIFF');
        view.setUint32(4, 36 + length * 4, true);
        write(8, 'WAVE');
        write(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 2, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 4, true);
        view.setUint16(32, 4, true);
        view.setUint16(34, 16, true);
        write(36, 'data');
        view.setUint32(40, length * 4, true);
        let offset = 44;
        for (let i = 0; i < length; i += 1) {
            view.setInt16(offset, Math.max(-1, Math.min(1, left[i])) * 32767, true);
            view.setInt16(offset + 2, Math.max(-1, Math.min(1, right[i])) * 32767, true);
            offset += 4;
        }
        return buffer;
    }

    function hasRenderableEffects(channel) {
        ensureChannelEffects(channel);
        return channel.effects.some(effect => effect.enabled && effectDefinitions.has(effect.type));
    }

    async function renderChannelEffects(channel, dryLeft, dryRight, sampleRate) {
        if (!hasRenderableEffects(channel)) return { left: dryLeft, right: dryRight };
        const OfflineContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        if (!OfflineContext) return { left: dryLeft, right: dryRight };

        const context = new OfflineContext(2, dryLeft.length, sampleRate);
        const dryBuffer = context.createBuffer(2, dryLeft.length, sampleRate);
        dryBuffer.copyToChannel(dryLeft, 0);
        dryBuffer.copyToChannel(dryRight, 1);

        const source = context.createBufferSource();
        source.buffer = dryBuffer;
        let current = source;

        channel.effects.forEach(effect => {
            if (!effect.enabled) return;
            const definition = effectDefinitions.get(effect.type);
            if (!definition) return;
            syncEffectSettings(definition, effect);
            try {
                const chain = definition.create(context, effectRuntimeSettings(definition, effect.settings));
                if (!chain || !chain.input || !chain.output) return;
                current.connect(chain.input);
                current = chain.output;
            } catch (_) {
                updateStatus('effect failed: ' + definition.name);
            }
        });

        try {
            current.connect(context.destination);
            source.start(0);
            const rendered = await context.startRendering();
            return {
                left: rendered.getChannelData(0),
                right: rendered.getChannelData(1)
            };
        } catch (_) {
            updateStatus('effect render failed: ' + channel.name);
            return { left: dryLeft, right: dryRight };
        }
    }

    function mixRenderedChannel(targetLeft, targetRight, rendered) {
        const left = rendered.left;
        const right = rendered.right || left;
        const length = Math.min(targetLeft.length, left.length, targetRight.length, right.length);
        for (let i = 0; i < length; i += 1) {
            targetLeft[i] += left[i];
            targetRight[i] += right[i];
        }
    }

    async function exportWav() {
        const progress = showExportProgress('rendering...', 'preparing WAV render');
        await setExportProgress(progress, 0, 'preparing WAV render', 80);
        updateStatus('rendering WAV...');
        const sampleRate = 44100;
        const barCount = usedBarCount();
        const totalSteps = barCount * stepCount();
        const samplesPerStep = Math.floor(stepSeconds() * sampleRate);
        const totalSamples = totalSteps * samplesPerStep + sampleRate;
        const left = new Float32Array(totalSamples);
        const right = new Float32Array(totalSamples);
        const channels = audibleChannels();
        if (!effectDefinitions.size && channels.some(channel => Array.isArray(channel.effects) && channel.effects.some(effect => effect && effect.enabled !== false))) {
            await setExportProgress(progress, 0, 'loading effects', 40);
            await loadEffectCatalog();
        }
        const renderUnits = Math.max(1, channels.length * barCount);
        for (let channelIndex = 0; channelIndex < channels.length; channelIndex += 1) {
            const channel = channels[channelIndex];
            const channelLeft = new Float32Array(totalSamples);
            const channelRight = new Float32Array(totalSamples);
            for (let bar = 0; bar < barCount; bar += 1) {
                const patternIndex = state.clips[channel.id] ? state.clips[channel.id][bar] : null;
                const completed = (channelIndex * barCount) + bar;
                const detail = 'rendering ' + channel.name + ', bar ' + (bar + 1) + ' / ' + barCount;
                await setExportProgress(progress, (completed / renderUnits) * 100, detail, 12);
                if (patternIndex === null || patternIndex === DISABLED_CLIP) continue;
                getPattern(channel, patternIndex).forEach((stepEvents, step) => {
                    getStepEvents(getPattern(channel, patternIndex), step).forEach(event => {
                        const start = ((bar * stepCount()) + step) * samplesPerStep;
                        const velocity = noteVelocity(event);
                        const lengthSamples = Math.max(1, Math.floor(samplesPerStep * clampedNoteLength(event, step)));
                        if (channel.source === 'sample') mixSample(channelLeft, channelRight, sampleRate, start, Math.max(Math.floor(sampleRate * 0.38), lengthSamples), channel, event.note, velocity);
                        else if (channel.source === 'soundfont') mixSoundfont(channelLeft, channelRight, sampleRate, start, lengthSamples, channel, event.note, velocity, event.slideTo);
                        else mixTone(channelLeft, channelRight, sampleRate, start, lengthSamples, channel, event.note, velocity, event.slideTo);
                    });
                });
                await setExportProgress(progress, ((completed + 1) / renderUnits) * 100, detail, 12);
            }
            if (hasRenderableEffects(channel)) {
                await setExportProgress(progress, ((channelIndex + 1) / Math.max(1, channels.length)) * 100, 'applying effects to ' + channel.name, 24);
            }
            mixRenderedChannel(left, right, await renderChannelEffects(channel, channelLeft, channelRight, sampleRate));
        }
        await setExportProgress(progress, 100, 'encoding WAV', 80);
        downloadBlob(new Blob([encodeWav(left, right, sampleRate)], { type: 'audio/wav' }), safeFilename(state.projectName, '.wav'));
        await setExportProgress(progress, 100, 'rendered', 120);
        updateStatus('exported WAV');
        progress.close();
    }

    async function importMidiFile(file) {
        const progress = showExportProgress('importing...', 'reading MIDI file');
        try {
        await setExportProgress(progress, 3, 'reading MIDI file');
        const data = new DataView(await file.arrayBuffer());
        await setExportProgress(progress, 8, 'parsing MIDI header');
        const readText = (offset, length) => {
            let text = '';
            for (let i = 0; i < length; i += 1) text += String.fromCharCode(data.getUint8(offset + i));
            return text;
        };
        const readBytes = (offset, length) => {
            const bytes = [];
            for (let i = 0; i < length; i += 1) bytes.push(data.getUint8(offset + i));
            return bytes;
        };
        const readMetaText = (offset, length) => {
            try {
                return new TextDecoder('utf-8').decode(new Uint8Array(readBytes(offset, length))).replace(/\0/g, '').trim();
            } catch (_) {
                return readText(offset, length).replace(/\0/g, '').trim();
            }
        };
        const readVar = (cursor) => {
            let value = 0;
            let byte = 0;
            do {
                byte = data.getUint8(cursor.offset);
                cursor.offset += 1;
                value = (value << 7) + (byte & 0x7f);
            } while (byte & 0x80);
            return value;
        };
        if (readText(0, 4) !== 'MThd') throw new Error('not MIDI');
        const headerLength = data.getUint32(4, false);
        const trackCount = data.getUint16(10, false) || 1;
        const rawDivision = data.getUint16(12, false) || 480;
        const division = rawDivision & 0x8000 ? 480 : rawDivision;
        const importSteps = 32;
        const ticksPerStep = division / 4;
        const groups = new Map();
        let offset = 8 + headerLength;
        let importedBpm = 128;
        let maxTick = 0;

        const bendToSlideNote = (midiNote, bends) => {
            if (!Array.isArray(bends) || !bends.length) return null;
            const strongest = bends.reduce((best, bend) => Math.abs(bend.value) > Math.abs(best.value) ? bend : best, bends[0]);
            const semitones = Math.round(Math.max(-1, Math.min(1, strongest.value)) * 2);
            if (!semitones) return null;
            return midiToNote(Math.max(0, Math.min(127, midiNote + semitones)));
        };

        const groupFor = (trackIndex, midiChannel, program, bank, trackName) => {
            const safeProgram = Math.max(0, Math.min(127, Number(program) || 0));
            const safeBank = midiChannel === 9 ? 128 : (Number(bank) || 0);
            const key = trackIndex + ':' + midiChannel + ':' + safeBank + ':' + safeProgram;
            if (!groups.has(key)) {
                const label = midiChannel === 9
                    ? 'Drums'
                    : (MIDI_PROGRAM_NAMES[safeProgram] || ('Program ' + (safeProgram + 1)));
                groups.set(key, {
                    midiChannel,
                    program: safeProgram,
                    bank: safeBank,
                    name: (trackName ? trackName + ' - ' : '') + label,
                    notes: []
                });
            }
            return groups.get(key);
        };

        for (let trackIndex = 0; trackIndex < trackCount && offset < data.byteLength - 8; trackIndex += 1) {
            await setExportProgress(progress, 10 + ((trackIndex / Math.max(1, trackCount)) * 45), 'parsing MIDI track ' + (trackIndex + 1) + ' / ' + trackCount, 18);
            if (readText(offset, 4) !== 'MTrk') break;
            const length = data.getUint32(offset + 4, false);
            const end = offset + 8 + length;
            const cursor = { offset: offset + 8 };
            let tick = 0;
            let status = 0;
            let trackName = '';
            const programs = Array(16).fill(0);
            const banks = Array(16).fill(0);
            const pitchBends = Array(16).fill(0);
            const activeNotes = new Map();

            const closeNote = (midiChannel, midiNote) => {
                const key = midiChannel + ':' + midiNote;
                const started = activeNotes.get(key);
                if (!started) return;
                activeNotes.delete(key);
                if (tick <= started.tick) return;
                const noteEvent = {
                    tick: started.tick,
                    endTick: tick,
                    note: midiToNote(midiNote),
                    velocity: started.velocity || 1
                };
                const slideTo = bendToSlideNote(midiNote, started.bends);
                if (slideTo && slideTo !== noteEvent.note) noteEvent.slideTo = slideTo;
                started.group.notes.push(noteEvent);
                maxTick = Math.max(maxTick, tick);
            };

            while (cursor.offset < end) {
                tick += readVar(cursor);
                let eventType = data.getUint8(cursor.offset);
                if (eventType < 0x80) {
                    eventType = status;
                } else {
                    cursor.offset += 1;
                    status = eventType;
                }
                if ((eventType & 0xf0) === 0x90) {
                    const midiChannel = eventType & 0x0f;
                    const note = data.getUint8(cursor.offset);
                    const velocity = data.getUint8(cursor.offset + 1);
                    cursor.offset += 2;
                    if (velocity > 0) {
                        const group = groupFor(trackIndex, midiChannel, programs[midiChannel], banks[midiChannel], trackName);
                        activeNotes.set(midiChannel + ':' + note, {
                            tick,
                            group,
                            velocity: velocity / 127,
                            bends: pitchBends[midiChannel] ? [{ tick, value: pitchBends[midiChannel] }] : []
                        });
                    } else {
                        closeNote(midiChannel, note);
                    }
                } else if ((eventType & 0xf0) === 0x80) {
                    const midiChannel = eventType & 0x0f;
                    const note = data.getUint8(cursor.offset);
                    cursor.offset += 2;
                    closeNote(midiChannel, note);
                } else if ((eventType & 0xf0) === 0xb0) {
                    const midiChannel = eventType & 0x0f;
                    const controller = data.getUint8(cursor.offset);
                    const value = data.getUint8(cursor.offset + 1);
                    cursor.offset += 2;
                    if (controller === 0) banks[midiChannel] = value;
                } else if ((eventType & 0xf0) === 0xa0) {
                    cursor.offset += 2;
                } else if ((eventType & 0xf0) === 0xe0) {
                    const midiChannel = eventType & 0x0f;
                    const lsb = data.getUint8(cursor.offset);
                    const msb = data.getUint8(cursor.offset + 1);
                    cursor.offset += 2;
                    const bend = (((msb << 7) | lsb) - 8192) / 8192;
                    pitchBends[midiChannel] = bend;
                    activeNotes.forEach((started, key) => {
                        if (Number(key.split(':')[0]) === midiChannel) started.bends.push({ tick, value: bend });
                    });
                } else if ((eventType & 0xf0) === 0xc0) {
                    programs[eventType & 0x0f] = data.getUint8(cursor.offset);
                    cursor.offset += 1;
                } else if ((eventType & 0xf0) === 0xd0) {
                    cursor.offset += 1;
                } else if (eventType === 0xff) {
                    const metaType = data.getUint8(cursor.offset);
                    cursor.offset += 1;
                    const metaLength = readVar(cursor);
                    if (metaType === 0x03) {
                        trackName = readMetaText(cursor.offset, metaLength);
                    } else if (metaType === 0x51 && metaLength === 3) {
                        const tempo = (data.getUint8(cursor.offset) << 16) | (data.getUint8(cursor.offset + 1) << 8) | data.getUint8(cursor.offset + 2);
                        if (tempo > 0) importedBpm = Math.max(40, Math.min(240, Math.round(60000000 / tempo)));
                    }
                    cursor.offset += metaLength;
                } else if (eventType === 0xf0 || eventType === 0xf7) {
                    cursor.offset += readVar(cursor);
                } else {
                    break;
                }
            }
            activeNotes.forEach((started, key) => {
                const midiNote = Number(key.split(':')[1]);
                if (tick > started.tick) {
                    const noteEvent = {
                        tick: started.tick,
                        endTick: tick,
                        note: midiToNote(midiNote),
                        velocity: started.velocity || 1
                    };
                    const slideTo = bendToSlideNote(midiNote, started.bends);
                    if (slideTo && slideTo !== noteEvent.note) noteEvent.slideTo = slideTo;
                    started.group.notes.push(noteEvent);
                }
            });
            offset = end;
        }

        await setExportProgress(progress, 58, 'building frdgBeats project');
        const midiGroups = Array.from(groups.values()).filter(group => group.notes.length);
        if (!midiGroups.length) throw new Error('empty MIDI');
        setProjectSteps(importSteps, false);
        const lastImportedBar = midiGroups.reduce((highest, group) => {
            return Math.max(highest, ...group.notes.map(note => Math.floor(Math.round(note.tick / ticksPerStep) / stepCount())));
        }, 0);
        stop(true);
        channelOutputs.forEach(output => output.nodes.forEach(disconnectNode));
        channelOutputs.clear();
        state.projectName = file.name.replace(/\.(mid|midi)$/i, '') || 'midi import';
        state.bpm = importedBpm;
        state.octave = 2;
        state.masterVolume = 0.82;
        state.barCount = normalizeBarCount(Math.max(DEFAULT_BAR_COUNT, lastImportedBar + 1));
        state.loopRange = null;
        const importedGroups = midiGroups.slice(0, 16);
        state.channels = [];
        for (let index = 0; index < importedGroups.length; index += 1) {
            const group = importedGroups[index];
            await setExportProgress(progress, 62 + ((index / Math.max(1, importedGroups.length)) * 24), 'creating ' + group.name, 18);
            const channel = makeChannel('midi-' + index + '-' + Date.now(), group.name, 'soundfont', COLORS[index % COLORS.length], Array(stepCount()).fill(false), 'C4');
            channel.volume = group.midiChannel === 9 ? 0.72 : 0.46;
            channel.soundfontProgram = group.program;
            channel.soundfontBankNumber = group.bank;
            channel.soundfontPreset = (MIDI_PROGRAM_NAMES[group.program] || 'Program ' + (group.program + 1));
            channel.patterns = Array.from({ length: MAX_PATTERNS }, () => Array.from({ length: stepCount() }, () => []));
            const importedBars = Array.from({ length: state.barCount }, () => Array.from({ length: stepCount() }, () => []));
            group.notes.forEach(note => {
                const absoluteStep = Math.round(note.tick / ticksPerStep);
                const bar = Math.floor(absoluteStep / stepCount());
                if (bar < 0 || bar >= state.barCount) return;
                const step = absoluteStep % stepCount();
                const length = Math.max(1, Math.min(stepCount() - step, Math.ceil((note.endTick - note.tick) / ticksPerStep)));
                const event = { note: note.note, length, velocity: note.velocity || 1 };
                if (note.slideTo) event.slideTo = note.slideTo;
                importedBars[bar][step].push(event);
            });
            const patternMap = new Map();
            let nextPatternIndex = 0;
            channel._importedClipMap = Array.from({ length: state.barCount }, () => DISABLED_CLIP);
            importedBars.forEach((pattern, bar) => {
                if (!pattern.some(stepEvents => normalizeStepEvents(stepEvents).length)) return;
                const normalized = pattern.map(stepEvents => normalizeStepEvents(stepEvents).sort((a, b) => {
                    return noteNumber(a.note) - noteNumber(b.note)
                        || (a.length || 1) - (b.length || 1)
                        || noteVelocity(a) - noteVelocity(b)
                        || String(a.slideTo || '').localeCompare(String(b.slideTo || ''));
                }));
                const signature = JSON.stringify(normalized);
                let patternIndex = patternMap.get(signature);
                if (patternIndex === undefined) {
                    patternIndex = nextPatternIndex;
                    nextPatternIndex = Math.min(MAX_PATTERNS, nextPatternIndex + 1);
                    if (patternIndex < MAX_PATTERNS) {
                        channel.patterns[patternIndex] = normalized.map(stepEvents => stepEvents.map(event => ({ ...event })));
                        patternMap.set(signature, patternIndex);
                    }
                }
                channel._importedClipMap[bar] = patternIndex < MAX_PATTERNS ? patternIndex : DISABLED_CLIP;
            });
            channel.pattern = channel.patterns[0];
            state.channels.push(channel);
        }
        await setExportProgress(progress, 88, 'mapping playlist clips');
        state.clips = {};
        ensureClipMap();
        state.channels.forEach(channel => {
            state.clips[channel.id] = Array.from({ length: state.barCount }, () => DISABLED_CLIP);
            for (let bar = 0; bar < state.barCount; bar += 1) {
                state.clips[channel.id][bar] = Array.isArray(channel._importedClipMap) ? channel._importedClipMap[bar] : DISABLED_CLIP;
            }
            delete channel._importedClipMap;
            ensureChannelPatterns(channel);
        });
        selectedId = state.channels[0].id;
        els.projectName.value = state.projectName;
        els.bpm.value = String(state.bpm);
        els.octave.value = String(state.octave);
        els.masterVolume.value = String(state.masterVolume);
        if (audio) audio.master.gain.value = state.masterVolume;
        els.pattern.value = '0';
        await setExportProgress(progress, 94, 'loading SoundFont presets');
        await loadDefaultSoundfont();
        applySoundfontPresetsToChannels();
        renderAll();
        await setExportProgress(progress, 100, 'imported MIDI project', 120);
        updateStatus('imported MIDI project');
        progress.close();
        } catch (error) {
            progress.close();
            throw error;
        }
    }

    function selectChannel(id) {
        selectedId = id;
        const channel = selectedChannel();
        ensureChannelPatterns(channel);
        els.pattern.value = String(channel.activePattern);
        renderChannels();
        renderRoll();
        renderMixer();
        renderAutomation();
        syncWaveformTab();
        syncSynthTab();
        renderSampleEditor();
        renderSynthEditor();
        warmSamplePitchCache(channel);
    }

    function removeChannel(id) {
        if (state.channels.length <= 1) {
            updateStatus('keep at least one channel around');
            return;
        }
        const index = state.channels.findIndex(channel => channel.id === id);
        if (index === -1) return;
        const removed = state.channels[index];
        state.channels.splice(index, 1);
        delete state.clips[id];
        const output = channelOutputs.get(id);
        if (output) output.nodes.forEach(disconnectNode);
        channelOutputs.delete(id);
        if (selectedId === id) {
            selectedId = (state.channels[index] || state.channels[index - 1] || state.channels[0]).id;
        }
        renderAll();
        updateStatus('removed ' + removed.name);
    }

    function paintPlayhead() {
        root.querySelectorAll('.fb-step.is-playing, .fb-cell.is-playing, .fb-bar-label.is-playing, .fb-playlist-cell.is-playing, .fb-playlist-track.is-playing, .fb-playlist-head.is-playing').forEach(el => el.classList.remove('is-playing'));
        root.querySelectorAll('.fb-step[data-step="' + currentStep + '"], .fb-cell[data-step="' + currentStep + '"], .fb-bar-label[data-step="' + currentStep + '"]').forEach(el => el.classList.add('is-playing'));
        if (currentView !== 'roll') {
            root.querySelectorAll('.fb-playlist-cell[data-bar="' + currentBar + '"], .fb-playlist-head[data-bar="' + currentBar + '"]').forEach(el => el.classList.add('is-playing'));
        }
        if (isPlaying) {
            updateStatus(currentView === 'roll'
                ? 'playing selected pattern, step ' + (currentStep + 1)
                : 'playing bar ' + (currentBar + 1) + ', step ' + (currentStep + 1));
        }
    }

    function addChannel() {
        const index = state.channels.length + 1;
        const id = 'channel-' + Date.now();
        state.channels.push(makeChannel(id, 'channel ' + index, 'wave', COLORS[index % COLORS.length], Array(stepCount()).fill(false), 'C4'));
        state.clips[id] = Array.from({ length: state.barCount }, () => DISABLED_CLIP);
        ensureClipMap();
        selectChannel(id);
        renderPlaylist();
        paintPlayhead();
    }

    function serialize() {
        ensureClipMap();
        return JSON.stringify({
            bpm: state.bpm,
            projectName: state.projectName,
            octave: state.octave,
            noteSnap: state.noteSnap,
            masterVolume: state.masterVolume,
            steps: stepCount(),
            barCount: state.barCount,
            loopRange: state.loopRange,
            assets: {
                soundfont: soundfontBank.asset || null,
                soundfontUrl: soundfontBank.asset ? null : (soundfontBank.url || DEFAULT_SOUNDFONT_URL)
            },
            clips: state.clips,
            selectedId,
            channels: state.channels.map(channel => {
                ensureChannelPatterns(channel);
                ensureChannelAutomation(channel);
                return {
                    id: channel.id,
                    name: channel.name,
                    source: channel.source === 'wave' ? 'synth' : channel.source,
                    color: channel.color,
                    muted: channel.muted,
                    solo: channel.solo,
                    collapsed: channel.collapsed !== false,
                    wave: channel.wave,
                    waveUnison: channel.waveUnison,
                    waveDetune: channel.waveDetune,
                    synthType: channel.synthType || 'analog-mono',
                    synthSettings: channel.synthSettings && typeof channel.synthSettings === 'object' ? { ...channel.synthSettings } : {},
                    volume: channel.volume,
                    pan: channel.pan,
                    attack: channel.attack,
                    release: channel.release,
                    sampleName: channel.sampleName,
                    sampleType: sampleType(channel),
                    sampleKeepDuration: sampleKeepsDuration(channel),
                    sampleSource: channel.sampleSource || 'custom',
                    sampleUrl: channel.sampleUrl || '',
                    sampleStart: sampleTrimValue(channel.sampleStart, 0),
                    sampleEnd: sampleTrimValue(channel.sampleEnd, 1),
                    sampleZones: ensureSampleZones(channel).map(zone => ({ ...zone })),
                    sampleAsset: channel.sampleAsset || null,
                    soundfontName: channel.soundfontName,
                    soundfontSource: channel.soundfontSource || 'bundled',
                    soundfontUrl: channel.soundfontUrl || '',
                    soundfontPreset: channel.soundfontPreset,
                    soundfontProgram: channel.soundfontProgram,
                    soundfontBankNumber: channel.soundfontBankNumber,
                    activePattern: channel.activePattern,
                    effects: (channel.effects || []).map(effect => ({
                        id: effect.id,
                        type: effect.type,
                        enabled: effect.enabled !== false,
                        collapsed: effect.collapsed !== false,
                        settings: effect.settings && typeof effect.settings === 'object' ? { ...effect.settings } : {}
                    })),
                    automation: (channel.automation || []).map(lane => ({
                        id: lane.id,
                        targetType: lane.targetType,
                        effectId: lane.effectId || '',
                        paramId: lane.paramId,
                        enabled: lane.enabled !== false,
                        collapsed: lane.collapsed === true,
                        mode: lane.mode === 'smooth' ? 'smooth' : 'step',
                        valuesByPattern: Object.fromEntries(Object.entries(automationPatternValues(lane))
                            .map(([patternIndex, values]) => [String(normalizeAutomationPatternIndex(patternIndex)), resizeAutomationValues(values)]))
                    })),
                    patterns: channel.patterns,
                    pattern: channel.pattern
                };
            })
        });
    }

    async function hydrate(saved) {
        channelOutputs.forEach(output => output.nodes.forEach(disconnectNode));
        channelOutputs.clear();
        retiredChannelOutputs.forEach(output => output.nodes.forEach(disconnectNode));
        retiredChannelOutputs.clear();
        state.bpm = Number(saved.bpm) || 128;
        state.projectName = typeof saved.projectName === 'string' && saved.projectName.trim() ? saved.projectName.trim() : 'Untitled';
        state.octave = octavePage(saved.octave);
        setNoteSnap(saved.noteSnap);
        state.masterVolume = Math.max(0, Math.min(1, Number(saved.masterVolume) || 0.82));
        setProjectSteps(inferProjectSteps(saved), false);
        state.loopRange = saved.loopRange && typeof saved.loopRange === 'object'
            ? { start: Number(saved.loopRange.start) || 0, end: Number(saved.loopRange.end) || 0 }
            : null;
        state.clips = saved.clips && typeof saved.clips === 'object' ? saved.clips : {};
        const savedClipLengths = Object.values(state.clips).reduce((highest, clip) => {
            return Array.isArray(clip) ? Math.max(highest, clip.length) : highest;
        }, 0);
        state.barCount = normalizeBarCount(saved.barCount || (Array.isArray(saved.arrangement) ? saved.arrangement.length : savedClipLengths) || DEFAULT_BAR_COUNT);
        if (Array.isArray(saved.channels) && saved.channels.length) {
            state.channels = saved.channels.map((channel, index) => {
                const wasWave = channel.source === 'wave';
                const hydrated = {
                    ...makeChannel(channel.id || ('channel-' + index), channel.name || ('channel ' + (index + 1)), channel.source || 'synth', channel.color || COLORS[index % COLORS.length], Array(stepCount()).fill(false), 'C4'),
                    ...channel,
                    collapsed: channel.collapsed === false ? false : true,
                    sampleBuffer: null,
                    pattern: resizePattern(channel.pattern, stepCount())
                };
                if (wasWave) migrateWaveChannel(hydrated);
                ensureChannelPatterns(hydrated);
                ensureChannelEffects(hydrated);
                ensureChannelSynth(hydrated);
                ensureChannelAutomation(hydrated);
                return hydrated;
            });
            state.channels.forEach(channel => {
                channel.pattern = resizePattern(channel.pattern, stepCount());
            });
        }
        if (Array.isArray(saved.arrangement)) {
            state.channels.forEach(channel => {
                state.clips[channel.id] = saved.arrangement.slice(0, state.barCount);
            });
        }
        ensureClipMap();
        selectedId = state.channels.some(channel => channel.id === saved.selectedId) ? saved.selectedId : state.channels[0].id;
        els.bpm.value = String(state.bpm);
        els.projectName.value = state.projectName;
        els.pattern.value = String(selectedChannel().activePattern || 0);
        els.octave.value = String(state.octave);
        els.noteSnap.value = String(state.noteSnap);
        els.masterVolume.value = String(state.masterVolume);
        if (audio) audio.master.gain.value = state.masterVolume;
        await hydrateAssets(saved);
    }

    async function hydrateAssets(saved) {
        const savedSoundfont = saved && saved.assets && saved.assets.soundfont && saved.assets.soundfont.data
            ? saved.assets.soundfont
            : null;
        if (savedSoundfont) {
            try {
                soundfontBank = parseSoundfont(base64ToArrayBuffer(savedSoundfont.data), (savedSoundfont.name || 'embedded soundfont').replace(/\.sf2$/i, ''));
                soundfontBank.asset = savedSoundfont;
                soundfontBank.url = null;
                customSoundfontBank = soundfontBank;
                useCustomSoundfont = true;
                applySoundfontPresetsToChannels();
            } catch (_) {
                updateStatus('embedded soundfont failed to load');
            }
        } else if (saved && saved.assets && typeof saved.assets.soundfontUrl === 'string' && saved.assets.soundfontUrl) {
            await loadSoundfontFromUrl(saved.assets.soundfontUrl, saved.assets.soundfontUrl.split('/').pop().replace(/\.sf2$/i, '') || 'SoundFont');
        }

        const soundfontChannels = state.channels.filter(channel => channel.source === 'soundfont');
        for (const channel of soundfontChannels) {
            if (channel.soundfontSource === 'custom') {
                if (customSoundfontBank) applySoundfontPresetToChannel(channel, customSoundfontBank);
                continue;
            }
            const url = channel.soundfontUrl || (soundfontBank.url || DEFAULT_SOUNDFONT_URL);
            const name = channel.soundfontName || url.split('/').pop().replace(/\.sf2$/i, '') || 'SoundFont';
            const bank = await loadChannelSoundfontFromUrl(channel, url, name);
            applySoundfontPresetToChannel(channel, bank);
        }

        const needsSampleAudio = state.channels.some(channel => channel.source === 'sample' && ((channel.sampleAsset && channel.sampleAsset.data) || channel.sampleUrl));
        const engine = audio || (needsSampleAudio ? createAudio() : null);
        if (!engine) return;
        const sampleChannels = state.channels.filter(channel => channel.source === 'sample' && channel.sampleAsset && channel.sampleAsset.data);
        for (const channel of sampleChannels) {
            try {
                channel.sampleBuffer = await engine.context.decodeAudioData(base64ToArrayBuffer(channel.sampleAsset.data).slice(0));
                channel.sampleName = channel.sampleAsset.name || channel.sampleName || 'embedded sample';
                channel.sampleSource = 'custom';
                warmSamplePitchCache(channel);
            } catch (_) {
                channel.sampleBuffer = null;
                updateStatus('embedded sample failed: ' + (channel.sampleName || channel.name));
            }
        }
        const bundledSampleChannels = state.channels.filter(channel => channel.source === 'sample' && !channel.sampleAsset && channel.sampleUrl);
        for (const channel of bundledSampleChannels) {
            await loadSampleFromUrl(channel, channel.sampleUrl, channel.sampleName || '', false);
        }
    }

    function saveProject() {
        try {
            state.projectName = els.projectName.value.trim() || 'Untitled';
            window.localStorage.setItem(STORAGE_KEY, serialize());
            updateStatus('saved to browser');
        } catch (_) {
            updateStatus('save failed');
        }
    }

    async function loadProject() {
        try {
            const raw = window.localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                updateStatus('no browser project saved');
                return;
            }
            await hydrate(JSON.parse(raw));
            renderAll();
            updateStatus('loaded browser project');
        } catch (_) {
            updateStatus('load failed');
        }
    }

    async function newProject(confirmFirst = true) {
        if (confirmFirst) {
            const confirmed = await showConfirmDialog('new project', 'this will overwrite your current project. are you sure?', 'new project');
            if (!confirmed) return;
        }
        stop(true);
        state.projectName = 'Untitled';
        state.bpm = 128;
        state.octave = 2;
        setNoteSnap(DEFAULT_NOTE_LENGTH_SNAP);
        state.masterVolume = 0.82;
        setProjectSteps(DEFAULT_STEPS, false);
        state.barCount = DEFAULT_BAR_COUNT;
        state.loopRange = null;
        state.channels = [emptyProjectChannel()];
        soundfontBank.asset = null;
        useCustomSoundfont = false;
        channelOutputs.forEach(output => output.nodes.forEach(disconnectNode));
        channelOutputs.clear();
        state.clips = { [state.channels[0].id]: Array.from({ length: DEFAULT_BAR_COUNT }, () => DISABLED_CLIP) };
        selectedId = state.channels[0].id;
        els.projectName.value = state.projectName;
        els.bpm.value = String(state.bpm);
        els.octave.value = String(state.octave);
        els.masterVolume.value = String(state.masterVolume);
        if (audio) audio.master.gain.value = state.masterVolume;
        els.pattern.value = '0';
        els.patternSteps.value = String(stepCount());
        els.noteSnap.value = String(state.noteSnap);
        renderAll();
        updateStatus('started new project');
    }

    function renderDemoMenu(items = [], failed = false) {
        els.demosMenu.innerHTML = '';
        if (failed) {
            els.demosMenu.append(menuNotice('fa-triangle-exclamation', 'demo list unavailable', 'could not read /others/frdgbeats/demos'));
            return;
        }
        if (!items.length) {
            els.demosMenu.append(menuNotice('fa-folder-open', 'no demos found', 'add .frdgbeats files to /others/frdgbeats/demos'));
            return;
        }
        items.forEach(item => {
            const button = document.createElement('button');
            button.className = 'fb-menu-option';
            button.type = 'button';
            button.innerHTML = '<i class="fa-solid fa-file-audio"></i><span><span class="fb-menu-title"></span><span class="fb-menu-desc">load demo project</span></span>';
            button.querySelector('.fb-menu-title').textContent = item.name;
            button.addEventListener('click', async () => {
                const confirmed = await showConfirmDialog('load demo', 'this will overwrite your current project. are you sure?', 'load demo');
                if (!confirmed) return;
                closeMenus();
                await loadDemoProject(item.url);
            });
            els.demosMenu.append(button);
        });
    }

    function renderPresetMenu(items = [], failed = false) {
        els.presetsMenu.innerHTML = '';
        const blank = document.createElement('button');
        blank.className = 'fb-menu-option';
        blank.type = 'button';
        blank.innerHTML = '<i class="fa-solid fa-file"></i><span><span class="fb-menu-title">Empty</span><span class="fb-menu-desc">start from scratch</span></span>';
        blank.addEventListener('click', async () => {
            closeMenus();
            await newProject(true);
        });
        els.presetsMenu.append(blank);
        if (failed) {
            els.presetsMenu.append(menuNotice('fa-triangle-exclamation', 'preset list unavailable', 'could not read /others/frdgbeats/presets'));
            return;
        }
        if (!items.length) {
            els.presetsMenu.append(menuNotice('fa-folder-open', 'no presets found', 'add .frdgbeats files to /others/frdgbeats/presets'));
            return;
        }
        items.forEach(item => {
            const button = document.createElement('button');
            button.className = 'fb-menu-option';
            button.type = 'button';
            button.innerHTML = '<i class="fa-solid fa-sliders"></i><span><span class="fb-menu-title"></span><span class="fb-menu-desc">start from preset</span></span>';
            button.querySelector('.fb-menu-title').textContent = item.name;
            button.addEventListener('click', async () => {
                const confirmed = await showConfirmDialog('load preset', 'this will overwrite your current project. are you sure?', 'load preset');
                if (!confirmed) return;
                closeMenus();
                await loadPresetProject(item.url);
            });
            els.presetsMenu.append(button);
        });
    }

    async function loadPresetList() {
        els.presetsMenu.innerHTML = '';
        els.presetsMenu.append(menuNotice('fa-spinner', 'loading presets', 'checking /others/frdgbeats/presets'));
        try {
            const response = await fetch(PRESET_LIST_URL, { cache: 'no-store' });
            if (!response.ok) throw new Error('preset list failed');
            const items = await response.json();
            renderPresetMenu(Array.isArray(items) ? items : [], false);
        } catch (_) {
            renderPresetMenu([], true);
        }
    }

    function menuNotice(icon, title, description) {
        const item = document.createElement('button');
        item.className = 'fb-menu-option';
        item.type = 'button';
        item.disabled = true;
        item.innerHTML = '<i class="fa-solid ' + icon + '"></i><span><span class="fb-menu-title"></span><span class="fb-menu-desc"></span></span>';
        item.querySelector('.fb-menu-title').textContent = title;
        item.querySelector('.fb-menu-desc').textContent = description;
        return item;
    }

    async function loadDemoList() {
        els.demosMenu.innerHTML = '';
        els.demosMenu.append(menuNotice('fa-spinner', 'loading demos', 'checking /others/frdgbeats/demos'));
        try {
            const response = await fetch(DEMO_LIST_URL, { cache: 'no-store' });
            if (!response.ok) throw new Error('demo list failed');
            const items = await response.json();
            renderDemoMenu(Array.isArray(items) ? items : [], false);
        } catch (_) {
            renderDemoMenu([], true);
        }
    }

    async function loadDemoProject(url) {
        try {
            const response = await fetch(url, { cache: 'no-store' });
            if (!response.ok) throw new Error('demo load failed');
            await importProjectText(await response.text());
            updateStatus('loaded demo project');
        } catch (_) {
            updateStatus('demo load failed');
        }
    }

    async function loadPresetProject(url) {
        try {
            const response = await fetch(url, { cache: 'no-store' });
            if (!response.ok) throw new Error('preset load failed');
            await importProjectText(await response.text());
            updateStatus('loaded preset project');
        } catch (_) {
            updateStatus('preset load failed');
        }
    }

    function renderSoundfontMenu(items = soundfontCatalog, failed = false) {
        els.soundfontMenu.innerHTML = '';
        const custom = document.createElement('button');
        custom.className = 'fb-menu-option';
        custom.type = 'button';
        custom.innerHTML = '<i class="fa-solid fa-upload"></i><span><span class="fb-menu-title">custom...</span><span class="fb-menu-desc">upload a SoundFont and use it for all SoundFont channels</span></span>';
        custom.addEventListener('click', () => {
            closeMenus();
            els.globalSoundfontFile.click();
        });
        els.soundfontMenu.append(custom);
        if (failed) {
            els.soundfontMenu.append(menuNotice('fa-triangle-exclamation', 'soundfont list unavailable', 'could not read /others/frdgbeats/soundfonts'));
            return;
        }
        if (!items.length) {
            els.soundfontMenu.append(menuNotice('fa-folder-open', 'no soundfonts found', 'add .sf2 files to /others/frdgbeats/soundfonts'));
            return;
        }
        items.forEach(item => {
            const button = document.createElement('button');
            button.className = 'fb-menu-option';
            button.type = 'button';
            button.innerHTML = '<i class="fa-solid fa-keyboard"></i><span><span class="fb-menu-title"></span><span class="fb-menu-desc">set all SoundFont channels</span></span>';
            button.querySelector('.fb-menu-title').textContent = item.name;
            button.addEventListener('click', async () => {
                closeMenus();
                await setGlobalSoundfontFromUrl(item.url, item.name);
            });
            els.soundfontMenu.append(button);
        });
    }

    async function setGlobalSoundfontFromUrl(url, name) {
        const bank = await loadSoundfontFromUrl(url, name);
        state.channels.forEach(channel => {
            if (channel.source !== 'soundfont') return;
            channel.soundfontSource = 'bundled';
            channel.soundfontUrl = url;
            channel.soundfontName = bank.name;
            applySoundfontPresetToChannel(channel, bank);
        });
        renderChannels();
        renderRoll();
        updateStatus('set all SoundFont channels to ' + soundfontBank.name);
    }

    async function importGlobalSoundfont(file) {
        try {
            const asset = await fileToAsset(file);
            soundfontBank = parseSoundfont(base64ToArrayBuffer(asset.data), file.name.replace(/\.sf2$/i, ''));
            soundfontBank.asset = asset;
            soundfontBank.url = null;
            customSoundfontBank = soundfontBank;
            useCustomSoundfont = true;
            state.channels.forEach(channel => {
                if (channel.source !== 'soundfont') return;
                channel.soundfontSource = 'custom';
                channel.soundfontUrl = '';
                channel.soundfontName = soundfontBank.name;
                applySoundfontPresetToChannel(channel, customSoundfontBank);
            });
            renderChannels();
            renderRoll();
            updateStatus('set all SoundFont channels to ' + soundfontBank.name);
        } catch (_) {
            updateStatus('soundfont import failed');
        }
    }

    function showView(view) {
        if (view === 'waveform' && selectedChannel().source !== 'sample') view = 'roll';
        if (view === 'synth' && selectedChannel().source !== 'synth') view = 'roll';
        currentView = view;
        const isPlaylist = view === 'playlist';
        const isMixer = view === 'mixer';
        const isAutomation = view === 'automation';
        const isWaveform = view === 'waveform';
        const isSynth = view === 'synth';
        if (isPlaying) {
            currentStep = 0;
            if (currentView === 'roll') currentBar = 0;
            nextStepTime = createAudio().context.currentTime + 0.04;
        }
        els.playlistView.classList.toggle('fb-hidden', !isPlaylist);
        els.mixerView.classList.toggle('fb-hidden', !isMixer);
        els.automationView.classList.toggle('fb-hidden', !isAutomation);
        els.waveformView.classList.toggle('fb-hidden', !isWaveform);
        els.synthView.classList.toggle('fb-hidden', !isSynth);
        els.rollView.classList.toggle('fb-hidden', isPlaylist || isMixer || isAutomation || isWaveform || isSynth);
        els.playlistTab.classList.toggle('is-active', isPlaylist);
        els.mixerTab.classList.toggle('is-active', isMixer);
        els.automationTab.classList.toggle('is-active', isAutomation);
        els.waveformTab.classList.toggle('is-active', isWaveform);
        els.synthTab.classList.toggle('is-active', isSynth);
        els.rollTab.classList.toggle('is-active', !isPlaylist && !isMixer && !isAutomation && !isWaveform && !isSynth);
        if (!isPlaylist && !isMixer && !isAutomation && !isWaveform && !isSynth) renderRoll();
        if (isMixer) renderMixer();
        if (isAutomation) renderAutomation();
        if (isWaveform) renderSampleEditor();
        if (isSynth) renderSynthEditor();
        paintPlayhead();
    }

    function closeMenus() {
        els.presetsMenu.classList.add('fb-hidden');
        els.demosMenu.classList.add('fb-hidden');
        els.soundfontMenu.classList.add('fb-hidden');
        els.importMenu.classList.add('fb-hidden');
        els.exportMenu.classList.add('fb-hidden');
    }

    function toggleMenu(menu) {
        const wasHidden = menu.classList.contains('fb-hidden');
        closeMenus();
        menu.classList.toggle('fb-hidden', !wasHidden);
    }

    function renderAll() {
        ensureClipMap();
        renderChannels();
        renderRoll();
        renderPlaylist();
        renderMixer();
        renderAutomation();
        syncWaveformTab();
        syncSynthTab();
        renderSampleEditor();
        renderSynthEditor();
        paintPlayhead();
    }

    function loadDefaultSoundfont() {
        if (soundfontBank.sampleData && (soundfontBank.url === DEFAULT_SOUNDFONT_URL || soundfontBank.asset)) return Promise.resolve(soundfontBank);
        return loadSoundfontFromUrl(DEFAULT_SOUNDFONT_URL, 'Roland SC-55');
    }

    function loadSoundfontFromUrl(url, fallbackName) {
        if (soundfontBank.sampleData && soundfontBank.url === url) {
            soundfontBankCache.set(url, soundfontBank);
            return Promise.resolve(soundfontBank);
        }
        if (soundfontLoadPromise) return soundfontLoadPromise;
        soundfontLoadPromise = (async () => {
            try {
                const response = await fetch(url, { cache: 'force-cache' });
                if (!response.ok) throw new Error('missing soundfont');
                soundfontBank = parseSoundfont(await response.arrayBuffer(), fallbackName || 'SoundFont');
                soundfontBank.asset = null;
                soundfontBank.url = url;
                soundfontBankCache.set(url, soundfontBank);
                useCustomSoundfont = false;
                updateStatus('loaded ' + soundfontBank.name + ' presets');
                return soundfontBank;
            } catch (_) {
                updateStatus('default soundfont unavailable');
                return soundfontBank;
            } finally {
                soundfontLoadPromise = null;
            }
        })();
        return soundfontLoadPromise;
    }

    async function loadChannelSoundfontFromUrl(channel, url, fallbackName) {
        const cached = soundfontBankCache.get(url);
        if (cached) {
            channel.soundfontSource = 'bundled';
            channel.soundfontUrl = url;
            channel.soundfontName = cached.name;
            return cached;
        }
        if (soundfontBank.sampleData && soundfontBank.url === url) {
            soundfontBankCache.set(url, soundfontBank);
            channel.soundfontSource = 'bundled';
            channel.soundfontUrl = url;
            channel.soundfontName = soundfontBank.name;
            return soundfontBank;
        }
        try {
            const response = await fetch(url, { cache: 'force-cache' });
            if (!response.ok) throw new Error('missing soundfont');
            const bank = parseSoundfont(await response.arrayBuffer(), fallbackName || 'SoundFont');
            bank.asset = null;
            bank.url = url;
            soundfontBankCache.set(url, bank);
            channel.soundfontSource = 'bundled';
            channel.soundfontUrl = url;
            channel.soundfontName = bank.name;
            updateStatus('loaded ' + bank.name + ' presets');
            return bank;
        } catch (_) {
            updateStatus('soundfont unavailable');
            return soundfontBankForChannel(channel);
        }
    }

    async function loadSoundfontCatalog() {
        if (soundfontCatalogPromise) return soundfontCatalogPromise;
        soundfontCatalogPromise = (async () => {
            try {
                const response = await fetch(SOUNDFONT_LIST_URL, { cache: 'no-store' });
                if (!response.ok) throw new Error('soundfont list failed');
                const items = await response.json();
                const listed = Array.isArray(items)
                    ? items.filter(item => item && item.url && item.name)
                    : [];
                if (listed.length) {
                    soundfontCatalog = listed;
                    renderChannels();
                    renderSoundfontMenu(soundfontCatalog, false);
                }
            } catch (_) {
                updateStatus('soundfont catalog unavailable');
                renderSoundfontMenu(soundfontCatalog, true);
            } finally {
                soundfontCatalogPromise = null;
            }
        })();
        return soundfontCatalogPromise;
    }

    async function loadSampleCatalog() {
        if (sampleCatalogPromise) return sampleCatalogPromise;
        sampleCatalogPromise = (async () => {
            try {
                const response = await fetch(SAMPLE_LIST_URL, { cache: 'no-store' });
                if (!response.ok) throw new Error('sample list failed');
                const items = await response.json();
                sampleCatalog = Array.isArray(items)
                    ? items.filter(item => item && item.url && item.name)
                    : [];
                renderChannels();
            } catch (_) {
                updateStatus('sample catalog unavailable');
            } finally {
                sampleCatalogPromise = null;
            }
        })();
        return sampleCatalogPromise;
    }

    async function loadSampleFromUrl(channel, url, name = '', progress = null) {
        const ownProgress = progress === false ? null : (progress || showExportProgress('loading sample...', 'fetching sample'));
        try {
            if (ownProgress) await setExportProgress(ownProgress, 12, 'fetching sample', 30);
            const engine = createAudio();
            const response = await fetch(url, { cache: 'force-cache' });
            if (!response.ok) throw new Error('sample load failed');
            if (ownProgress) await setExportProgress(ownProgress, 42, 'reading sample data', 30);
            const data = await response.arrayBuffer();
            if (ownProgress) await setExportProgress(ownProgress, 68, 'decoding audio', 30);
            channel.sampleBuffer = await engine.context.decodeAudioData(data.slice(0));
            channel.sampleName = name || url.split('/').pop() || 'sample';
            channel.sampleUrl = url;
            channel.sampleSource = 'bundled';
            channel.sampleAsset = null;
            updateStatus('loaded sample: ' + channel.sampleName);
            renderSampleEditor();
            warmSamplePitchCache(channel);
            if (ownProgress) await setExportProgress(ownProgress, 100, 'loaded sample', 80);
        } catch (_) {
            updateStatus('sample load failed');
        } finally {
            if (ownProgress && !progress) ownProgress.close();
        }
    }

    function loadEffectScript(url) {
        return new Promise((resolve, reject) => {
            if (root.querySelector('script[data-effect-url="' + url + '"]')) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = url;
            script.async = false;
            script.dataset.effectUrl = url;
            script.addEventListener('load', resolve, { once: true });
            script.addEventListener('error', reject, { once: true });
            root.append(script);
        });
    }

    function loadSynthScript(url) {
        return new Promise((resolve, reject) => {
            if (root.querySelector('script[data-synth-url="' + url + '"]')) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = url;
            script.async = false;
            script.dataset.synthUrl = url;
            script.addEventListener('load', resolve, { once: true });
            script.addEventListener('error', reject, { once: true });
            root.append(script);
        });
    }

    async function loadEffectCatalog() {
        if (effectCatalogPromise) return effectCatalogPromise;
        renderEffectPicker();
        effectCatalogPromise = (async () => {
            try {
                const response = await fetch(EFFECT_LIST_URL, { cache: 'no-store' });
                if (!response.ok) throw new Error('effect list failed');
                const items = await response.json();
                const urls = Array.isArray(items) ? items.map(item => item.url).filter(Boolean) : [];
                for (const url of urls) await loadEffectScript(url);
                renderEffectPicker();
                renderMixer();
                renderAutomation();
                rebuildAllChannelOutputs();
                updateStatus('loaded ' + effectDefinitions.size + ' effects');
            } catch (_) {
                updateStatus('effect catalog unavailable');
            } finally {
                effectCatalogPromise = null;
            }
        })();
        return effectCatalogPromise;
    }

    async function loadSynthCatalog() {
        if (synthCatalogPromise) return synthCatalogPromise;
        synthCatalogPromise = (async () => {
            try {
                const response = await fetch(SYNTH_LIST_URL, { cache: 'no-store' });
                if (!response.ok) throw new Error('synth list failed');
                const items = await response.json();
                const urls = Array.isArray(items) ? items.map(item => item.url).filter(Boolean) : [];
                for (const url of urls) await loadSynthScript(url);
                state.channels.forEach(channel => {
                    migrateWaveChannel(channel);
                    if (channel.source === 'synth' && !synthDefinitions.has(channel.synthType)) {
                        const first = synthDefinitions.values().next().value;
                        if (first) channel.synthType = first.id;
                    }
                    if (channel.source === 'synth') ensureChannelSynth(channel);
                });
                renderChannels();
                renderSynthEditor();
                renderAutomation();
                syncSynthTab();
                updateStatus('loaded ' + synthDefinitions.size + ' synths');
            } catch (_) {
                updateStatus('synth catalog unavailable');
            } finally {
                synthCatalogPromise = null;
            }
        })();
        return synthCatalogPromise;
    }

    els.play.addEventListener('click', togglePlayback);
    els.stop.addEventListener('click', stopButtonPressed);
    els.record.addEventListener('click', () => {
        isRecording = !isRecording;
        els.record.classList.toggle('is-active', isRecording);
        els.record.classList.toggle('is-recording', isRecording);
        updateStatus(isRecording ? 'record armed' : 'record off');
        if (isRecording) createAudio().context.resume();
    });
    els.bpm.addEventListener('input', () => {
        state.bpm = Math.max(60, Math.min(200, Number(els.bpm.value) || 128));
        rebuildAllChannelOutputs();
    });
    els.masterVolume.addEventListener('input', () => {
        state.masterVolume = Math.max(0, Math.min(1, Number(els.masterVolume.value) || 0));
        if (audio) audio.master.gain.value = state.masterVolume;
        syncUtilityMeters();
    });
    els.projectName.addEventListener('input', () => {
        state.projectName = els.projectName.value.trim() || 'Untitled';
    });
    els.projectName.addEventListener('blur', () => {
        els.projectName.value = state.projectName;
    });
    els.projectName.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            event.preventDefault();
            els.projectName.blur();
        }
    });
    els.octave.addEventListener('change', () => {
        state.octave = octavePage(els.octave.value);
        els.octave.value = String(state.octave);
        renderRoll();
        warmSamplePitchCache();
    });
    els.noteSnap.addEventListener('change', () => {
        setNoteSnap(els.noteSnap.value);
        renderRoll();
        updateStatus('note snap set to ' + els.noteSnap.options[els.noteSnap.selectedIndex].textContent);
    });
    els.pattern.addEventListener('change', () => {
        const channel = selectedChannel();
        channel.activePattern = Number(els.pattern.value) || 0;
        channel.pattern = getPattern(channel);
        renderChannels();
        renderRoll();
        renderAutomation();
    });
    els.patternSteps.addEventListener('change', () => {
        setProjectSteps(els.patternSteps.value, true);
        renderChannels();
        renderRoll();
        renderPlaylist();
        paintPlayhead();
        updateStatus('beats set to ' + stepCount());
    });
    els.addChannel.addEventListener('click', addChannel);
    els.clearPattern.addEventListener('click', () => {
        const channel = selectedChannel();
        channel.patterns[channel.activePattern] = Array(stepCount()).fill(null);
        channel.pattern = channel.patterns[channel.activePattern];
        renderChannels();
        renderRoll();
    });
    els.clearPlaylist.addEventListener('click', () => {
        state.channels.forEach(channel => {
            state.clips[channel.id] = Array.from({ length: state.barCount }, () => null);
        });
        renderPlaylist();
    });
    els.rollTab.addEventListener('click', () => showView('roll'));
    els.playlistTab.addEventListener('click', () => showView('playlist'));
    els.mixerTab.addEventListener('click', () => showView('mixer'));
    els.automationTab.addEventListener('click', () => showView('automation'));
    els.waveformTab.addEventListener('click', () => showView('waveform'));
    els.synthTab.addEventListener('click', () => showView('synth'));
    els.automationPattern.addEventListener('change', () => {
        const channel = selectedChannel();
        channel.activePattern = normalizeAutomationPatternIndex(els.automationPattern.value);
        channel.pattern = getPattern(channel);
        els.pattern.value = String(channel.activePattern);
        renderChannels();
        renderRoll();
        renderAutomation();
    });
    els.addAutomation.addEventListener('click', addAutomationLaneToSelectedChannel);
    els.sampleZoomOut.addEventListener('click', () => setSampleEditorZoom(0.5));
    els.sampleZoomReset.addEventListener('click', () => {
        const channel = selectedChannel();
        channel.sampleEditorZoom = 1;
        channel.sampleEditorOffset = 0;
        drawSampleEditor();
    });
    els.sampleZoomIn.addEventListener('click', () => setSampleEditorZoom(2));
    els.sampleScroll.addEventListener('input', () => {
        const channel = selectedChannel();
        const view = sampleEditorZoom(channel);
        channel.sampleEditorOffset = Math.max(0, Math.min(1 - view.span, Number(els.sampleScroll.value) || 0));
        drawSampleEditor();
    });
    els.removeSampleZone.addEventListener('click', removeSampleZone);
    els.sampleCanvas.addEventListener('pointerdown', beginSampleEditorDrag);
    els.sampleCanvas.addEventListener('contextmenu', showSampleZonePopup);
    els.sampleCanvas.addEventListener('wheel', event => {
        event.preventDefault();
        panSampleEditor((event.deltaY || event.deltaX) > 0 ? 0.12 : -0.12);
    }, { passive: false });
    window.addEventListener('pointermove', moveSampleEditorDrag);
    window.addEventListener('pointerup', endSampleEditorDrag);
    els.addEffect.addEventListener('click', addEffectToSelectedChannel);
    els.save.addEventListener('click', saveProject);
    els.load.addEventListener('click', () => loadProject());
    els.newProject.addEventListener('click', event => {
        event.stopPropagation();
        const shouldLoad = els.presetsMenu.classList.contains('fb-hidden');
        toggleMenu(els.presetsMenu);
        if (shouldLoad) loadPresetList();
    });
    els.demosMenuButton.addEventListener('click', event => {
        event.stopPropagation();
        const shouldLoad = els.demosMenu.classList.contains('fb-hidden');
        toggleMenu(els.demosMenu);
        if (shouldLoad) loadDemoList();
    });
    els.globalSoundfont.addEventListener('click', event => {
        event.stopPropagation();
        renderSoundfontMenu(soundfontCatalog, false);
        toggleMenu(els.soundfontMenu);
    });
    els.globalSoundfontFile.addEventListener('change', async () => {
        const file = els.globalSoundfontFile.files && els.globalSoundfontFile.files[0];
        if (!file) return;
        await importGlobalSoundfont(file);
        els.globalSoundfontFile.value = '';
    });
    els.importMenuButton.addEventListener('click', event => {
        event.stopPropagation();
        toggleMenu(els.importMenu);
    });
    els.exportMenuButton.addEventListener('click', event => {
        event.stopPropagation();
        toggleMenu(els.exportMenu);
    });
    els.demosMenu.addEventListener('click', event => event.stopPropagation());
    els.presetsMenu.addEventListener('click', event => event.stopPropagation());
    els.soundfontMenu.addEventListener('click', event => event.stopPropagation());
    els.importMenu.addEventListener('click', event => event.stopPropagation());
    els.exportMenu.addEventListener('click', event => event.stopPropagation());
    document.addEventListener('click', event => {
        closeMenus();
        if (!event.target.closest('.fb-velocity-popover')) closeVelocityEditor();
    });
    els.exportProject.addEventListener('click', () => {
        closeMenus();
        exportProjectFile();
    });
    els.importProject.addEventListener('click', () => {
        closeMenus();
        els.projectFile.click();
    });
    els.projectFile.addEventListener('change', async () => {
        const file = els.projectFile.files && els.projectFile.files[0];
        if (!file) return;
        try {
            await importProjectFile(file);
        } catch (_) {
            updateStatus('project import failed');
        } finally {
            els.projectFile.value = '';
        }
    });
    els.importMidi.addEventListener('click', () => {
        closeMenus();
        els.midiFile.click();
    });
    els.midiFile.addEventListener('change', async () => {
        const file = els.midiFile.files && els.midiFile.files[0];
        if (!file) return;
        const confirmed = await showConfirmDialog('import MIDI', 'this will overwrite your current project. are you sure?', 'import');
        if (!confirmed) {
            els.midiFile.value = '';
            return;
        }
        try {
            await importMidiFile(file);
        } catch (_) {
            updateStatus('MIDI import failed');
        } finally {
            els.midiFile.value = '';
        }
    });
    els.exportMidi.addEventListener('click', () => {
        closeMenus();
        exportMidi();
    });
    els.exportWav.addEventListener('click', () => {
        closeMenus();
        exportWav();
    });
    els.pianoRoll.addEventListener('click', handlePianoRollClick);
    els.pianoRoll.addEventListener('pointerdown', handlePianoRollPointerDown);

    document.addEventListener('keydown', event => {
        if (!root.isConnected) return;
        const target = event.target;
        if (target && target.closest('input, textarea, select, button, [contenteditable="true"]')) return;
        if (event.code === 'Space') {
            event.preventDefault();
            togglePlayback();
            return;
        }
        const key = event.key.toLowerCase();
        const note = keyboardNote(event);
        if (!note || heldKeys.has(key)) return;
        heldKeys.add(key);
        event.preventDefault();
        const channel = selectedChannel();
        if (isRecording) {
            const pattern = getPattern(channel);
            const events = getStepEvents(pattern, currentStep);
            if (!events.some(event => event.note === note)) {
                events.push({ note, length: 1, velocity: 1 });
            }
            channel.pattern = pattern;
            renderChannels();
            renderRoll();
        }
        startKeyboardNote(key, note);
    });

    document.addEventListener('keyup', event => {
        const key = event.key.toLowerCase();
        heldKeys.delete(key);
        stopKeyboardNote(key);
    });

    document.addEventListener('pointermove', event => {
        if (!resizingNote && !slidingNote && !placingNote && !movingNote) return;
        event.preventDefault();
        if (resizingNote) resizeActiveNote(event.clientX, event.clientY);
        if (slidingNote) slideActiveNote(event.clientX, event.clientY);
        if (placingNote && placingNote.pointerId === event.pointerId) movePlacedNote(event.clientX, event.clientY);
        if (movingNote) moveExistingNote(event.clientX, event.clientY);
    });

    document.addEventListener('pointerup', event => {
        stopRollPreviewVoice(event.pointerId);
        if (placingNote && placingNote.pointerId === event.pointerId) {
            try {
                if (els.pianoRoll.hasPointerCapture(event.pointerId)) els.pianoRoll.releasePointerCapture(event.pointerId);
            } catch (_) {
                /* no-op */
            }
            placingNote = null;
            suppressRollClick = true;
        }
        if (movingNote) {
            if (!movingNote.dragged) {
                removeNoteEvent(movingNote.channel, movingNote.pattern, movingNote.step, movingNote.note, movingNote.eventIndex);
                suppressRollClick = true;
            }
            try {
                if (els.pianoRoll.hasPointerCapture(event.pointerId)) els.pianoRoll.releasePointerCapture(event.pointerId);
            } catch (_) {
                /* no-op */
            }
            movingNote = null;
            renderRoll();
            renderChannels();
            return;
        }
        if (!resizingNote && !slidingNote) return;
        if (slidingNote && !slidingNote.dragged) {
            removeNoteEvent(slidingNote.channel, slidingNote.pattern, slidingNote.step, slidingNote.note, slidingNote.eventIndex);
            suppressRollClick = true;
        }
        resizingNote = null;
        slidingNote = null;
        renderRoll();
        renderChannels();
    });

    document.addEventListener('pointercancel', event => {
        stopRollPreviewVoice(event.pointerId);
        if (placingNote && placingNote.pointerId === event.pointerId) {
            try {
                if (els.pianoRoll.hasPointerCapture(event.pointerId)) els.pianoRoll.releasePointerCapture(event.pointerId);
            } catch (_) {
                /* no-op */
            }
            placingNote = null;
        }
        if (movingNote) movingNote = null;
    });

    window.addEventListener('blur', () => {
        stopKeyboardNotes();
        stopRollPreviewVoice();
        placingNote = null;
        movingNote = null;
    });

    window.addEventListener('resize', () => {
        if (!root.isConnected || currentView !== 'roll') return;
        window.clearTimeout(rollResizeTimer);
        rollResizeTimer = window.setTimeout(renderRoll, 60);
    });

    window.addEventListener('pagehide', () => {
        stopKeyboardNotes();
        stopRollPreviewVoice();
        placingNote = null;
        movingNote = null;
        stop(false);
        if (meterAnimation) window.cancelAnimationFrame(meterAnimation);
    });

    els.bpm.value = String(state.bpm);
    els.projectName.value = state.projectName;
    els.pattern.value = String(selectedChannel().activePattern || 0);
    els.patternSteps.value = String(stepCount());
    els.noteSnap.value = String(state.noteSnap);
    els.masterVolume.value = String(state.masterVolume);
    renderAll();
    syncUtilityMeters();
    drawWaveform(true);
    loadSoundfontCatalog();
    loadSampleCatalog();
    loadEffectCatalog();
    loadSynthCatalog();
    loadDefaultSoundfont();
})();
