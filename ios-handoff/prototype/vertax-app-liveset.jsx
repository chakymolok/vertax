/* VERTAX iOS prototype — Live Set Mode (club-readable performance screen) */

/* physical sleeve position per record (A/B side + track) */
const SLEEVE = { r1:'A1', r2:'B2', r3:'A2', r4:'B1', r5:'A1', r6:'AA', r7:'B1', r8:'A3', r9:'B2', r10:'A1', r11:'B1', r12:'A2' };
const RED = '#e8736a';

/* compatibility traffic light between current and next */
function liveCompat(a, b) {
  if (!a || !b) return null;
  const rel = camHarmonic(a.key, b.key);
  const db = b.bpm - a.bpm;
  const pct = (db / a.bpm) * 100;
  let level, label;
  if (rel && Math.abs(db) <= 3) {
    level = 'green';
    label = rel === 'same' ? 'Same key' : rel === 'adj' ? (camParse(b.key).n > camParse(a.key).n ? '+1 neighbour' : '−1 neighbour') : 'Relative key';
  } else if (rel || Math.abs(db) <= 6) {
    level = 'yellow';
    label = rel ? 'Harmonic · tempo jump' : 'Workable blend';
  } else { level = 'red'; label = 'Risky — key clash'; }
  const bpmText = (db > 0 ? '+' : db < 0 ? '' : '±') + db + ' BPM · ' + (pct > 0 ? '+' : '') + pct.toFixed(1) + '%';
  return { level, label, bpmText, db };
}
const LV = { green: 'var(--lime)', yellow: 'var(--amber)', red: RED };

function fmtClock(s) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  const p = n => String(n).padStart(2, '0');
  return (h > 0 ? p(h) + ':' : '') + p(m) + ':' + p(ss);
}

