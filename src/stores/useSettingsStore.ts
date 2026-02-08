import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  // Graphics
  shadowQuality: 'off' | 'low' | 'medium' | 'high';
  postProcessing: boolean;
  antiAliasing: boolean;

  // Assists
  steeringAssist: boolean;
  brakingAssist: boolean;
  tractionControl: boolean;
  abs: boolean;
  stabilityControl: boolean;
  racingLine: boolean;
  autoGear: boolean;
  
  // Setters
  setShadowQuality: (q: 'off' | 'low' | 'medium' | 'high') => void;
  setPostProcessing: (v: boolean) => void;
  setAntiAliasing: (v: boolean) => void;
  setSteeringAssist: (v: boolean) => void;
  setBrakingAssist: (v: boolean) => void;
  setTractionControl: (v: boolean) => void;
  setAbs: (v: boolean) => void;
  setStabilityControl: (v: boolean) => void;
  setRacingLine: (v: boolean) => void;
  setAutoGear: (v: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      shadowQuality: 'medium',
      postProcessing: true,
      antiAliasing: true,
      steeringAssist: true,
      brakingAssist: true,
      tractionControl: true,
      abs: true,
      stabilityControl: true,
      racingLine: true,
      autoGear: true,
      setShadowQuality: (q) => set({ shadowQuality: q }),
      setPostProcessing: (v) => set({ postProcessing: v }),
      setAntiAliasing: (v) => set({ antiAliasing: v }),
      setSteeringAssist: (v) => set({ steeringAssist: v }),
      setBrakingAssist: (v) => set({ brakingAssist: v }),
      setTractionControl: (v) => set({ tractionControl: v }),
      setAbs: (v) => set({ abs: v }),
      setStabilityControl: (v) => set({ stabilityControl: v }),
      setRacingLine: (v) => set({ racingLine: v }),
      setAutoGear: (v) => set({ autoGear: v }),
    }),
    { name: 'gt-racer-settings' }
  )
);
