import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  Compass,
  Eye,
  EyeOff,
  Flower2,
  Github,
  Heart,
  Leaf,
  Radio,
  RefreshCw,
  Settings2,
  Share2,
  Shirt,
  Sparkles,
  Sprout,
  X,
} from 'lucide-react';
import { CLOAKS, level, localDay } from '../shared/game';
import { WORK_LABELS, type GameAction, type GuildState, type SessionOption } from '../shared/types';
import { bridge, isDesktop } from './bridge';
import { Sprite } from './components/Sprite';
import { Adventure } from './components/Adventure';
import { Overlay } from './components/Overlay';
import { createShareCard } from './share';

const NAV = [
  { id: 'guild', label: 'My guild', icon: Sprout },
  { id: 'adventures', label: 'Adventures', icon: Compass },
  { id: 'wardrobe', label: 'Wardrobe', icon: Shirt },
  { id: 'activity', label: 'Agent activity', icon: Radio },
  { id: 'settings', label: 'Settings', icon: Settings2 },
] as const;
type Page = (typeof NAV)[number]['id'];

function Calendar({ days }: { days: Record<string, number> }) {
  return (
    <div className="calendar" aria-label="Adventure completions in the last 84 local days">
      {Array.from({ length: 84 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - 83 + i);
        const day = localDay(date);
        const count = days[day] ?? 0;
        return (
          <span
            key={day}
            className={count ? (count > 2 ? 'day active high' : 'day active') : 'day'}
            title={`${day}: ${count} adventures`}
            aria-label={`${day}: ${count} adventures`}
          />
        );
      })}
    </div>
  );
}

