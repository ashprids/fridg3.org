/* global WebAssembly */
(function () {
    'use strict';

    const WASM_URLS = [
        '/others/frdgbeats/vendor/rubberband.wasm',
        'https://cdn.jsdelivr.net/npm/rubberband-wasm@3.3.0/dist/rubberband.wasm'
    ];

    const OPTIONS = {
        processOffline: 0x00000000,
        stretchPrecise: 0x00000010,
        transientsMixed: 0x00000100,
        detectorSoft: 0x00000800,
        phaseLaminar: 0x00000000,
        threadingNever: 0x00010000,
        windowStandard: 0x00000000,
        smoothingOn: 0x00800000,
        pitchHighQuality: 0x02000000,
        channelsTogether: 0x10000000,
        engineFiner: 0x20000000
    };

    class RubberBand {
        constructor(instance) {
            this.exports = instance.exports;
            this.heap8 = new Uint8Array(this.exports.memory.buffer);
            this.heap32 = new Uint32Array(this.exports.memory.buffer);
        }

        static async create(module) {
            let api = null;
            const refreshHeap = () => {
                if (!api) return;
                api.heap8 = new Uint8Array(api.exports.memory.buffer);
                api.heap32 = new Uint32Array(api.exports.memory.buffer);
            };
            const wasiError = () => 52;
            let printBuffer = [];
            const instance = await WebAssembly.instantiate(module, {
                env: {
                    emscripten_notify_memory_growth: refreshHeap
                },
                wasi_snapshot_preview1: {
                    proc_exit: wasiError,
                    fd_read: wasiError,
                    fd_write: (fd, iov, iovcnt, pnum) => {
                        if (fd > 2) return 52;
                        let written = 0;
                        for (let i = 0; i < iovcnt; i += 1) {
                            const ptr = api.heap32[iov >> 2];
                            const len = api.heap32[(iov + 4) >> 2];
                            iov += 8;
                            for (let j = 0; j < len; j += 1) {
                                const char = api.heap8[ptr + j];
                                if (char === 0 || char === 10) {
                                    printBuffer = [];
                                } else {
                                    printBuffer.push(String.fromCharCode(char));
                                }
                            }
                            written += len;
                        }
                        api.heap32[pnum >> 2] = written;
                        return 0;
                    },
                    fd_seek: wasiError,
                    fd_close: wasiError,
                    environ_sizes_get: wasiError,
                    environ_get: wasiError,
                    clock_time_get: wasiError
                }
            });
            api = new RubberBand(instance);
            api.exports._initialize();
            return api;
        }

        malloc(bytes) {
            return this.exports.wasm_malloc(bytes);
        }

        free(ptr) {
            if (ptr) this.exports.wasm_free(ptr);
        }

        writeF32(ptr, data) {
            this.heap8.set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength), ptr);
        }

        writeU32(ptr, value) {
            this.heap32[ptr >> 2] = value;
        }

        readF32(ptr, length) {
            return new Float32Array(this.heap8.buffer, ptr, length).slice();
        }
    }

    let rubberBandPromise = null;

    async function loadRubberBand() {
        if (rubberBandPromise) return rubberBandPromise;
        rubberBandPromise = (async () => {
            let lastError = null;
            for (const url of WASM_URLS) {
                try {
                    const response = await fetch(url);
                    if (!response.ok) throw new Error('HTTP ' + response.status);
                    const module = await WebAssembly.compile(await response.arrayBuffer());
                    return RubberBand.create(module);
                } catch (error) {
                    lastError = error;
                }
            }
            throw lastError || new Error('Rubber Band wasm unavailable');
        })();
        return rubberBandPromise;
    }

    function optionMask() {
        return OPTIONS.processOffline
            | OPTIONS.stretchPrecise
            | OPTIONS.transientsMixed
            | OPTIONS.detectorSoft
            | OPTIONS.phaseLaminar
            | OPTIONS.threadingNever
            | OPTIONS.windowStandard
            | OPTIONS.smoothingOn
            | OPTIONS.pitchHighQuality
            | OPTIONS.channelsTogether
            | OPTIONS.engineFiner;
    }

    function makeChannelPointers(api, channelData) {
        const dataPtrs = [];
        const pointerTable = api.malloc(channelData.length * 4);
        channelData.forEach((channel, index) => {
            const ptr = api.malloc(channel.length * 4);
            api.writeF32(ptr, channel);
            api.writeU32(pointerTable + (index * 4), ptr);
            dataPtrs.push(ptr);
        });
        return { pointerTable, dataPtrs };
    }

    function freeChannelPointers(api, pointers) {
        if (!pointers) return;
        pointers.dataPtrs.forEach(ptr => api.free(ptr));
        api.free(pointers.pointerTable);
    }

    function padInput(channels, pad) {
        if (!pad) return channels;
        return channels.map(channel => {
            const padded = new Float32Array(channel.length + pad);
            padded.set(channel, pad);
            return padded;
        });
    }

    function trimOutput(channels, start, length) {
        return channels.map(channel => {
            const output = new Float32Array(length);
            output.set(channel.subarray(start, Math.min(channel.length, start + length)));
            return output;
        });
    }

    async function processPitchShift(message) {
        const api = await loadRubberBand();
        const channels = message.channels.map(buffer => new Float32Array(buffer));
        const channelCount = Math.max(1, channels.length);
        const inputFrames = channels[0].length;
        const pitchScale = Math.max(0.25, Math.min(4, Number(message.pitchScale) || 1));
        const sampleRate = Math.max(8000, Number(message.sampleRate) || 44100);
        const state = api.exports.rb_new(sampleRate, channelCount, optionMask(), 1, pitchScale);
        if (!state) throw new Error('Rubber Band state failed');

        let input = null;
        let output = null;
        try {
            api.exports.rb_set_expected_input_duration(state, inputFrames);
            api.exports.rb_set_max_process_size(state, inputFrames + 8192);
            const pad = Math.max(0, api.exports.rb_get_preferred_start_pad(state) || 0);
            const delay = Math.max(0, api.exports.rb_get_start_delay(state) || 0);
            const padded = padInput(channels, pad);
            input = makeChannelPointers(api, padded);
            api.exports.rb_study(state, input.pointerTable, padded[0].length, 1);
            api.exports.rb_calculate_stretch(state);
            api.exports.rb_process(state, input.pointerTable, padded[0].length, 1);

            let available = Math.max(0, api.exports.rb_available(state) || 0);
            if (!available) {
                return {
                    sampleRate,
                    channels: channels.map(channel => channel.buffer),
                    fallback: true
                };
            }
            output = {
                pointerTable: api.malloc(channelCount * 4),
                dataPtrs: []
            };
            for (let index = 0; index < channelCount; index += 1) {
                const ptr = api.malloc(available * 4);
                api.writeU32(output.pointerTable + (index * 4), ptr);
                output.dataPtrs.push(ptr);
            }
            const retrieved = Math.max(0, api.exports.rb_retrieve(state, output.pointerTable, available) || 0);
            const raw = output.dataPtrs.map(ptr => api.readF32(ptr, retrieved));
            const trimmed = trimOutput(raw, Math.min(delay, Math.max(0, retrieved - 1)), inputFrames);
            return {
                sampleRate,
                channels: trimmed.map(channel => channel.buffer),
                fallback: false
            };
        } finally {
            freeChannelPointers(api, input);
            freeChannelPointers(api, output);
            api.exports.rb_delete(state);
        }
    }

    self.addEventListener('message', event => {
        const message = event.data || {};
        if (message.type !== 'pitch-shift') return;
        processPitchShift(message)
            .then(result => {
                self.postMessage({
                    id: message.id,
                    type: 'pitch-shift-result',
                    sampleRate: result.sampleRate,
                    channels: result.channels,
                    fallback: result.fallback
                }, result.channels);
            })
            .catch(error => {
                self.postMessage({
                    id: message.id,
                    type: 'pitch-shift-error',
                    message: error && error.message ? error.message : 'Rubber Band failed'
                });
            });
    });
})();
