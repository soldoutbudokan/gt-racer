import { Speedometer } from './Speedometer';
import { Tachometer } from './Tachometer';
import { PositionIndicator } from './PositionIndicator';
import { LapCounter } from './LapCounter';
import { LapTimes } from './LapTimes';
import { Minimap } from './Minimap';
import { useGameStore } from '../../stores/useGameStore';

interface RaceHUDProps {
  splinePoints: number[][];
}

export function RaceHUD({ splinePoints }: RaceHUDProps) {
  const scene = useGameStore((s) => s.scene);
  if (scene !== 'racing') return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-10">
      {/* Top bar: Position + Lap */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-8">
        <PositionIndicator />
        <LapCounter />
      </div>

      {/* Top right: Lap times */}
      <div className="absolute top-4 right-4">
        <LapTimes />
      </div>

      {/* Bottom right: Speed + Tach */}
      <div className="absolute bottom-4 right-4 flex items-end gap-4">
        <Tachometer />
        <Speedometer />
      </div>

      {/* Bottom left: Minimap */}
      <div className="absolute bottom-4 left-4">
        <Minimap splinePoints={splinePoints} />
      </div>
    </div>
  );
}
