import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { useSettingsStore } from '../../stores/useSettingsStore';

export function PostProcessingEffects() {
  const enabled = useSettingsStore((s) => s.postProcessing);
  if (!enabled) return null;

  return (
    <EffectComposer>
      <Bloom
        intensity={0.3}
        luminanceThreshold={0.8}
        luminanceSmoothing={0.9}
        mipmapBlur
      />
      <Vignette eskil={false} offset={0.1} darkness={0.4} />
    </EffectComposer>
  );
}
