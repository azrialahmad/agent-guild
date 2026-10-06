import { CLOAKS } from '../shared/game';
import type { Cloak, WorkKind } from '../shared/types';

type Painter = (x: number, y: number, w: number, h: number, color: string) => void;

function painter(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number): Painter {
  return (px, py, w, h, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x + px * scale), Math.round(y + py * scale), w * scale, h * scale);
  };
}

/** Original 32px character, drawn on an integer pixel grid. No third-party sprite assets. */
export function drawCharacter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  cloak: Cloak,
  kind: WorkKind = 'idle',
  frame = 0,
): void {
  const p = painter(ctx, x, y, scale);
  const color = CLOAKS.find((item) => item.id === cloak)!.color;
  p(6, 37, 22, 2, '#312d4326');
  p(10, 29, 12, 7, '#454059');
  p(10, 35, 5, 3, '#3e3145');
  p(19, 35, 6, 3, '#3e3145');
  p(8, 21, 16, 10, color);
  p(6, 25, 4, 6, color);
  p(24, 25, 3, 6, color);
  p(9, 30, 14, 2, '#6d5d90');
  p(14, 22, 4, 8, '#f2dec0');
  p(12, 24, 8, 2, '#edbd67');
  p(7, 14, 18, 10, '#775644');
  p(9, 14, 14, 9, '#f1c5a3');
  p(9, 13, 14, 4, '#71533e');
  p(8, 16, 3, 4, '#71533e');
  p(21, 16, 3, 4, '#71533e');
  p(12, 18, 2, 2, '#443344');
  p(19, 18, 2, 2, '#443344');
  p(11, 21, 3, 1, '#e59893');
  p(19, 21, 3, 1, '#e59893');
  p(15, 22, 3, 1, '#bd7764');
  // A soft, oversized wandering hat.
  p(11, 4, 7, 3, color);
  p(9, 7, 13, 4, color);
  p(7, 11, 18, 3, color);
  p(4, 14, 24, 3, '#756293');
  p(18, 4, 4, 3, color);
  p(21, 6, 4, 3, color);
  p(9, 11, 13, 2, '#e8c983');
  p(20, 10, 2, 3, '#fbdf8a');
  p(6, 29 + (frame % 2), 4, 3, '#f1c5a3');
  p(24, 29, 3, 3, '#f1c5a3');
  if (kind === 'reading') {
    p(7, 27, 19, 7, '#8f7c6a');
    p(8, 27, 8, 5, '#f9ead0');
    p(17, 27, 8, 5, '#e6d3b0');
    p(16, 27, 1, 7, '#8f7c6a');
  }
  if (kind === 'attention') {
    p(28, 5, 2, 6, '#d28e43');
    p(28, 13, 2, 2, '#d28e43');
  }
}

export function drawFox(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number): void {
  const p = painter(ctx, x, y, scale);
  p(3, 14, 19, 1, '#312d4320');
  p(14, 8, 8, 5, '#cf8153');
  p(19, 6, 4, 4, '#e8cda2');
  p(6, 7, 10, 7, '#d99661');
  p(3, 3, 4, 6, '#c78050');
  p(10, 3, 4, 6, '#c78050');
  p(4, 4, 2, 3, '#f0c5a2');
  p(11, 4, 2, 3, '#f0c5a2');
  p(3, 7, 12, 5, '#e4aa72');
  p(5, 9, 2, 1, '#493948');
  p(11, 9, 2, 1, '#493948');
  p(7, 11, 4, 2, '#f5e6c8');
  p(8, 11, 2, 1, '#493948');
}

export function drawProp(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  kind: WorkKind,
  frame = 0,
): void {
  const p = painter(ctx, x, y, scale);
  if (kind === 'command') {
    p(0, 5, 20, 14, '#5d6462');
    p(2, 7, 16, 9, '#b3cfb7');
    p(4, 10, 2, 1, '#536f60');
    p(6, 11, 2, 1, '#536f60');
    p(8, 13, 4, 1, '#536f60');
    p(8, 19, 4, 4, '#737970');
    p(4, 23, 12, 2, '#737970');
  } else if (kind === 'editing') {
    p(0, 15, 22, 4, '#b48762');
    p(2, 19, 3, 8, '#88664e');
    p(17, 19, 3, 8, '#88664e');
    p(8, 10, 8, 5, '#d4c0ab');
    p(6, 9, 12, 2, '#9d9da6');
    p(4 + (frame % 2), 2, 3, 9, '#b48762');
    p(1 + (frame % 2), 1, 9, 3, '#777584');
  } else if (kind === 'reading') {
    p(1, 16, 20, 4, '#a67f60');
    p(3, 10, 14, 6, '#8c9e80');
    p(4, 11, 12, 3, '#eddfc1');
    p(5, 5, 14, 5, '#ad92bc');
    p(6, 6, 12, 2, '#f2e5ca');
  } else {
    p(8, 7, 2, 13, '#b58c59');
    p(5, 10, 8, 8, '#f4cd6f');
    p(4, 9, 10, 2, '#8d755d');
    p(4, 18, 10, 2, '#8d755d');
    p(8, 12, 2, 4, '#fff1b0');
  }
}

export function drawLandscape(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  cloak: Cloak,
  pet: boolean,
  kind: WorkKind,
): void {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#eeeaf5';
  ctx.fillRect(0, 0, width, height);
  const p = painter(ctx, 0, 0, 2);
  p(0, height / 2 - 45, width / 2, 45, '#e1e7db');
  for (let i = 0; i < width / 2; i += 12) {
    const rise = Math.round(8 + Math.sin(i / 40) * 8);
    p(i, height / 2 - 45 - rise, 12, rise, '#e1e7db');
  }
  p(0, height / 2 - 24, width / 2, 24, '#d5dfc9');
  p(0, height / 2 - 4, width / 2, 4, '#c2d1b3');
  p(22, 19, 24, 4, '#faf8fc');
  p(29, 16, 14, 3, '#faf8fc');
  p(width / 2 - 66, 32, 26, 4, '#faf8fc');
  p(width / 2 - 30, 12, 7, 7, '#efd79a');
  p(width / 2 - 32, 14, 11, 3, '#efd79a');
  // Ferns and wildflowers on either side leave a readable character silhouette.
  for (const x of [18, 31, width / 2 - 25, width / 2 - 40]) {
    p(x, height / 2 - 17, 2, 13, '#8da584');
    p(x - 4, height / 2 - 15, 4, 2, '#9eb28e');
    p(x + 2, height / 2 - 11, 5, 2, '#9eb28e');
    p(x - 1, height / 2 - 20, 4, 4, '#e5bf91');
    p(x, height / 2 - 19, 2, 2, '#faf0cd');
  }
  drawCharacter(ctx, width / 2 - 54, height - 170, 4, cloak, kind);
  drawProp(ctx, width / 2 + 42, height - 110, 3, kind);
  if (pet) drawFox(ctx, width / 2 - 125, height - 61, 3);
}
