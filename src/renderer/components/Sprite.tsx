import { useEffect, useRef } from 'react';
import { drawCharacter, drawFox, drawLandscape, drawProp } from '../art';
import type { Profile, WorkKind } from '../../shared/types';
import { cacheSpritePixels } from '../sprite-hit-test';

export function Sprite({
  profile,
  kind,
  landscape = false,
}: {
  profile: Profile;
  kind: WorkKind;
  landscape?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: !landscape });
    if (!ctx) return;
    const paint = (frame = 0) => {
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (landscape) drawLandscape(ctx, 520, 230, profile.cloak, profile.pet, kind);
      else {
        drawCharacter(ctx, 68, 6, 3, profile.cloak, kind, frame);
        drawProp(ctx, 175, 62, 2, kind, frame);
        if (profile.pet) drawFox(ctx, 15, 85, 2);
        cacheSpritePixels(canvas, ctx);
      }
    };
    paint();
    // The landscape is a static profile preview, so it needs no animation clock.
    if (landscape) return;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let timer: ReturnType<typeof setInterval> | undefined;
    const syncClock = () => {
      if (timer) {
        clearInterval(timer);
        timer = undefined;
      }
      if (document.hidden || profile.reducedMotion || reducedMotion.matches) return;
      timer = setInterval(() => paint(++frame), 700);
    };
    syncClock();
    document.addEventListener('visibilitychange', syncClock);
    reducedMotion.addEventListener('change', syncClock);
    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener('visibilitychange', syncClock);
      reducedMotion.removeEventListener('change', syncClock);
    };
  }, [profile.cloak, profile.pet, profile.reducedMotion, kind, landscape]);
  return (
    <canvas
      ref={ref}
      width={landscape ? 520 : 235}
      height={landscape ? 230 : 130}
      aria-label={`${profile.name}, ${kind}`}
      role="img"
      className={landscape ? 'landscape-canvas' : 'sprite-canvas'}
    />
  );
}
