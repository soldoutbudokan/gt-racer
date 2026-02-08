import { audioEngine } from './AudioEngine';
import { clamp } from '../utils/math';

export class TireAudio {
  private screechSource: AudioBufferSourceNode | null = null;
  private screechFilter: BiquadFilterNode | null = null;
  private screechGain: GainNode | null = null;
  private rollingSource: AudioBufferSourceNode | null = null;
  private rollingGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private started = false;

  start(volume: number = 0.5): void {
    const ctx = audioEngine.getContext();
    const dest = audioEngine.getMasterGain();
    if (!ctx || !dest || this.started) return;

    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = volume;
    this.masterGain.connect(dest);

    // Screech: white noise through bandpass
    const screechBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const screechData = screechBuffer.getChannelData(0);
    for (let i = 0; i < screechData.length; i++) {
      screechData[i] = Math.random() * 2 - 1;
    }
    this.screechSource = ctx.createBufferSource();
    this.screechSource.buffer = screechBuffer;
    this.screechSource.loop = true;
    this.screechFilter = ctx.createBiquadFilter();
    this.screechFilter.type = 'bandpass';
    this.screechFilter.frequency.value = 3000;
    this.screechFilter.Q.value = 2;
    this.screechGain = ctx.createGain();
    this.screechGain.gain.value = 0;
    this.screechSource.connect(this.screechFilter);
    this.screechFilter.connect(this.screechGain);
    this.screechGain.connect(this.masterGain);
    this.screechSource.start();

    // Rolling: brown noise
    const rollingBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const rollingData = rollingBuffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < rollingData.length; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + (0.02 * white)) / 1.02;
      rollingData[i] = lastOut * 3.5;
    }
    this.rollingSource = ctx.createBufferSource();
    this.rollingSource.buffer = rollingBuffer;
    this.rollingSource.loop = true;
    this.rollingGain = ctx.createGain();
    this.rollingGain.gain.value = 0;
    this.rollingSource.connect(this.rollingGain);
    this.rollingGain.connect(this.masterGain);
    this.rollingSource.start();

    this.started = true;
  }

  update(slipAngle: number, speed: number): void {
    if (!this.started) return;

    // Screech volume from slip angle
    const absSlip = Math.abs(slipAngle);
    const screechVol = clamp((absSlip - 0.05) * 5, 0, 0.4);
    if (this.screechGain) this.screechGain.gain.value = screechVol;
    if (this.screechFilter) {
      this.screechFilter.frequency.value = 2000 + speed * 20;
    }

    // Rolling volume from speed
    const rollingVol = clamp(speed / 50, 0, 0.15);
    if (this.rollingGain) this.rollingGain.gain.value = rollingVol;
    if (this.rollingSource) {
      this.rollingSource.playbackRate.value = 0.5 + clamp(speed / 80, 0, 1.5);
    }
  }

  stop(): void {
    if (!this.started) return;
    try {
      this.screechSource?.stop();
      this.rollingSource?.stop();
    } catch {}
    this.masterGain?.disconnect();
    this.started = false;
  }
}
