import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { RaceScene } from './rendering/scenes/RaceScene';
import { MenuScene } from './rendering/scenes/MenuScene';
import { MainMenu } from './ui/screens/MainMenu';
import { ResultsScreen } from './ui/screens/ResultsScreen';
import { LoadingScreen } from './ui/screens/LoadingScreen';
import { SettingsScreen } from './ui/screens/SettingsScreen';
import { RaceHUD } from './ui/hud/RaceHUD';
import { Countdown } from './ui/components/Countdown';
import { PauseMenu } from './ui/components/PauseMenu';
import { useGameStore } from './stores/useGameStore';
import trackData from './data/tracks/azure-coast.json';

function SceneRouter() {
  const scene = useGameStore((s) => s.scene);

  return (
    <>
      {(scene === 'menu' || scene === 'settings') && <MenuScene />}
      {scene === 'racing' && <RaceScene />}
    </>
  );
}

export default function App() {
  const scene = useGameStore((s) => s.scene);

  return (
    <div className="w-screen h-screen bg-black overflow-hidden">
      {/* 3D Canvas */}
      <Canvas
        shadows
        camera={{ fov: 60, near: 0.1, far: 1000, position: [0, 5, -10] }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        dpr={[1, 2]}
      >
        <Suspense fallback={null}>
          <SceneRouter />
        </Suspense>
      </Canvas>

      {/* HTML UI Overlay */}
      <MainMenu />
      <SettingsScreen />
      <ResultsScreen />
      <LoadingScreen />
      {scene === 'racing' && (
        <>
          <RaceHUD splinePoints={trackData.spline.points} />
          <Countdown />
          <PauseMenu />
        </>
      )}
    </div>
  );
}
