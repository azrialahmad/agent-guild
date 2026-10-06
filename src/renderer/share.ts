import { level, localDay } from '../shared/game';
import type { Profile, Usage } from '../shared/types';
import { drawCharacter, drawFox } from './art';

export function createShareCard(
  profile: Profile,
  usage: Usage | undefined,
  includeActivity: boolean,
): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1000;
  canvas.height = 600;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#f7f5ee';
  ctx.fillRect(0, 0, 1000, 600);
  ctx.fillStyle = '#e8e1f0';
  ctx.fillRect(24, 24, 952, 552);
  ctx.fillStyle = '#f7f5ee';
  ctx.fillRect(40, 40, 920, 520);
  ctx.fillStyle = '#766589';
  ctx.font = '600 20px "DM Sans"';
  ctx.fillText('AGENT GUILD / MY LITTLE ADVENTURE', 74, 92);
  ctx.fillStyle = '#343a35';
  ctx.font = '500 52px "DM Sans"';
  let name = profile.name;
  while (ctx.measureText(name).width > 570) name = name.slice(0, -1);
  ctx.fillText(name, 74, 164);
  ctx.fillStyle = '#6f756a';
  ctx.font = '24px "DM Sans"';
  ctx.fillText(
    `Level ${level(profile.xp)} · ${profile.completed.length} adventures · ${profile.xp} XP`,
    76,
    210,
  );
  ctx.fillStyle = '#e6ebdc';
  ctx.fillRect(660, 130, 245, 270);
  ctx.imageSmoothingEnabled = false;
  drawCharacter(ctx, 680, 150, 6, profile.cloak);
  if (profile.pet) drawFox(ctx, 795, 328, 3);
  if (includeActivity) {
    ctx.fillStyle = '#6f756a';
    ctx.font = '18px "DM Sans"';
    ctx.fillText('ADVENTURE ACTIVITY / LAST 28 LOCAL DAYS', 76, 285);
    for (let i = 0; i < 28; i++) {
      const date = new Date();
      date.setDate(date.getDate() - 27 + i);
      ctx.fillStyle = profile.activityDays[localDay(date)] ? '#8aa181' : '#e5e8de';
      ctx.fillRect(76 + (i % 14) * 32, 310 + Math.floor(i / 14) * 32, 25, 25);
    }
  }
  if (usage) {
    ctx.fillStyle = '#6f756a';
    ctx.font = '18px "DM Sans"';
    ctx.fillText(
      `SELECTED OPENCODE SESSION · INPUT ${usage.input.toLocaleString()} / OUTPUT ${usage.output.toLocaleString()}`,
      76,
      420,
    );
  }
  ctx.fillStyle = '#343a35';
  ctx.font = '24px "Pixelify Sans"';
  ctx.fillText('A little company while you create.', 76, 495);
  ctx.fillStyle = '#8a8e81';
  ctx.font = '17px "DM Sans"';
  ctx.fillText('github.com/azrialahmad/agent-guild', 76, 528);
  return canvas.toDataURL('image/png');
}
