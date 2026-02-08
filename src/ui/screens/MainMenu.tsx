import { useGameStore } from '../../stores/useGameStore';
import { MenuButton } from '../components/MenuButton';

export function MainMenu() {
  const scene = useGameStore((s) => s.scene);
  const setScene = useGameStore((s) => s.setScene);

  if (scene !== 'menu') return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-20">
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/80" />
      
      <div className="relative flex flex-col items-center gap-6">
        {/* Title */}
        <div className="mb-8 text-center">
          <h1 className="text-7xl font-black text-white tracking-tight drop-shadow-2xl">
            GT <span className="text-red-500">RACER</span>
          </h1>
          <p className="text-gray-400 text-lg mt-2 tracking-widest uppercase">
            The Racing Experience
          </p>
        </div>

        {/* Menu buttons */}
        <MenuButton label="Quick Race" onClick={() => setScene('racing')} />
        <MenuButton label="Career" variant="secondary" onClick={() => setScene('career')} />
        <MenuButton label="Garage" variant="secondary" onClick={() => setScene('garage')} />
        <MenuButton label="Settings" variant="secondary" onClick={() => setScene('settings')} />
      </div>
    </div>
  );
}
