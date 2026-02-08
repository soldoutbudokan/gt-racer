import { useEffect, useState } from 'react';
import { useRaceStore } from '../../stores/useRaceStore';

export function Countdown() {
  const countdown = useRaceStore((s) => s.countdown);
  const started = useRaceStore((s) => s.started);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (started) {
      const timer = setTimeout(() => setVisible(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [started]);

  if (!visible) return null;

  const display = countdown <= 0 ? 'GO!' : Math.ceil(countdown).toString();
  const color = countdown <= 0 ? 'text-green-400' : 'text-white';

  return (
    <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-20">
      <span className={`text-8xl font-black ${color} drop-shadow-2xl animate-pulse`}>
        {display}
      </span>
    </div>
  );
}
