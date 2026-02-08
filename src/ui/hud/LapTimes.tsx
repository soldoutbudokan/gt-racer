import { useRaceStore } from '../../stores/useRaceStore';

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return '--:--.---';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(3).padStart(6, '0')}`;
}

export function LapTimes() {
  const raceTime = useRaceStore((s) => s.raceTime);
  const bestLap = useRaceStore((s) => s.playerBestLap);
  const lastLap = useRaceStore((s) => s.playerLastLap);

  return (
    <div className="flex flex-col text-sm font-mono">
      <div className="flex justify-between gap-4">
        <span className="text-gray-400">TIME</span>
        <span className="text-white tabular-nums">{formatTime(raceTime)}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-gray-400">BEST</span>
        <span className="text-green-400 tabular-nums">{formatTime(bestLap)}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-gray-400">LAST</span>
        <span className="text-yellow-400 tabular-nums">{formatTime(lastLap)}</span>
      </div>
    </div>
  );
}
