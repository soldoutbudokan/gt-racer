import { EffectComposer, Bloom, Vignette, ToneMapping, ChromaticAberration } from '@react-three/postprocessing';
import { ToneMappingMode, BlendFunction } from 'postprocessing';
import { useSettingsStore } from '../../stores/useSettingsStore';
import * as THREE from 'three';

const chromaticOffset = new THREE.Vector2(0.0005, 0.0005);

export function PostProcessingEffects() {
  const enabled = useSettingsStore((s) => s.postProcessing);
  if (!enabled) return null;

  return (
    <EffectComposer>
      <Bloom
        intensity={0.4}
        luminanceThreshold={0.7}
        luminanceSmoothing={0.8}
        mipmapBlur
      />
      <ChromaticAberration
        offset={chromaticOffset}
        radialModulation
        modulationOffset={0.3}
        blendFunction={BlendFunction.NORMAL}
      />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette eskil={false} offset={0.1} darkness={0.5} />
    </EffectComposer>
  );
}
