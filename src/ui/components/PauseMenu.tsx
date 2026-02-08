import { useGameStore } from '../../stores/useGameStore';
import { MenuButton } from './MenuButton';

export function PauseMenu() {
  const paused = useGameStore((s) => s.paused);
  const setPaused = useGameStore((s) => s.setPaused);
  const setScene = useGameStore((s) => s.setScene);

  if (!paused) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-30 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-black/50 border border-white/10">
        <h2 className="text-3xl font-bold text-white mb-4">PAUSED</h2>
        <MenuButton label="Resume" onClick={() => setPaused(false)} />
        <MenuButton
          label="Quit to Menu"
          variant="secondary"
          onClick={() => {
            setPaused(false);
            setScene('menu');
          }}
        />
      </div>
    </div>
  );
}
