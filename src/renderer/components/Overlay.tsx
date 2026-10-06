import { useEffect, useRef, useState } from 'react';
import { GripHorizontal, Heart, Sparkles } from 'lucide-react';
import type { GuildState } from '../../shared/types';
import { bridge } from '../bridge';
import { Sprite } from './Sprite';

export function Overlay({ state }: { state: GuildState }) {
  const [heart, setHeart] = useState(false);
  const interactive = useRef(false);
  const drag = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    document.body.classList.add('overlay-body');
    const move = (event: MouseEvent) => {
      if (drag.current) {
        bridge.moveOverlay(event.screenX - drag.current.x, event.screenY - drag.current.y);
        drag.current = { x: event.screenX, y: event.screenY };
        return;
      }
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-hit]');
      let hit = Boolean(target);
      // Transparent sprite pixels must pass through too, not just the window's outer margin.
      if (target?.classList.contains('overlay-character')) {
        const canvas = target.querySelector('canvas')!;
        const rect = canvas.getBoundingClientRect();
        const x = Math.floor(((event.clientX - rect.left) * canvas.width) / rect.width);
        const y = Math.floor(((event.clientY - rect.top) * canvas.height) / rect.height);
        hit =
          x >= 0 &&
          y >= 0 &&
          x < canvas.width &&
          y < canvas.height &&
          canvas.getContext('2d')!.getImageData(x, y, 1, 1).data[3] > 24;
      }
      if (
        target?.classList.contains('overlay-tools') &&
        Number(getComputedStyle(target).opacity) === 0
      )
        hit = false;
      if (hit !== interactive.current) {
        interactive.current = hit;
        bridge.setInteractive(hit);
      }
    };
    const release = () => {
      drag.current = null;
    };
    const leave = () => {
      if (!drag.current) {
        interactive.current = false;
        bridge.setInteractive(false);
      }
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', release);
    document.addEventListener('mouseleave', leave);
    return () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', release);
      document.removeEventListener('mouseleave', leave);
    };
  }, []);
  return (
    <div className={`overlay-root ${state.profile.reducedMotion ? 'reduce-motion' : ''}`}>
      <div
        className={`overlay-status ${state.activity.kind === 'attention' ? 'needs-attention' : ''}`}
        data-hit
      >
        <span className={`status-dot ${state.activity.kind}`} />
        {state.activity.mode === 'demo' ? 'DEMO · ' : ''}
        {state.activity.label}
      </div>
      <button
        className="overlay-character"
        data-hit
        onClick={() => bridge.openPanel()}
        aria-label="Open your guild"
        title="Open your guild"
      >
        <Sprite profile={state.profile} kind={state.activity.kind} />
      </button>
      <div className="overlay-tools" data-hit>
        <button
          aria-label="Pet your companion"
          onClick={() => {
            setHeart(true);
            setTimeout(() => setHeart(false), 1800);
          }}
        >
          <Heart size={14} />
        </button>
        <button aria-label="Play an adventure" onClick={() => bridge.openPanel()}>
          <Sparkles size={14} />
        </button>
        <button
          aria-label="Drag companion to reposition"
          onMouseDown={(event) => {
            event.preventDefault();
            drag.current = { x: event.screenX, y: event.screenY };
          }}
        >
          <GripHorizontal size={16} />
        </button>
      </div>
      {heart && (
        <span className="pet-heart" aria-live="polite">
          ♥
        </span>
      )}
    </div>
  );
}