function ShareDialog({
  state,
  close,
  report,
}: {
  state: GuildState;
  close: () => void;
  report: (message: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [image, setImage] = useState('');
  const [calendar, setCalendar] = useState(true);
  const [tokens, setTokens] = useState(false);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  useEffect(() => {
    let canceled = false;
    void document.fonts.ready.then(() => {
      if (!canceled)
        setImage(
          createShareCard(state.profile, tokens ? state.activity.usage : undefined, calendar),
        );
    });
    return () => {
      canceled = true;
    };
  }, [state.profile, state.activity.usage, calendar, tokens]);
  return (
    <dialog ref={ref} className="share-dialog" onCancel={close} aria-labelledby="share-title">
      <div className="section-heading">
        <div>
          <span className="eyebrow">A LITTLE SOMETHING TO SHARE</span>
          <h2 id="share-title">Your guild postcard</h2>
        </div>
        <button className="icon-button" onClick={close} aria-label="Close postcard">
          <X size={20} />
        </button>
      </div>
      {image && (
        <img
          src={image}
          alt="Preview of your character, level, and selected guild statistics"
          className="postcard-preview"
        />
      )}
      <div className="share-options">
        <label>
          <input
            type="checkbox"
            checked={calendar}
            onChange={(event) => setCalendar(event.target.checked)}
          />{' '}
          Adventure calendar
        </label>
        <label>
          <input
            type="checkbox"
            checked={tokens}
            disabled={!state.activity.usage}
            onChange={(event) => setTokens(event.target.checked)}
          />{' '}
          Selected-session tokens {state.activity.usage ? '' : '(unavailable)'}
        </label>
      </div>
      <p className="fine-print">
        Only the details shown above are exported. No prompts, code, or project paths.
      </p>
      <button
        className="button primary"
        disabled={!image}
        onClick={() =>
          void bridge
            .saveImage(image)
            .then((saved) => {
              if (saved) report('Postcard saved. Make someone’s feed a little cozier.');
            })
            .catch((error) => report(String(error)))
        }
      >
        <ArrowDownToLine size={16} /> Download postcard
      </button>
    </dialog>
  );
}

export function App() {
  const [state, setState] = useState<GuildState | null>(null);
  const [page, setPage] = useState<Page>('guild');
  const [notice, setNotice] = useState('');
  const [sharing, setSharing] = useState(false);
  const [pet, setPet] = useState(false);
  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const actionBusy = useRef(false);
  const overlay = new URLSearchParams(location.search).get('surface') === 'overlay';

  useEffect(() => {
    let received = false;
    const unsubscribe = bridge.subscribe((next) => {
      received = true;
      setState(next);
    });
    void bridge
      .state()
      .then((next) => {
        if (!received) setState(next);
      })
      .catch((error) => setNotice(String(error)));
    return unsubscribe;
  }, []);
  useEffect(() => {
    if (state) setName(state.profile.name);
  }, [state?.profile.name]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 6500);
    return () => clearTimeout(timer);
  }, [notice]);

  function act(action: GameAction) {
    if (actionBusy.current) return;
    actionBusy.current = true;
    setBusy(true);
    void bridge
      .act(action)
      .then(setState)
      .catch((error) => setNotice(String(error)))
      .finally(() => {
        actionBusy.current = false;
        setBusy(false);
      });
  }

  function refreshSessions() {
    setLoading(true);
    void bridge
      .sessions()
      .then((items) => {
        setSessions(items);
        setSelected((current) =>
          items.some((item) => item.id === current) ? current : (items[0]?.id ?? ''),
        );
      })
      .catch((error) => setNotice(error instanceof Error ? error.message : String(error)))
      .finally(() => setLoading(false));
  }

  if (!state) return <div className="loading-screen">{notice || 'Opening your guild…'}</div>;
  if (overlay) return <Overlay state={state} />;
  const { profile, activity } = state;
  const completed = profile.completed.length;
  const cloak = CLOAKS.find((item) => item.id === profile.cloak)!;
  const title = NAV.find((item) => item.id === page)!.label;

  return (
    <div className={`app-shell ${profile.reducedMotion ? 'reduce-motion' : ''}`}>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <Sprout size={23} />
          </span>
          <div>
            agent guild<span>GOOD COMPANY, ALWAYS.</span>
          </div>
        </div>
        <span className="nav-caption">YOUR LITTLE WORLD</span>
        <nav aria-label="Guild navigation">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-link ${page === id ? 'selected' : ''}`}
              aria-current={page === id ? 'page' : undefined}
              onClick={() => setPage(id)}
            >
              <Icon size={18} />
              {label}
              {page === id && <span className="nav-pebble" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <Flower2 size={24} />
          <p>
            Small adventures.
            <br />
            Real company.
          </p>
          <span>Make the waiting a little nicer.</span>
        </div>
        <div className="sidebar-footer">
          <Github size={15} />
          <a href="https://github.com/azrialahmad/agent-guild" target="_blank" rel="noreferrer">
            An open-source little world
          </a>
          <span>v0.1 / EARLY ADVENTURE</span>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Your guild <ChevronRight size={14} />
            <strong>{title}</strong>
          </div>
          <div className="topbar-right">
            <span className="mode-badge">
              <span
                className={`status-dot ${activity.connection === 'connected' ? 'working' : activity.mode === 'demo' ? 'reading' : 'unknown'}`}
              />
              {activity.mode === 'demo' ? 'Demo mode' : `OpenCode ${activity.version ?? ''}`}
            </span>
            <button
              className="icon-button"
              aria-label="Open settings"
              onClick={() => setPage('settings')}
            >
              <Settings2 size={17} />
            </button>
          </div>
        </header>
        <main className="main-content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {page === 'guild' ? 'WELCOME TO YOUR LITTLE CORNER' : 'YOUR NEXT LITTLE CHAPTER'}
              </span>
              <h1>{page === 'guild' ? 'A little company while you create.' : title}</h1>
              <p>
                {page === 'guild'
                  ? 'Your agent does the work. You make the adventure.'
                  : page === 'adventures'
                    ? 'A small detour for the moments in between. Always saved, never a race.'
                    : page === 'wardrobe'
                      ? 'A character that becomes a little more you.'
                      : page === 'activity'
                        ? 'Real events behind the little animations.'
                        : 'Make yourself at home. Connect, settle in, and keep creating.'}
              </p>
            </div>
            <button className="button share-button" onClick={() => setSharing(true)}>
              <Share2 size={16} />
              Share your guild
            </button>
          </div>
          {activity.kind === 'attention' && (
            <div className="attention-banner" role="status">
              <CircleHelp size={19} />
              <span>
                {activity.mode === 'demo' ? 'Demo attention signal' : 'Your agent needs you'}. Your
                adventure is saved—return to your coding session whenever you’re ready.
              </span>
            </div>
          )}
          {page === 'guild' && (
            <>
              <div className="hero-grid">
                <section className="character-card card">
                  <div className="card-topline">
                    <span className="eyebrow">YOUR COMPANION</span>
                    <span className="soft-badge">LV. {level(profile.xp)}</span>
                  </div>
                  <div className="landscape-wrap">
                    <Sprite profile={profile} kind={activity.kind} landscape />
                    <span className="scene-caption">
                      <span className={`status-dot ${activity.kind}`} />
                      {WORK_LABELS[activity.kind]}
                    </span>
                    {pet && <span className="landscape-heart">♥</span>}
                  </div>
                  <div className="character-details">
                    <div>
                      <h2>{profile.name}</h2>
                      <p>Wanderer · {cloak.name} cloak</p>
                    </div>
                    <button
                      className="icon-button pet-button"
                      title="Say hello"
                      aria-label="Pet your companion"
                      onClick={() => {
                        setPet(true);
                        setTimeout(() => setPet(false), 1800);
                      }}
                    >
                      <Heart size={18} />
                    </button>
                  </div>
                  <div className="xp-row">
                    <span>Level {level(profile.xp)}</span>
                    <span>{profile.xp % 100} / 100 XP</span>
                  </div>
                  <div className="xp-track">
                    <span style={{ width: `${profile.xp % 100}%` }} />
                  </div>
                </section>
                <div className="hero-side">
                  <section className="live-card card">
                    <div className="card-topline">
                      <span className="eyebrow">ON THE WORKBENCH</span>
                      <Radio size={17} />
                    </div>
                    <h3>
                      {activity.mode === 'demo' ? 'A glimpse of guild life' : activity.sessionTitle}
                    </h3>
                    <div className="live-status">
                      <span className={`status-dot ${activity.kind}`} />
                      <span>{activity.label}</span>
                    </div>
                    <p>
                      {activity.mode === 'demo'
                        ? 'Synthetic agent activity lets you try the guild immediately. Connect a real session when you’re ready.'
                        : activity.connection === 'connected'
                          ? 'Following your real session. Turn ended means the agent stopped—not that the code is correct.'
                          : activity.error || 'Connecting to your local OpenCode service…'}
                    </p>
                    <button
                      className="text-button"
                      onClick={() => {
                        setPage(activity.mode === 'demo' ? 'settings' : 'activity');
                      }}
                    >
                      {' '}
                      {activity.mode === 'demo'
                        ? 'Connect your agent'
                        : 'Look behind the animation'}{' '}
                      <ArrowRight size={15} />
                    </button>
                  </section>
                  <section className="milestone-card card">
                    <span className="milestone-icon">
                      <Leaf size={22} />
                    </span>
                    <div>
                      <span className="eyebrow">LITTLE STEPS ADD UP</span>
                      <h3>
                        {completed
                          ? `${completed} adventure${completed === 1 ? '' : 's'}, and counting.`
                          : 'Every story starts somewhere.'}
                      </h3>
                      <p>
                        {completed < 2
                          ? `${2 - completed} more adventure${2 - completed === 1 ? '' : 's'} to meet a woodland fox.`
                          : 'Your woodland fox is waiting in the wardrobe.'}
                      </p>
                    </div>
                  </section>
                </div>
              </div>
              <div className="bottom-grid">
                <section className="card adventure-teaser">
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">WHILE YOUR AGENT WANDERS</span>
                      <h2>
                        {profile.adventure ? 'Your trail is waiting.' : 'Take a tiny adventure.'}
                      </h2>
                    </div>
                    <Sparkles size={22} />
                  </div>
                  <p>
                    A firefly, a quiet river, a woodland song. A few moments of play become a
                    keepsake of your own.
                  </p>
                  <button className="button primary" onClick={() => setPage('adventures')}>
                    {profile.adventure ? 'Continue your adventure' : 'Find your first adventure'}
                    <ArrowRight size={16} />
                  </button>
                  <span className="fine-print">40 XP per adventure · progress saved as you go</span>
                </section>
                <section className="card calendar-card">
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">A TRAIL OF LITTLE MOMENTS</span>
                      <h2>Your adventure activity</h2>
                    </div>
                    <BookOpen size={20} />
                  </div>
                  <Calendar days={profile.activityDays} />
                  <div className="calendar-legend">
                    <span>Last 84 local days · game activity</span>
                    <span>
                      Less <i className="day" />
                      <i className="day active" />
                      <i className="day active high" /> More
                    </span>
                  </div>
                </section>
              </div>
            </>
          )}
          {page === 'adventures' && (
            <section className="card adventure-page" aria-busy={busy}>
              <div className="section-heading">
                <div>
                  <span className="eyebrow">CHOOSE A PATH, BRING HOME A STORY</span>
                  <h2>
                    {profile.adventure ? 'One little step at a time.' : 'Where shall we wander?'}
                  </h2>
                </div>
                <Compass size={24} />
              </div>
              <Adventure adventure={profile.adventure} act={act} />
              <div className="adventure-footer">
                <Check size={15} /> Your progress saves after every choice. Leaving never costs you
                a reward.
              </div>
            </section>
          )}
          {page === 'wardrobe' && (
            <div className="wardrobe-grid">
              <section className="character-card card">
                <Sprite profile={profile} kind="idle" landscape />
                <div className="character-details">
                  <div>
                    <h2>{profile.name}</h2>
                    <p>
                      {cloak.name} · level {level(profile.xp)}
                    </p>
                  </div>
                </div>
              </section>
              <section className="card wardrobe-options">
                <span className="eyebrow">COLLECT LITTLE PIECES OF YOU</span>
                <h2>A cloak for every chapter.</h2>
                <div className="cloak-grid">
                  {CLOAKS.map((item) => (
                    <button
                      disabled={completed < item.adventures}
                      key={item.id}
                      className={`cloak-option ${profile.cloak === item.id ? 'equipped' : ''}`}
                      onClick={() => act({ type: 'cloak', cloak: item.id })}
                    >
                      <span className="cloak-swatch" style={{ background: item.color }} />
                      <strong>{item.name}</strong>
                      <small>
                        {completed < item.adventures
                          ? `${item.adventures} adventures to unlock`
                          : profile.cloak === item.id
                            ? 'Equipped'
                            : 'Available'}
                      </small>
                    </button>
                  ))}
                </div>
                <div className="fox-option">
                  <Heart size={20} />
                  <div>
                    <strong>A woodland friend</strong>
                    <p>
                      {completed < 2
                        ? 'Meet your fox after two adventures.'
                        : 'A little fox to keep your wanderer company.'}
                    </p>
                  </div>
                  <button
                    className="button"
                    disabled={completed < 2}
                    onClick={() => act({ type: 'pet', enabled: !profile.pet })}
                  >
                    {profile.pet ? 'Let rest' : 'Invite fox'}
                  </button>
                </div>
              </section>
            </div>
          )}
          {page === 'activity' && (
            <section className="card activity-page">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">
                    {activity.mode === 'demo'
                      ? 'SYNTHETIC DEMO EVENTS'
                      : 'SELECTED OPENCODE SESSION'}
                  </span>
                  <h2>{activity.sessionTitle}</h2>
                </div>
                <span className="soft-badge">{activity.connection}</span>
              </div>
              <p className="fine-print">
                {activity.historyNote ||
                  'These demo events are fictional. They never award game XP.'}
              </p>
              <div className="usage-grid">
                {[
                  ['Input tokens', activity.usage?.input],
                  ['Output tokens', activity.usage?.output],
                  ['Cache read', activity.usage?.cache.read],
                ].map(([label, value]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <strong>
                      {typeof value === 'number' ? value.toLocaleString() : 'Unavailable'}
                    </strong>
                  </div>
                ))}
              </div>
              <p className="fine-print">
                Session totals reported by OpenCode. Token consumption is not a measure of
                productivity.
              </p>
              <div className="event-list">
                {activity.events.length ? (
                  activity.events.map((event) => (
                    <details key={event.id} className="event-row">
                      <summary>
                        <span className={`status-dot ${event.kind}`} />
                        <span>
                          <strong>{event.label}</strong>
                          <small>{event.source}</small>
                        </span>
                        <time>
                          {new Date(event.time).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </time>
                        <ChevronRight size={15} />
                      </summary>
                      <pre>{event.detail || 'No additional source details.'}</pre>
                    </details>
                  ))
                ) : (
                  <p className="empty-state">
                    New observed events will appear here. No history has been invented.
                  </p>
                )}
              </div>
            </section>
          )}
          {page === 'settings' && (
            <div className="settings-grid">
              <section className="card settings-card">
                <span className="eyebrow">A BRIDGE TO YOUR REAL WORK</span>
                <h2>Connect OpenCode</h2>
                <p>
                  Follow an existing local OpenCode V2 session. Your usual coding interface stays in
                  charge.
                </p>
                <button className="button" onClick={refreshSessions} disabled={loading}>
                  <RefreshCw size={16} className={loading ? 'spin' : ''} />
                  {loading ? 'Finding sessions…' : 'Find local sessions'}
                </button>
                <label className="field-label" htmlFor="session">
                  Choose a session
                </label>
                <select
                  id="session"
                  value={selected}
                  onChange={(event) => setSelected(event.target.value)}
                >
                  <option value="">Select a session</option>
                  {sessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {session.active ? '● ' : ''}
                      {session.title} · {session.project}
                    </option>
                  ))}
                </select>
                <button
                  className="button primary"
                  disabled={!selected || loading}
                  onClick={() =>
                    void bridge
                      .connect(selected)
                      .then(() =>
                        setNotice(
                          'Following your session. Connection status appears in Agent activity.',
                        ),
                      )
                      .catch((error) => setNotice(String(error)))
                  }
                >
                  <Radio size={16} />
                  Follow this session
                </button>
                <button
                  className="text-button"
                  onClick={() => void bridge.demo().catch((error) => setNotice(String(error)))}
                >
                  Use the synthetic demo instead <ArrowRight size={14} />
                </button>
                <p className="fine-print">
                  {isDesktop
                    ? 'Verified target: OpenCode 2.0.19. Credentials remain in the desktop host.'
                    : 'Browser preview: install the desktop app for live connections.'}
                </p>
              </section>
              <section className="card settings-card">
                <span className="eyebrow">SETTLE IN</span>
                <h2>Make it your own</h2>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    act({ type: 'rename', name });
                  }}
                >
                  <label className="field-label" htmlFor="name">
                    Companion name
                  </label>
                  <div className="name-field">
                    <input
                      id="name"
                      value={name}
                      maxLength={32}
                      onChange={(event) => setName(event.target.value)}
                    />
                    <button className="button" type="submit">
                      Save
                    </button>
                  </div>
                </form>
                <label className="toggle-row">
                  <span>
                    <strong>Quiet animations</strong>
                    <small>
                      Keep the character still. System reduced-motion settings are also respected.
                    </small>
                  </span>
                  <input
                    type="checkbox"
                    checked={profile.reducedMotion}
                    onChange={(event) => act({ type: 'motion', reduced: event.target.checked })}
                  />
                </label>
                <div className="toggle-row">
                  <span>
                    <strong>Desktop companion</strong>
                    <small>
                      {isDesktop
                        ? 'Visible over other work, without taking focus.'
                        : 'Available in the installed desktop app.'}
                    </small>
                  </span>
                  <button
                    disabled={!isDesktop}
                    className="icon-button"
                    aria-label={profile.overlayHidden ? 'Show companion' : 'Hide companion'}
                    onClick={() =>
                      void bridge
                        .hideOverlay(!profile.overlayHidden)
                        .catch((error) => setNotice(String(error)))
                    }
                  >
                    {profile.overlayHidden ? <EyeOff size={19} /> : <Eye size={19} />}
                  </button>
                </div>
                <button
                  className="text-button"
                  disabled={!isDesktop}
                  onClick={() => bridge.resetPosition()}
                >
                  Reset desktop position <ArrowRight size={14} />
                </button>
                <button
                  className="button backup-button"
                  onClick={() =>
                    void bridge
                      .backup()
                      .then((saved) => {
                        if (saved) setNotice('Your guild backup is saved.');
                      })
                      .catch((error) => setNotice(String(error)))
                  }
                >
                  <ArrowDownToLine size={16} />
                  Back up your guild
                </button>
              </section>
            </div>
          )}
          <footer className="page-footer">
            <span>
              <Sprout size={13} /> Crafted for the moments in between.
            </span>
            <span>Local progress. Little adventures. No rush.</span>
          </footer>
        </main>
      </div>
      {notice && (
        <div className="toast" role="status">
          {notice}
          <button aria-label="Dismiss message" onClick={() => setNotice('')}>
            <X size={15} />
          </button>
        </div>
      )}
      {sharing && <ShareDialog state={state} close={() => setSharing(false)} report={setNotice} />}
    </div>
  );
}
