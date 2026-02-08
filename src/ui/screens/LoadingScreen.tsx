import { useGameStore } from '../../stores/useGameStore';

export function LoadingScreen() {
  const loading = useGameStore((s) => s.loading);
  const progress = useGameStore((s) => s.loadingProgress);

  if (!loading) return null;

  return (
    <div className="fixed inset-0 bg-[#0a0a1a] flex flex-col items-center justify-center z-50">
      <h1 className="text-5xl font-black text-white mb-2">
        GT <span className="text-red-500">RACER</span>
      </h1>
      <p className="text-gray-500 mb-8 tracking-widest uppercase text-sm">Loading...</p>
      <div className="w-64 h-1 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-red-500 rounded-full transition-all duration-300"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <p className="text-gray-600 mt-2 text-sm">{Math.round(progress * 100)}%</p>
    </div>
  );
}
