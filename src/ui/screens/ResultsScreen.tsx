import { useGameStore } from '../../stores/useGameStore';
import { useRaceStore } from '../../stores/useRaceStore';
import { MenuButton } from '../components/MenuButton';

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return '--:--.---';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(3).padStart(6, '0')}`;
}

export function ResultsScreen() {
  const scene = useGameStore((s) => s.scene);
  const setScene = useGameStore((s) => s.setScene);
  const playerPosition = useRaceStore((s) => s.playerPosition);
  const raceTime = useRaceStore((s) => s.raceTime);
  const bestLap = useRaceStore((s) => s.playerBestLap);
  const racers = useRaceStore((s) => s.racers);
  const resetRace = useRaceStore((s) => s.resetRace);

  if (scene !== 'results') return null;

  const sorted = [...racers].sort((a, b) => a.position - b.position);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-20 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-6 p-8 rounded-2xl bg-black/50 border border-white/10 min-w-[400px]">
        <h2 className="text-4xl font-black text-white">RACE RESULTS</h2>
        
        <div className="text-center">
          <span className="text-6xl font-black text-red-500">P{playerPosition}</span>
        </div>

        <div className="flex gap-8 text-center">
          <div>
            <div className="text-sm text-gray-400">TOTAL TIME</div>
            <div className="text-xl font-mono text-white">{formatTime(raceTime)}</div>
          </div>
          <div>
            <div className="text-sm text-gray-400">BEST LAP</div>
            <div className="text-xl font-mono text-green-400">{formatTime(bestLap)}</div>
          </div>
        </div>

        <div className="w-full border-t border-white/10 pt-4">
          {sorted.map((r, i) => (
            <div key={r.id} className={`flex justify-between py-1 px-4 ${r.isPlayer ? 'text-yellow-400' : 'text-gray-300'}`}>
              <span className="font-bold">{i + 1}.</span>
              <span className="flex-1 ml-2">{r.name}</span>
              <span className="font-mono">{formatTime(r.totalTime)}</span>
            </div>
          ))}
        </div>

        <div className="flex gap-4 mt-4">
          <MenuButton label="Race Again" onClick={() => {
            resetRace();
            setScene('racing');
          }} />
          <MenuButton label="Menu" variant="secondary" onClick={() => {
            resetRace();
            setScene('menu');
          }} />
        </div>
      </div>
    </div>
  );
}
