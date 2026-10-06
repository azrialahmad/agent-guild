import { Leaf, Moon, Sparkles, Star, ArrowRight, Gift } from 'lucide-react';
import { ROUTES } from '../../shared/game';
import type { Adventure as AdventureState, GameAction, Rune } from '../../shared/types';

const RuneIcon = { leaf: Leaf, star: Star, moon: Moon };
export function RuneMark({ rune }: { rune: Rune }) {
  const Icon = RuneIcon[rune];
  return <Icon size={24} aria-hidden="true" />;
}

export function Adventure({
  adventure,
  act,
}: {
  adventure: AdventureState | null;
  act: (action: GameAction) => void;
}) {
  if (!adventure)
    return (
      <div className="routes">
        {(Object.entries(ROUTES) as [AdventureState['route'], typeof ROUTES.meadow][]).map(
          ([id, route], index) => (
            <button
              className="route-card"
              key={id}
              onClick={() => act({ type: 'start', route: id })}
            >
              <span className={`route-icon route-${id}`}>
                {index === 0 ? <Sparkles /> : index === 1 ? <Moon /> : <Leaf />}
              </span>
              <span>
                <strong>{route.name}</strong>
                <small>A small memory adventure · 40 XP</small>
              </span>
              <ArrowRight size={18} />
            </button>
          ),
        )}
      </div>
    );
  const route = ROUTES[adventure.route];
  return (
    <div className="encounter">
      <span className="eyebrow">FICTIONAL MICRO-ADVENTURE</span>
      <h3>{route.name}</h3>
      <p>{route.description}</p>
      {adventure.phase === 'scouting' && (
        <>
          <div className="rune-sequence">
            {adventure.sequence.map((rune, i) => (
              <span key={i}>
                <RuneMark rune={rune} />
                <small>{rune}</small>
              </span>
            ))}
          </div>
          <p className="fine-print">
            Remember these three signs. You can leave at any time; your adventure is saved.
          </p>
          <button className="button primary" onClick={() => act({ type: 'remember' })}>
            I remember the trail <ArrowRight size={16} />
          </button>
        </>
      )}
      {adventure.phase === 'following' && (
        <>
          <div className="trail-progress" aria-label={`${adventure.progress} of 3 signs followed`}>
            {[0, 1, 2].map((i) => (
              <span key={i} className={i < adventure.progress ? 'filled' : ''}>
                {i < adventure.progress ? '✓' : i + 1}
              </span>
            ))}
          </div>
          <p>Which sign comes {adventure.progress ? 'next' : 'first'}?</p>
          <div className="rune-choices">
            {(['leaf', 'star', 'moon'] as Rune[]).map((rune) => (
              <button key={rune} onClick={() => act({ type: 'rune', rune })}>
                <RuneMark rune={rune} />
                <span>{rune}</span>
              </button>
            ))}
          </div>
          <p className="fine-print">
            {adventure.attempts
              ? 'A little detour. Try the trail again—there is no penalty.'
              : 'A moment of memory, not a race.'}
          </p>
          <details>
            <summary>Peek at the trail</summary>
            <div className="rune-sequence small">
              {adventure.sequence.map((rune, i) => (
                <span key={i}>
                  <RuneMark rune={rune} />
                </span>
              ))}
            </div>
          </details>
        </>
      )}
      {adventure.phase === 'complete' && (
        <div className="reward">
          <Gift size={36} />
          <h3>A little adventure, well traveled.</h3>
          <p>
            Your keepsake: <strong>40 adventure XP</strong>. Cosmetics unlock as your collection
            grows.
          </p>
          <button className="button primary" onClick={() => act({ type: 'collect' })}>
            Collect your keepsake <Sparkles size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
