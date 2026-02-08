import { create } from 'zustand';

interface RacerInfo {
  id: string;
  name: string;
  position: number;
  currentLap: number;
  lastCheckpoint: number;
  lapTimes: number[];
  bestLapTime: number;
  totalTime: number;
  finished: boolean;
  distanceAlongTrack: number;
  isPlayer: boolean;
}

interface RaceState {
  started: boolean;
  finished: boolean;
  countdown: number;
  totalLaps: number;
  raceTime: number;
  racers: RacerInfo[];
  playerPosition: number;
  playerLap: number;
  playerBestLap: number;
  playerLastLap: number;
  startRace: (totalLaps: number, racerCount: number) => void;
  updateCountdown: (value: number) => void;
  updateRaceTime: (dt: number) => void;
  updateRacer: (id: string, updates: Partial<RacerInfo>) => void;
  updatePositions: () => void;
  finishRace: () => void;
  resetRace: () => void;
}

export const useRaceStore = create<RaceState>((set, get) => ({
  started: false,
  finished: false,
  countdown: 4,
  totalLaps: 3,
  raceTime: 0,
  racers: [],
  playerPosition: 1,
  playerLap: 1,
  playerBestLap: Infinity,
  playerLastLap: 0,
  
  startRace: (totalLaps, racerCount) => {
    const racers: RacerInfo[] = [];
    racers.push({
      id: 'player',
      name: 'Player',
      position: 1,
      currentLap: 1,
      lastCheckpoint: 0,
      lapTimes: [],
      bestLapTime: Infinity,
      totalTime: 0,
      finished: false,
      distanceAlongTrack: 0,
      isPlayer: true,
    });
    for (let i = 0; i < racerCount; i++) {
      racers.push({
        id: `ai_${i}`,
        name: `Driver ${i + 1}`,
        position: i + 2,
        currentLap: 1,
        lastCheckpoint: 0,
        lapTimes: [],
        bestLapTime: Infinity,
        totalTime: 0,
        finished: false,
        distanceAlongTrack: 0,
        isPlayer: false,
      });
    }
    set({ racers, totalLaps, started: false, finished: false, countdown: 4, raceTime: 0 });
  },

  updateCountdown: (value) => {
    set({ countdown: value });
    if (value <= 0) set({ started: true });
  },

  updateRaceTime: (dt) => set((state) => ({ raceTime: state.raceTime + dt })),

  updateRacer: (id, updates) => set((state) => ({
    racers: state.racers.map((r) => r.id === id ? { ...r, ...updates } : r),
  })),

  updatePositions: () => set((state) => {
    const sorted = [...state.racers].sort((a, b) => {
      if (a.finished && !b.finished) return -1;
      if (!a.finished && b.finished) return 1;
      if (a.finished && b.finished) return a.totalTime - b.totalTime;
      if (a.currentLap !== b.currentLap) return b.currentLap - a.currentLap;
      if (a.lastCheckpoint !== b.lastCheckpoint) return b.lastCheckpoint - a.lastCheckpoint;
      return b.distanceAlongTrack - a.distanceAlongTrack;
    });
    
    const racers = state.racers.map((r) => {
      const pos = sorted.findIndex((s) => s.id === r.id) + 1;
      return { ...r, position: pos };
    });
    
    const player = racers.find((r) => r.isPlayer);
    return {
      racers,
      playerPosition: player?.position ?? 1,
      playerLap: player?.currentLap ?? 1,
      playerBestLap: player?.bestLapTime ?? Infinity,
      playerLastLap: player?.lapTimes[player.lapTimes.length - 1] ?? 0,
    };
  }),

  finishRace: () => set({ finished: true }),
  resetRace: () => set({
    started: false, finished: false, countdown: 4, totalLaps: 3,
    raceTime: 0, racers: [], playerPosition: 1, playerLap: 1,
    playerBestLap: Infinity, playerLastLap: 0,
  }),
}));
