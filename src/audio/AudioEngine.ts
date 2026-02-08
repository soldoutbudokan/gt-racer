export class AudioEngine {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private unlocked = false;

  async init(): Promise<void> {
    if (this.context) return;

    this.context = new AudioContext();
    this.masterGain = this.context.createGain();
    this.masterGain.connect(this.context.destination);
    this.masterGain.gain.value = 0.8;

    if (this.context.state === 'suspended') {
      const unlock = async () => {
        if (this.context && this.context.state === 'suspended') {
          await this.context.resume();
        }
        this.unlocked = true;
        document.removeEventListener('click', unlock);
        document.removeEventListener('keydown', unlock);
      };
      document.addEventListener('click', unlock);
      document.addEventListener('keydown', unlock);
    } else {
      this.unlocked = true;
    }
  }

  getContext(): AudioContext | null {
    return this.context;
  }

  getMasterGain(): GainNode | null {
    return this.masterGain;
  }

  isUnlocked(): boolean {
    return this.unlocked;
  }

  setMasterVolume(volume: number): void {
    if (this.masterGain) {
      this.masterGain.gain.value = volume;
    }
  }

  dispose(): void {
    if (this.context) {
      this.context.close();
      this.context = null;
      this.masterGain = null;
    }
  }
}

export const audioEngine = new AudioEngine();
