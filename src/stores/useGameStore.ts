import { create } from 'zustand';

export type GameScene = 'menu' | 'garage' | 'track-select' | 'loading' | 'racing' | 'results' | 'settings' | 'career';

interface GameState {
  scene: GameScene;
  paused: boolean;
  loading: boolean;
  loadingProgress: number;
  selectedCarId: string;
  selectedTrackId: string;
  setScene: (scene: GameScene) => void;
  setPaused: (paused: boolean) => void;
  togglePause: () => void;
  setLoading: (loading: boolean) => void;
  setLoadingProgress: (progress: number) => void;
  setSelectedCar: (carId: string) => void;
  setSelectedTrack: (trackId: string) => void;
}

export const useGameStore = create<GameState>((set) => ({
  scene: 'menu',
  paused: false,
  loading: false,
  loadingProgress: 0,
  selectedCarId: 'sedan-sport',
  selectedTrackId: 'azure-coast',
  setScene: (scene) => set({ scene }),
  setPaused: (paused) => set({ paused }),
  togglePause: () => set((state) => ({ paused: !state.paused })),
  setLoading: (loading) => set({ loading }),
  setLoadingProgress: (progress) => set({ loadingProgress: progress }),
  setSelectedCar: (carId) => set({ selectedCarId: carId }),
  setSelectedTrack: (trackId) => set({ selectedTrackId: trackId }),
}));
