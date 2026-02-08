import { useGameStore } from '../../stores/useGameStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { MenuButton } from '../components/MenuButton';

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex justify-between items-center py-2">
      <span className="text-gray-300">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`w-12 h-6 rounded-full transition-colors ${value ? 'bg-red-500' : 'bg-gray-600'}`}
      >
        <div className={`w-5 h-5 rounded-full bg-white transition-transform ${value ? 'translate-x-6' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}

export function SettingsScreen() {
  const scene = useGameStore((s) => s.scene);
  const setScene = useGameStore((s) => s.setScene);
  const settings = useSettingsStore();

  if (scene !== 'settings') return null;

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-20">
      <div className="flex flex-col gap-4 p-8 rounded-2xl bg-black/50 border border-white/10 w-[500px] max-h-[80vh] overflow-y-auto">
        <h2 className="text-3xl font-bold text-white mb-2">SETTINGS</h2>

        <h3 className="text-lg font-bold text-red-400 mt-2">Graphics</h3>
        <Toggle label="Post Processing" value={settings.postProcessing} onChange={settings.setPostProcessing} />
        <Toggle label="Anti-Aliasing" value={settings.antiAliasing} onChange={settings.setAntiAliasing} />

        <h3 className="text-lg font-bold text-red-400 mt-2">Driving Assists</h3>
        <Toggle label="Steering Assist" value={settings.steeringAssist} onChange={settings.setSteeringAssist} />
        <Toggle label="Braking Assist" value={settings.brakingAssist} onChange={settings.setBrakingAssist} />
        <Toggle label="Traction Control" value={settings.tractionControl} onChange={settings.setTractionControl} />
        <Toggle label="ABS" value={settings.abs} onChange={settings.setAbs} />
        <Toggle label="Stability Control" value={settings.stabilityControl} onChange={settings.setStabilityControl} />
        <Toggle label="Racing Line" value={settings.racingLine} onChange={settings.setRacingLine} />
        <Toggle label="Auto Gear" value={settings.autoGear} onChange={settings.setAutoGear} />

        <div className="mt-4">
          <MenuButton label="Back" variant="secondary" onClick={() => setScene('menu')} />
        </div>
      </div>
    </div>
  );
}
