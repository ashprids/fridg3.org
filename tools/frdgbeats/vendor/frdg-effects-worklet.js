class FrdgBitcrushProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super();
        const settings = options.processorOptions || {};
        this.bits = Math.max(2, Math.min(16, Math.round(Number(settings.bits) || 7)));
        this.reduction = Math.max(1, Math.min(40, Math.round(Number(settings.rate) || 9)));
        this.jitter = Math.max(0, Math.min(1, Number(settings.jitter) || 0));
        this.mix = Math.max(0, Math.min(1, Number(settings.mix) || 0));
        this.outputGain = Math.max(0.15, Math.min(1.2, Number(settings.output) || 0.9));
        this.levels = Math.max(2, Math.pow(2, this.bits));
        this.holds = [];
        this.phases = [];
        this.randomState = 0x6d2b79f5;
    }

    random() {
        let value = this.randomState += 0x6d2b79f5;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    }

    process(inputs, outputs) {
        const input = inputs[0];
        const output = outputs[0];
        const dryGain = 1 - (this.mix * 0.85);
        for (let channel = 0; channel < output.length; channel += 1) {
            const source = input[Math.min(channel, input.length - 1)];
            const dest = output[channel];
            let hold = this.holds[channel] || 0;
            let phase = this.phases[channel] || 0;
            for (let index = 0; index < dest.length; index += 1) {
                const sample = source ? source[index] : 0;
                if (phase <= 0) {
                    hold = Math.round(sample * this.levels) / this.levels;
                    phase = this.reduction + (this.jitter ? this.random() * this.jitter * this.reduction : 0);
                }
                dest[index] = ((sample * dryGain) + (hold * this.mix)) * this.outputGain;
                phase -= 1;
            }
            this.holds[channel] = hold;
            this.phases[channel] = phase;
        }
        return true;
    }
}

function dbToGain(db) {
    return Math.pow(10, db / 20);
}

function gainToDb(gain) {
    return 20 * Math.log10(Math.max(0.0000001, gain));
}

function gainReductionDb(levelDb, threshold, ratio, knee) {
    if (knee <= 0) {
        return levelDb > threshold ? (threshold + ((levelDb - threshold) / ratio)) - levelDb : 0;
    }
    const lower = threshold - (knee / 2);
    const upper = threshold + (knee / 2);
    if (levelDb <= lower) return 0;
    if (levelDb >= upper) return (threshold + ((levelDb - threshold) / ratio)) - levelDb;
    const distance = levelDb - lower;
    return (1 / ratio - 1) * distance * distance / (2 * knee);
}

class FrdgDynamicsProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super();
        const settings = options.processorOptions || {};
        this.threshold = Math.max(-60, Math.min(0, Number.isFinite(Number(settings.threshold)) ? Number(settings.threshold) : -24));
        this.ratio = Math.max(1, Math.min(20, Number(settings.ratio) || 4));
        this.attack = Math.max(0.0001, Math.min(0.12, Number(settings.attack) || 0.012));
        this.release = Math.max(0.002, Math.min(1, Number(settings.release) || 0.24));
        this.knee = Math.max(0, Math.min(40, Number(settings.knee) || 0));
        this.drive = Math.max(0.01, Number(settings.drive) || 1);
        this.makeup = Math.max(0.01, Number(settings.makeup) || 1);
        this.ceiling = Number.isFinite(settings.ceiling) ? Math.max(0.01, Number(settings.ceiling)) : Infinity;
        this.gain = 1;
        this.attackCoefficient = Math.exp(-1 / (this.attack * sampleRate));
        this.releaseCoefficient = Math.exp(-1 / (this.release * sampleRate));
    }

    process(inputs, outputs) {
        const input = inputs[0];
        const output = outputs[0];
        const frameCount = output[0] ? output[0].length : 0;
        for (let index = 0; index < frameCount; index += 1) {
            let peak = 0;
            for (let channel = 0; channel < input.length; channel += 1) {
                peak = Math.max(peak, Math.abs(input[channel][index] * this.drive));
            }
            const reduction = gainReductionDb(gainToDb(peak), this.threshold, this.ratio, this.knee);
            const targetGain = dbToGain(reduction);
            const coefficient = targetGain < this.gain ? this.attackCoefficient : this.releaseCoefficient;
            this.gain = targetGain + (coefficient * (this.gain - targetGain));
            for (let channel = 0; channel < output.length; channel += 1) {
                const source = input[Math.min(channel, input.length - 1)];
                const sample = (source ? source[index] : 0) * this.drive * this.gain * this.makeup;
                output[channel][index] = Number.isFinite(this.ceiling)
                    ? Math.max(-this.ceiling, Math.min(this.ceiling, sample))
                    : sample;
            }
        }
        return true;
    }
}

registerProcessor('frdg-bitcrush', FrdgBitcrushProcessor);
registerProcessor('frdg-compressor', FrdgDynamicsProcessor);
registerProcessor('frdg-limiter', FrdgDynamicsProcessor);
