import { audioEngine } from './AudioEngine';
import { clamp, remap } from '../utils/math';

export class EngineSynth {
  private fundamentalOsc: OscillatorNode | null = null;
  private harmonicOsc1: OscillatorNode | null = null;
  private harmonicOsc2: OscillatorNode | null = null;
  private exhaustOsc: OscillatorNode | null = null;
  private noiseSource: AudioBufferSourceNode | null = null;
  private fundamentalGain: GainNode | null = null;
  private harmonicGain1: GainNode | null = null;
  private harmonicGain2: GainNode | null = null;
  private exhaustGain: GainNode | null = null;
  private noiseGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private started = false;

  start(volume: number = 0.7): void {
    const ctx = audioEngine.getContext();
    const dest = audioEngine.getMasterGain();
    if (!ctx || !dest || this.started) return;

    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = volume;
    this.masterGain.connect(dest);

    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 800;
    this.filter.Q.value = 1;
    this.filter.connect(this.masterGain);

    // Fundamental - sawtooth for intake growl
    this.fundamentalOsc = ctx.createOscillator();
    this.fundamentalOsc.type = 'sawtooth';
    this.fundamentalOsc.frequency.value = 30;
    this.fundamentalGain = ctx.createGain();
    this.fundamentalGain.gain.value = 0.3;
    this.fundamentalOsc.connect(this.fundamentalGain);
    this.fundamentalGain.connect(this.filter);
    this.fundamentalOsc.start();

    // First harmonic
    this.harmonicOsc1 = ctx.createOscillator();
    this.harmonicOsc1.type = 'sawtooth';
    this.harmonicOsc1.frequency.value = 60;
    this.harmonicGain1 = ctx.createGain();
    this.harmonicGain1.gain.value = 0.15;
    this.harmonicOsc1.connect(this.harmonicGain1);
    this.harmonicGain1.connect(this.filter);
    this.harmonicOsc1.start();

    // Second harmonic
    this.harmonicOsc2 = ctx.createOscillator();
    this.harmonicOsc2.type = 'square';
    this.harmonicOsc2.frequency.value = 90;
    this.harmonicGain2 = ctx.createGain();
    this.harmonicGain2.gain.value = 0.08;
    this.harmonicOsc2.connect(this.harmonicGain2);
    this.harmonicGain2.connect(this.filter);
    this.harmonicOsc2.start();

    // Exhaust - square wave for pop character
    this.exhaustOsc = ctx.createOscillator();
    this.exhaustOsc.type = 'square';
    this.exhaustOsc.frequency.value = 15;
    this.exhaustGain = ctx.createGain();
    this.exhaustGain.gain.value = 0.1;
    this.exhaustOsc.connect(this.exhaustGain);
    this.exhaustGain.connect(this.filter);
    this.exhaustOsc.start();

    // Noise layer for mechanical texture
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = (Math.random() * 2 - 1) * 0.3;
    }
    this.noiseSource = ctx.createBufferSource();
    this.noiseSource.buffer = noiseBuffer;
    this.noiseSource.loop = true;
    this.noiseGain = ctx.createGain();
    this.noiseGain.gain.value = 0.02;
    this.noiseSource.connect(this.noiseGain);
    this.noiseGain.connect(this.filter);
    this.noiseSource.start();

    this.started = true;
  }

  update(rpm: number, throttle: number, _redlineRpm: number = 7000): void {
    if (!this.started) return;

    const rpmNorm = clamp(rpm / 8000, 0, 1);
    const fundamentalFreq = 20 + rpmNorm * 80;

    if (this.fundamentalOsc) this.fundamentalOsc.frequency.value = fundamentalFreq;
    if (this.harmonicOsc1) this.harmonicOsc1.frequency.value = fundamentalFreq * 2;
    if (this.harmonicOsc2) this.harmonicOsc2.frequency.value = fundamentalFreq * 3;
    if (this.exhaustOsc) this.exhaustOsc.frequency.value = fundamentalFreq * 0.5;

    // Volume scales with throttle
    const baseVol = 0.15 + throttle * 0.2;
    if (this.fundamentalGain) this.fundamentalGain.gain.value = baseVol;
    if (this.harmonicGain1) this.harmonicGain1.gain.value = baseVol * 0.5;
    if (this.harmonicGain2) this.harmonicGain2.gain.value = baseVol * 0.25;
    if (this.exhaustGain) this.exhaustGain.gain.value = baseVol * 0.35 * (0.5 + throttle * 0.5);

    // Noise increases with RPM
    if (this.noiseGain) this.noiseGain.gain.value = 0.01 + rpmNorm * 0.03;

    // Filter opens with RPM (brighter at high RPM)
    if (this.filter) {
      this.filter.frequency.value = 400 + rpmNorm * 3000;
    }
  }

  setVolume(volume: number): void {
    if (this.masterGain) this.masterGain.gain.value = volume;
  }

  stop(): void {
    if (!this.started) return;
    try {
      this.fundamentalOsc?.stop();
      this.harmonicOsc1?.stop();
      this.harmonicOsc2?.stop();
      this.exhaustOsc?.stop();
      this.noiseSource?.stop();
    } catch {}
    this.masterGain?.disconnect();
    this.started = false;
  }
}
