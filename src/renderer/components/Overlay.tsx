import { useEffect, useRef, useState } from 'react';
import { GripHorizontal, Heart, Sparkles } from 'lucide-react';
import type { GuildState } from '../../shared/types';
import { bridge } from '../bridge';
import { Sprite } from './Sprite';
import { spritePixelIsVisible } from '../sprite-hit-test';

export function Overlay({ state }: { state: GuildState }) {
  const [heart, setHeart] = useState(false);
  const [dragging, setDragging] = useState(false);
  const interactive = useRef(false);
  const drag = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    document.body.classList.add('overlay-body');
    const move = (event: MouseEvent) => {
      if (drag.current) {
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
        hit = spritePixelIsVisible(canvas, x, y);
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
      setDragging(false);
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
        title={
          state.activity.source
            ? `${state.activity.source.label}\nLast signal: ${new Date(state.activity.source.lastSignal).toLocaleTimeString()}`
            : undefined
        }
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
          title="Pet your companion"
          onClick={() => {
            setHeart(true);
            setTimeout(() => setHeart(false), 1800);
          }}
        >
          <Heart size={14} />
        </button>
        <button
          aria-label="Play an adventure"
          title="Play an adventure"
          onClick={() => bridge.openPanel('adventures')}
        >
          <Sparkles size={14} />
        </button>
        <button
          aria-label="Drag companion to reposition"
          title="Drag to move your companion"
          className={`drag-handle ${dragging ? 'dragging' : ''}`}
          onPointerDown={(event) => {
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            bridge.setInteractive(true);
            interactive.current = true;
            drag.current = { x: event.screenX, y: event.screenY };
            setDragging(true);
          }}
          onPointerMove={(event) => {
            if (!drag.current) return;
            bridge.moveOverlay(event.screenX - drag.current.x, event.screenY - drag.current.y);
            drag.current = { x: event.screenX, y: event.screenY };
          }}
          onPointerUp={(event) => {
            drag.current = null;
            setDragging(false);
            if (event.currentTarget.hasPointerCapture(event.pointerId))
              event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={() => {
            drag.current = null;
            setDragging(false);
          }}
          onLostPointerCapture={() => {
            drag.current = null;
            setDragging(false);
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
