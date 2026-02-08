import { useMemo } from 'react';
import { useVehicleStore } from '../../stores/useVehicleStore';

export function Tachometer() {
  const rpm = useVehicleStore((s) => s.rpm);
  const gear = useVehicleStore((s) => s.gear);

  const rpmPercent = useMemo(() => Math.min(rpm / 8000, 1), [rpm]);
  const isRedline = rpmPercent > 0.88;

  const startAngle = -225;
  const endAngle = 45;
  const sweep = endAngle - startAngle;
  const currentAngle = startAngle + sweep * rpmPercent;

  const r = 45;
  const cx = 50;
  const cy = 50;

  function polarToCart(angle: number, radius: number) {
    const rad = (angle * Math.PI) / 180;
    return {
      x: cx + radius * Math.cos(rad),
      y: cy + radius * Math.sin(rad),
    };
  }

  const arcStart = polarToCart(startAngle, r);
  const arcEnd = polarToCart(currentAngle, r);
  const largeArc = currentAngle - startAngle > 180 ? 1 : 0;

  const pathD = `M ${arcStart.x} ${arcStart.y} A ${r} ${r} 0 ${largeArc} 1 ${arcEnd.x} ${arcEnd.y}`;

  return (
    <div className="relative w-32 h-32">
      <svg viewBox="0 0 100 100" className="w-full h-full">
        {/* Background arc */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6"
          strokeDasharray={`${(270 / 360) * 2 * Math.PI * r} ${2 * Math.PI * r}`}
          strokeDashoffset="0"
          transform={`rotate(-225 ${cx} ${cy})`}
          strokeLinecap="round"
        />
        {/* Active arc */}
        <path d={pathD} fill="none" stroke={isRedline ? '#ff3333' : '#e94560'} strokeWidth="6" strokeLinecap="round" />
      </svg>
      {/* RPM text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-white tabular-nums">
          {Math.round(rpm / 100) * 100}
        </span>
        <span className="text-[10px] text-gray-400 -mt-1">RPM</span>
        <span className="text-2xl font-black text-white mt-1">
          {gear === -1 ? 'R' : gear === 0 ? 'N' : gear}
        </span>
      </div>
    </div>
  );
}
