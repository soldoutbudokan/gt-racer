import { useRaceStore } from '../../stores/useRaceStore';

export function LapCounter() {
  const currentLap = useRaceStore((s) => s.playerLap);
  const totalLaps = useRaceStore((s) => s.totalLaps);

  return (
    <div className="flex items-baseline gap-1">
      <span className="text-sm text-gray-400">LAP</span>
      <span className="text-2xl font-bold text-white tabular-nums">
        {Math.min(currentLap, totalLaps)}
      </span>
      <span className="text-lg text-gray-400">/ {totalLaps}</span>
    </div>
  );
}
