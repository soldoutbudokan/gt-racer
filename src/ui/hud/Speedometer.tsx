import { useVehicleStore } from '../../stores/useVehicleStore';

export function Speedometer() {
  const speedKmh = useVehicleStore((s) => Math.round(s.speedKmh));

  return (
    <div className="flex flex-col items-end">
      <span className="text-5xl font-bold tabular-nums text-white drop-shadow-lg">
        {speedKmh}
      </span>
      <span className="text-sm text-gray-300 -mt-1">km/h</span>
    </div>
  );
}
