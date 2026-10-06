export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function clampPlacement(
  position: { x: number; y: number } | undefined,
  areas: Bounds[],
  width: number,
  height: number,
): Bounds {
  const primary = areas[0];
  const fallback = {
    x: primary.x + primary.width - width - 28,
    y: primary.y + primary.height - height - 12,
  };
  const point = position ?? fallback;
  const area =
    areas.find(
      (candidate) =>
        point.x + width / 2 >= candidate.x &&
        point.x + width / 2 < candidate.x + candidate.width &&
        point.y + height / 2 >= candidate.y &&
        point.y + height / 2 < candidate.y + candidate.height,
    ) ?? primary;
  return {
    x: Math.round(Math.max(area.x, Math.min(point.x, area.x + area.width - width))),
    y: Math.round(Math.max(area.y, Math.min(point.y, area.y + area.height - height))),
    width,
    height,
  };
}
