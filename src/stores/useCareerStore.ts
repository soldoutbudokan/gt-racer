import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CareerState {
  money: number;
  totalStars: number;
  ownedCars: string[];
  selectedCarId: string;
  eventResults: Record<string, { stars: number; bestTime: number }>;
  currentTier: number;
  addMoney: (amount: number) => void;
  spendMoney: (amount: number) => boolean;
  buyCar: (carId: string, price: number) => boolean;
  setSelectedCar: (carId: string) => void;
  completeEvent: (eventId: string, stars: number, time: number) => void;
  resetCareer: () => void;
}

export const useCareerStore = create<CareerState>()(
  persist(
    (set, get) => ({
      money: 50000,
      totalStars: 0,
      ownedCars: ['sedan-sport'],
      selectedCarId: 'sedan-sport',
      eventResults: {},
      currentTier: 1,

      addMoney: (amount) => set((s) => ({ money: s.money + amount })),
      
      spendMoney: (amount) => {
        if (get().money >= amount) {
          set((s) => ({ money: s.money - amount }));
          return true;
        }
        return false;
      },

      buyCar: (carId, price) => {
        const state = get();
        if (state.money >= price && !state.ownedCars.includes(carId)) {
          set((s) => ({
            money: s.money - price,
            ownedCars: [...s.ownedCars, carId],
          }));
          return true;
        }
        return false;
      },

      setSelectedCar: (carId) => set({ selectedCarId: carId }),

      completeEvent: (eventId, stars, time) => set((s) => {
        const prev = s.eventResults[eventId];
        const bestStars = prev ? Math.max(prev.stars, stars) : stars;
        const bestTime = prev ? Math.min(prev.bestTime, time) : time;
        const starDiff = bestStars - (prev?.stars ?? 0);
        return {
          eventResults: { ...s.eventResults, [eventId]: { stars: bestStars, bestTime } },
          totalStars: s.totalStars + starDiff,
        };
      }),

      resetCareer: () => set({
        money: 50000,
        totalStars: 0,
        ownedCars: ['sedan-sport'],
        selectedCarId: 'sedan-sport',
        eventResults: {},
        currentTier: 1,
      }),
    }),
    { name: 'gt-racer-career' }
  )
);
