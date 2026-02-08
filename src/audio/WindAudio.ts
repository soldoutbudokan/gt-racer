import { audioEngine } from './AudioEngine';
import { clamp } from '../utils/math';

export class WindAudio {
  private source: AudioBufferSourceNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private gain: GainNode | null = null;
  private started = false;

  start(volume: number = 0.3): void {
    const ctx = audioEngine.getContext();
    const dest = audioEngine.getMasterGain();
    if (!ctx || !dest || this.started) return;

    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    this.source = ctx.createBufferSource();
    this.source.buffer = buffer;
    this.source.loop = true;

    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 500;
    this.filter.Q.value = 0.5;

    this.gain = ctx.createGain();
    this.gain.gain.value = 0;

    this.source.connect(this.filter);
    this.filter.connect(this.gain);
    this.gain.connect(dest);
    this.source.start();

    this.started = true;
  }

  update(speed: number): void {
    if (!this.started) return;
    const speedNorm = clamp(speed / 80, 0, 1);
    if (this.gain) this.gain.gain.value = speedNorm * speedNorm * 0.15;
    if (this.filter) this.filter.frequency.value = 300 + speedNorm * 2000;
  }

  stop(): void {
    if (!this.started) return;
    try { this.source?.stop(); } catch {}
    this.gain?.disconnect();
    this.started = false;
  }
}
