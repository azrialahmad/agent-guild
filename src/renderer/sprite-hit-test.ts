const pixels = new WeakMap<HTMLCanvasElement, Uint8ClampedArray>();

export function cacheSpritePixels(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
): void {
  pixels.set(canvas, context.getImageData(0, 0, canvas.width, canvas.height).data);
}

export function spritePixelIsVisible(canvas: HTMLCanvasElement, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return false;
  return (pixels.get(canvas)?.[(y * canvas.width + x) * 4 + 3] ?? 0) > 24;
}
