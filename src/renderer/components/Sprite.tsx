import { useEffect, useRef, useState } from 'react';
import { drawCharacter, drawFox, drawLandscape, drawProp } from '../art';
import type { Profile, WorkKind } from '../../shared/types';

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
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (profile.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = setInterval(() => {
      if (!document.hidden) setFrame((current) => current + 1);
    }, 700);
    return () => clearInterval(timer);
  }, [profile.reducedMotion]);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 520, 230);
    if (landscape) drawLandscape(ctx, 520, 230, profile.cloak, profile.pet, kind);
    else {
      drawCharacter(ctx, 68, 6, 3, profile.cloak, kind, frame);
      drawProp(ctx, 175, 62, 2, kind, frame);
      if (profile.pet) drawFox(ctx, 15, 85, 2);
    }
  }, [profile.cloak, profile.pet, kind, landscape, frame]);
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
