import { clamp, remap } from '../utils/math';

export function computeRubberBandModifier(
  aiPosition: number,
  playerPosition: number,
  totalRacers: number,
  distanceBehindPlayer: number
): number {
  if (aiPosition < playerPosition) {
    const posDiff = playerPosition - aiPosition;
    return remap(posDiff, 1, totalRacers, 0.97, 0.92);
  } else if (aiPosition > playerPosition) {
    const posDiff = aiPosition - playerPosition;
    const catchUpFactor = remap(posDiff, 1, totalRacers, 1.03, 1.08);
    const distFactor = clamp(distanceBehindPlayer / 100, 0, 1);
    return 1 + (catchUpFactor - 1) * distFactor;
  }
  return 1;
}
