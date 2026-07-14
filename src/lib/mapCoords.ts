import type { MapConfig } from '../types';

const IMAGE_SIZE = 1024;

/**
 * World (x, z) -> minimap pixel (px, py), per README:
 *   u = (x - originX) / scale
 *   v = (z - originZ) / scale
 *   px = u * 1024
 *   py = (1 - v) * 1024   (Y flipped: image origin is top-left)
 */
export function worldToPixel(x: number, z: number, cfg: MapConfig): { px: number; py: number } {
  const u = (x - cfg.originX) / cfg.scale;
  const v = (z - cfg.originZ) / cfg.scale;
  return { px: u * IMAGE_SIZE, py: (1 - v) * IMAGE_SIZE };
}

export function pixelToWorld(px: number, py: number, cfg: MapConfig): { x: number; z: number } {
  const u = px / IMAGE_SIZE;
  const v = 1 - py / IMAGE_SIZE;
  return { x: u * cfg.scale + cfg.originX, z: v * cfg.scale + cfg.originZ };
}

export const MINIMAP_PX = IMAGE_SIZE;
