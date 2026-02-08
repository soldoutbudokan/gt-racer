import { useRaceStore } from '../../stores/useRaceStore';

function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function PositionIndicator() {
  const position = useRaceStore((s) => s.playerPosition);
  const totalRacers = useRaceStore((s) => s.racers.length);

  return (
    <div className="flex items-baseline gap-1">
      <span className="text-4xl font-black text-white drop-shadow-lg">
        {getOrdinal(position)}
      </span>
      <span className="text-lg text-gray-300">/ {totalRacers}</span>
    </div>
  );
}
