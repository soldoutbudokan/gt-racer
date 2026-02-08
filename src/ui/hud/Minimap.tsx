import { useMemo } from 'react';
import { useRaceStore } from '../../stores/useRaceStore';

interface MinimapProps {
  splinePoints: number[][];
}

export function Minimap({ splinePoints }: MinimapProps) {
  const racers = useRaceStore((s) => s.racers);

  const { pathD, bounds, scale } = useMemo(() => {
    if (splinePoints.length === 0) return { pathD: '', bounds: { minX: 0, maxX: 1, minZ: 0, maxZ: 1 }, scale: 1 };

    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const p of splinePoints) {
      minX = Math.min(minX, p[0]);
      maxX = Math.max(maxX, p[0]);
      minZ = Math.min(minZ, p[2]);
      maxZ = Math.max(maxZ, p[2]);
    }

    const padding = 20;
    minX -= padding; maxX += padding;
    minZ -= padding; maxZ += padding;

    const rangeX = maxX - minX;
    const rangeZ = maxZ - minZ;
    const s = 100 / Math.max(rangeX, rangeZ);

    let d = `M ${(splinePoints[0][0] - minX) * s} ${(splinePoints[0][2] - minZ) * s}`;
    for (let i = 1; i < splinePoints.length; i++) {
      d += ` L ${(splinePoints[i][0] - minX) * s} ${(splinePoints[i][2] - minZ) * s}`;
    }
    d += ' Z';

    return { pathD: d, bounds: { minX, maxX, minZ, maxZ }, scale: s };
  }, [splinePoints]);

  return (
    <div className="w-28 h-28 bg-black/40 rounded-lg p-1 backdrop-blur-sm">
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <path d={pathD} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
        <path d={pathD} fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" />
        {/* Car position dots */}
        {splinePoints.length > 0 && racers.length > 0 && racers.map((racer) => {
          const totalPoints = splinePoints.length;
          if (totalPoints === 0) return null;
          const t = racer.distanceAlongTrack ?? 0;
          if (!Number.isFinite(t)) return null;
          const scaledT = Math.abs(t) * totalPoints;
          const idx = Math.min(Math.max(Math.floor(scaledT) % totalPoints, 0), totalPoints - 1);
          const nextIdx = (idx + 1) % totalPoints;
          const localT = scaledT - Math.floor(scaledT);

          const x = ((splinePoints[idx][0] * (1 - localT) + splinePoints[nextIdx][0] * localT) - bounds.minX) * scale;
          const z = ((splinePoints[idx][2] * (1 - localT) + splinePoints[nextIdx][2] * localT) - bounds.minZ) * scale;

          return (
            <circle
              key={racer.id}
              cx={x}
              cy={z}
              r={racer.isPlayer ? 3 : 2}
              fill={racer.isPlayer ? '#FFD700' : '#FF4444'}
            />
          );
        })}
      </svg>
    </div>
  );
}