function LiveSet({ mode: initialMode }) {
  const { setIds, recordById, crateIds, endLive, showToast, addToSet } = useApp();
  const [mode, setMode] = React.useState(initialMode || 'set');
  const [idx, setIdx] = React.useState(0);          // index of NOW within order
  const [played, setPlayed] = React.useState([]);    // history of played ids
  const [elapsed, setElapsed] = React.useState(0);
  const [dx, setDx] = React.useState(0);            // swipe feedback
  const listRef = React.useRef(null);

  // order depends on mode
  const order = React.useMemo(() => {
    if (mode === 'set') return setIds.map(recordById).filter(Boolean);
    // freestyle: start from played history + current crate suggestions chain
    return crateIds.map(recordById).filter(Boolean);
  }, [mode, setIds, crateIds, recordById]);

  const now = order[idx] || null;
  const next = order[idx + 1] || null;
  const compat = liveCompat(now, next);

  // timer
  React.useEffect(() => { const iv = setInterval(() => setElapsed(e => e + 1), 1000); return () => clearInterval(iv); }, []);

  const advance = () => {
    if (idx >= order.length - 1) { showToast('End of set', <Ic.check size={15} />); return; }
    setPlayed(p => [...p, order[idx].id]);
    setIdx(i => i + 1);
  };
  const previous = () => { if (idx === 0) return; setIdx(i => i - 1); setPlayed(p => p.slice(0, -1)); };
  const undo = () => { if (played.length === 0) return; setIdx(i => Math.max(0, i - 1)); setPlayed(p => p.slice(0, -1)); showToast('Undid last'); };

  // swipe on NOW area
  const onDown = (e) => {
    const sx = e.clientX; let moved = 0;
    const mv = (ev) => { moved = ev.clientX - sx; setDx(Math.max(-90, Math.min(90, moved))); };
    const up = () => {
      document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up);
      if (moved < -56) advance(); else if (moved > 56) previous();
      setDx(0);
    };
    document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up);
  };

  // suggestions for freestyle / replace-next — compatible with NOW, not already ahead
  const suggestions = React.useMemo(() => {
    if (!now) return [];
    const aheadIds = new Set(order.slice(idx).map(r => r.id));
    return crateIds.map(recordById).filter(Boolean)
      .filter(r => !aheadIds.has(r.id))
      .map(r => ({ r, c: liveCompat(now, r) }))
      .filter(x => x.c && x.c.level !== 'red')
      .sort((a, b) => (a.c.level === 'green' ? 0 : 1) - (b.c.level === 'green' ? 0 : 1) || Math.abs(a.c.db) - Math.abs(b.c.db))
      .slice(0, 4);
  }, [now, idx, order, crateIds, recordById]);

  return (
    <div className="vp-live" style={{ position: 'absolute', inset: 0, zIndex: 90, background: '#060807', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* darkened blurred cover backdrop */}
      {now && <div style={{ position: 'absolute', inset: 0, opacity: 0.22, filter: 'blur(34px) saturate(1.2)', background: `radial-gradient(80% 50% at 50% 18%, ${COVER_TINTS[coverHash(now.seed) % COVER_TINTS.length][0]}, transparent 70%)` }} />}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(6,8,7,0.4), #060807 55%)' }} />

      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%' }}>
        <StatusBar />

        {/* header: end · timer · mode */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 18px 12px' }}>
          <Press onClick={() => { endLive(); showToast('Set saved to history', <Ic.check size={15} />); }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, color: RED, fontSize: 13.5, fontWeight: 600 }}>
            <Ic.stop size={13} c={RED} />End
          </Press>
          <div style={{ textAlign: 'center' }}>
            <div className="vx-bpm" style={{ fontSize: 17, color: '#fff', letterSpacing: '0.04em' }}>{fmtClock(elapsed)}</div>
            <div className="label-mono" style={{ fontSize: 8.5, marginTop: 1 }}>TIME IN SET</div>
          </div>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.07)', borderRadius: 9, padding: 2 }}>
            {['set', 'freestyle'].map(m => (
              <Press key={m} onClick={() => { setMode(m); setIdx(0); setPlayed([]); }}
                style={{ padding: '5px 9px', borderRadius: 7, fontSize: 11, fontWeight: 600, fontFamily: 'var(--mono)', letterSpacing: '0.02em', background: mode === m ? 'rgba(255,255,255,0.13)' : 'transparent', color: mode === m ? '#fff' : 'var(--text-3)' }}>
                {m === 'set' ? 'SET' : 'FREE'}
              </Press>
            ))}
          </div>
        </div>

        {/* scrollable middle */}
        <div className="vp-scroll" style={{ padding: '0 16px' }}>
          {/* NOW PLAYING — the only big block; advancing reveals the next */}
          <div onPointerDown={onDown} style={{ touchAction: 'pan-y', transform: `translateX(${dx}px)`, transition: dx === 0 ? 'transform 0.25s cubic-bezier(.32,.72,0,1)' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--lime)', boxShadow: '0 0 10px var(--lime)' }} />
              <span className="label-mono" style={{ color: 'var(--lime)', fontSize: 10 }}>NOW PLAYING</span>
              <span className="label-mono" style={{ marginLeft: 'auto' }}>{idx + 1} / {order.length}</span>
            </div>
            {now && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <Cover seed={now.seed} cat={now.cat} size={64} radius={13} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13.5, color: 'var(--text-2)', fontWeight: 550 }}>{now.artist}</div>
                    <div style={{ fontSize: 25, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.04, marginTop: 1 }}>{now.title}</div>
                  </div>
                </div>
                {/* huge stats */}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 0, marginTop: 20 }}>
                  <div style={{ flex: 1 }}>
                    <div className="vx-bpm" style={{ fontSize: 62, color: '#fff', lineHeight: 0.82 }}>{now.bpm}</div>
                    <div className="label-mono" style={{ marginTop: 8 }}>BPM</div>
                  </div>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <div className="vx-bpm" style={{ fontSize: 62, color: 'var(--lime)', lineHeight: 0.82 }}>{now.key}</div>
                    <div className="label-mono" style={{ marginTop: 8 }}>{CAMELOT_KEY[now.key] || 'KEY'}</div>
                  </div>
                  <div style={{ flex: 1, textAlign: 'right' }}>
                    <div className="vx-bpm" style={{ fontSize: 62, color: '#fff', lineHeight: 0.82 }}>{SLEEVE[now.id] || 'A1'}</div>
                    <div className="label-mono" style={{ marginTop: 8 }}>SLEEVE</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* swipe / advance affordance */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 18, color: 'var(--text-3)' }}>
            <span style={{ opacity: dx > 12 ? 1 : 0.4, color: dx > 12 ? 'var(--text-2)' : 'var(--text-3)', transition: 'opacity .15s' }}><Ic.back size={15} /></span>
            <span className="label-mono" style={{ fontSize: 9.5 }}>SWIPE OR PRESS NEXT WHEN MIXED IN</span>
            <span style={{ opacity: dx < -12 ? 1 : 0.4, color: dx < -12 ? 'var(--lime)' : 'var(--text-3)', transition: 'opacity .15s' }}><Ic.chevron size={15} /></span>
          </div>

          {/* SET LIST */}
          <div className="spread" style={{ margin: '24px 2px 10px' }}>
            <span className="label-mono" style={{ fontSize: 10 }}>{mode === 'set' ? 'SETLIST' : 'CRATE QUEUE'}</span>
            <span className="label-mono">{played.length} PLAYED</span>
          </div>
          <div ref={listRef} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {order.map((r, i) => {
              const state = i < idx ? 'played' : i === idx ? 'now' : 'up';
              const isNext = state === 'up' && i === idx + 1;
              const rc = isNext ? compat : null;
              return (
                <div key={r.id + i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 11px', borderRadius: 12,
                  background: state === 'now' ? 'rgba(200,255,46,0.10)' : isNext ? 'rgba(255,255,255,0.035)' : 'transparent',
                  border: state === 'now' ? '1px solid var(--lime-line)' : isNext ? '1px solid var(--hair-2)' : '1px solid transparent',
                  opacity: state === 'played' ? 0.42 : 1 }}>
                  <div style={{ width: 18, textAlign: 'center', flex: '0 0 auto' }}>
                    {state === 'played' ? <Ic.check size={14} c="var(--text-3)" />
                      : state === 'now' ? <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--lime)', display: 'inline-block' }} />
                      : isNext && rc ? <span style={{ width: 9, height: 9, borderRadius: '50%', background: LV[rc.level], display: 'inline-block', boxShadow: `0 0 7px ${LV[rc.level]}` }} />
                      : <span className="vx-mono" style={{ fontSize: 12, color: 'var(--text-3)' }}>{i + 1}</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ fontSize: 14, fontWeight: state === 'now' ? 650 : 550, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: state === 'now' ? 'var(--lime)' : 'var(--text)' }}>{r.artist} — {r.title}</span>
                      {isNext && <span className="label-mono" style={{ fontSize: 8.5, color: 'var(--lime)', flex: '0 0 auto' }}>NEXT</span>}
                    </div>
                    <div className="vx-mono" style={{ fontSize: 10.5, marginTop: 1, color: isNext && rc ? LV[rc.level] : 'var(--text-3)' }}>
                      <span style={{ color: state === 'played' ? 'var(--text-3)' : '#fff', fontWeight: 600 }}>{SLEEVE[r.id] || 'A1'}</span> · {isNext && rc ? rc.label : r.label}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '0 0 auto' }}>
                    <span className="vx-bpm" style={{ fontSize: 13 }}>{r.bpm}</span>
                    <span className={'vx-key' + (state === 'now' ? ' vx-key--lime' : '')} style={{ height: 22, minWidth: 26, fontSize: 11.5 }}>{r.key}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* SUGGESTED FROM CRATE */}
          <div className="spread" style={{ margin: '24px 2px 10px' }}>
            <span className="label-mono" style={{ fontSize: 10 }}>SUGGESTED FROM CRATE</span>
            <span className="label-mono">FROM NOW · {now ? now.key : ''}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 6 }}>
            {suggestions.map(({ r, c }) => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', borderRadius: 13, border: '1px solid var(--hair)', background: 'rgba(255,255,255,0.02)' }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: LV[c.level], flex: '0 0 auto' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.artist} — {r.title}</div>
                  <div className="vx-mono" style={{ fontSize: 10.5, color: LV[c.level], marginTop: 2 }}>{r.bpm} · {r.key} · {c.bpmText}</div>
                </div>
                <Press onClick={() => { addToSet(r.id); showToast('Added after current', <Ic.check size={15} />); }}
                  style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--card-2)', border: '1px solid var(--hair)', display: 'grid', placeItems: 'center', color: 'var(--text)', flex: '0 0 auto' }}>
                  <Ic.plus size={17} />
                </Press>
              </div>
            ))}
          </div>
        </div>

        {/* CONTROLS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px 24px', borderTop: '1px solid var(--hair)', background: 'rgba(6,8,7,0.7)', WebkitBackdropFilter: 'blur(16px)', backdropFilter: 'blur(16px)' }}>
          <Press onClick={previous} style={{ width: 52, height: 56, borderRadius: 16, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--hair)', display: 'grid', placeItems: 'center', color: idx === 0 ? 'var(--text-3)' : 'var(--text)', flex: '0 0 auto' }}>
            <Ic.skipBack size={22} />
          </Press>
          <Press onClick={advance} style={{ flex: 1, height: 56, borderRadius: 16, background: 'var(--lime)', color: 'var(--lime-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em' }}>
            <Ic.check size={21} c="var(--lime-ink)" />Mark played · Next
          </Press>
          <Press onClick={undo} style={{ width: 52, height: 56, borderRadius: 16, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--hair)', display: 'grid', placeItems: 'center', color: played.length ? 'var(--text)' : 'var(--text-3)', flex: '0 0 auto' }}>
            <Ic.undo size={20} />
          </Press>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { LiveSet, liveCompat, SLEEVE });
