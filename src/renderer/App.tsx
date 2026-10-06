import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  ChevronRight,
  CircleHelp,
  Compass,
  Eye,
  EyeOff,
  Heart,
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
  const [page, setPage] = useState<Page>(() =>
    new URLSearchParams(location.search).get('page') === 'adventures' ? 'adventures' : 'guild',
  );
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
  useEffect(() => bridge.onNavigate(setPage), []);
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
  const harness = activity.source
    ? { opencode: 'OpenCode', codex: 'Codex', 'claude-code': 'Claude Code' }[
        activity.source.harness
      ]
    : 'Coding agent';
  const completed = profile.completed.length;
  const cloak = CLOAKS.find((item) => item.id === profile.cloak)!;
  const title = NAV.find((item) => item.id === page)!.label;

  return (
    <div className={`app-shell ${profile.reducedMotion ? 'reduce-motion' : ''}`}>
      <div className="main-shell">
        <header className="topbar">
          <div className="brand">
            <Sprout size={21} aria-hidden="true" />
            <span>agent guild</span>
          </div>
          <div className="topbar-right">
            <span className="mode-badge" title={activity.source?.label}>
              <span
                className={`status-dot ${activity.connection === 'connected' ? 'working' : activity.mode === 'demo' ? 'reading' : 'unknown'}`}
              />
              {activity.mode === 'demo' ? 'Demo' : harness}
            </span>
            <button
              className={`icon-button ${page === 'activity' ? 'selected' : ''}`}
              aria-label="Agent activity"
              title="Agent activity"
              aria-current={page === 'activity' ? 'page' : undefined}
              onClick={() => setPage('activity')}
            >
              <Radio size={17} />
            </button>
            <button
              className={`icon-button ${page === 'settings' ? 'selected' : ''}`}
              aria-label="Settings"
              title="Settings"
              aria-current={page === 'settings' ? 'page' : undefined}
              onClick={() => setPage('settings')}
            >
              <Settings2 size={17} />
            </button>
            <button
              className="icon-button"
              aria-label="Share your guild"
              title="Share your guild"
              onClick={() => setSharing(true)}
            >
              <Share2 size={17} />
            </button>
          </div>
        </header>
        <nav className="panel-tabs" aria-label="Guild navigation">
          {NAV.slice(0, 3).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-link ${page === id ? 'selected' : ''}`}
              aria-current={page === id ? 'page' : undefined}
              onClick={() => setPage(id)}
            >
              <Icon size={16} aria-hidden="true" />
              {label}
            </button>
          ))}
        </nav>
        <main className="main-content" key={page}>
          {page !== 'guild' && (
            <div className="page-heading">
              <h1>{title}</h1>
            </div>
          )}
          {activity.kind === 'attention' && (
            <div className="attention-banner" role="status">
              <CircleHelp size={19} />
              <span>
                {activity.mode === 'demo' ? 'Demo attention signal' : 'Your agent needs you'}. Your
                adventure is saved.
              </span>
            </div>
          )}
          {page === 'guild' && (
            <>
              <section className="character-card card">
                <div className="character-details">
                  <div>
                    <h1>{profile.name}</h1>
                    <p>
                      {cloak.name} cloak · Level {level(profile.xp)}
                    </p>
                  </div>
                  <button
                    className="icon-button pet-button"
                    title="Pet your companion"
                    aria-label="Pet your companion"
                    onClick={() => {
                      setPet(true);
                      setTimeout(() => setPet(false), 1800);
                    }}
                  >
                    <Heart size={18} />
                  </button>
                </div>
                <div className="landscape-wrap">
                  <Sprite profile={profile} kind={activity.kind} landscape />
                  <span className="scene-caption">
                    <span className={`status-dot ${activity.kind}`} />
                    {WORK_LABELS[activity.kind]}
                  </span>
                  {pet && <span className="landscape-heart">♥</span>}
                </div>
                <div className="xp-row">
                  <span>
                    {completed} adventure{completed === 1 ? '' : 's'} completed
                  </span>
                  <span>{profile.xp % 100} / 100 XP</span>
                </div>
                <div className="xp-track">
                  <span style={{ width: `${profile.xp % 100}%` }} />
                </div>
                <button
                  className="session-status"
                  onClick={() => setPage(activity.mode === 'demo' ? 'settings' : 'activity')}
                >
                  <span className={`status-dot ${activity.kind}`} />
                  <span>
                    <strong>{activity.label}</strong>
                    <small title={activity.error || activity.sessionTitle}>
                      {activity.mode === 'demo'
                        ? 'Demo activity · connect your agent'
                        : activity.sessionTitle}
                    </small>
                  </span>
                  <ChevronRight size={16} />
                </button>
              </section>
              <button className="adventure-shortcut" onClick={() => setPage('adventures')}>
                <span className="shortcut-icon">
                  <Sparkles size={20} />
                </span>
                <span>
                  <strong>
                    {profile.adventure ? 'Continue your adventure' : 'Start an adventure'}
                  </strong>
                  <small>40 XP · progress saved</small>
                </span>
                <ArrowRight size={17} />
              </button>
              <details className="disclosure history-disclosure">
                <summary>
                  Adventure history <span>{completed} completed</span>
                </summary>
                <Calendar days={profile.activityDays} />
                <div className="calendar-legend">
                  <span>Last 84 local days · game activity</span>
                  <span>
                    Less <i className="day" />
                    <i className="day active" />
                    <i className="day active high" /> More
                  </span>
                </div>
              </details>
            </>
          )}
          {page === 'adventures' && (
            <section className="card adventure-page" aria-busy={busy}>
              <div className="section-heading">
                <div>
                  <h2>{profile.adventure ? 'Your saved adventure' : 'Choose a trail'}</h2>
                </div>
                <Compass size={18} />
              </div>
              <Adventure adventure={profile.adventure} act={act} />
              <div className="adventure-footer">
                <Check size={14} /> Saved after every choice. Come back anytime.
              </div>
            </section>
          )}
          {page === 'wardrobe' && (
            <div className="wardrobe-grid">
              <section className="wardrobe-preview">
                <Sprite profile={profile} kind="idle" landscape />
                <p>
                  {cloak.name} · Level {level(profile.xp)}
                </p>
              </section>
              <section className="card wardrobe-options">
                <h2>Cloaks</h2>
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
                        ? 'Unlocks after 2 adventures.'
                        : 'Your companion’s companion.'}
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
                    {activity.mode === 'demo' ? 'DEMO EVENTS' : 'FOLLOWING'}
                  </span>
                  <h2>{activity.sessionTitle}</h2>
                </div>
                <span className="soft-badge">{activity.connection}</span>
              </div>
              <div className="live-status">
                <span className={`status-dot ${activity.kind}`} />
                {activity.label}
              </div>
              {activity.source && (
                <p className="fine-print">
                  Source: {activity.source.label}
                  <br />
                  Last signal received: {new Date(activity.source.lastSignal).toLocaleTimeString()}
                </p>
              )}
              {activity.usage && (
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
              )}
              <details className="disclosure signal-details">
                <summary>About these signals</summary>
                <p className="fine-print">
                  {activity.historyNote || 'Fictional demo events. They never award game XP.'}
                </p>
                <p className="fine-print">
                  {activity.usage
                    ? 'OpenCode session token totals.'
                    : 'Token totals are unavailable for this source.'}{' '}
                  Token use does not measure productivity.
                </p>
              </details>
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
                <h2>Agent connection</h2>
                <p>Choose your agent’s plugin or hook source for live activity.</p>
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
                      {session.title} · {session.project} · {session.source ?? 'Local session'}
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
                  Use demo activity <ArrowRight size={14} />
                </button>
                <details className="disclosure">
                  <summary>Adapter setup</summary>
                  <p className="fine-print">
                    {isDesktop
                      ? 'Install the adapter from integrations/README.md, run the harness, then refresh. Prefer its plugin/hook entry when a UI uses a private server. Source and last-signal time appear in Agent activity.'
                      : 'Browser preview: install the desktop app for live connections.'}
                  </p>
                </details>
              </section>
              <section className="card settings-card">
                <h2>Preferences</h2>
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
                    <small>Also respects system reduced motion.</small>
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
                        ? 'Visible without taking focus.'
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
