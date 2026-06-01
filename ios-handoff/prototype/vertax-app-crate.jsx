/* VERTAX iOS prototype — Crate tab + Release detail (push) + record sheet */

function AppRecordRow({ r, onTap }) {
  return (
    <Press className="vx-trow tap-row" onClick={onTap} style={{ cursor: 'pointer' }}>
      <Cover seed={r.seed} cat={r.cat} size={48} />
      <div className="vx-trow-main">
        <div className="vx-trow-title">{r.artist} — {r.title}</div>
        <div className="vx-trow-sub">{r.label} · {r.cat} · {r.genre}</div>
      </div>
      <div className="vx-trow-meta">
        <span className="vx-bpm" style={{ fontSize: 15 }}>{r.bpm}</span>
        <span className={'vx-key' + (r.key === '8A' ? ' vx-key--lime' : '')}>{r.key}</span>
      </div>
    </Press>
  );
}

/* ---- Crate tab ---- */
const CRATE_CHIPS = [
  { id: 'bpm1', label: '168–174', kind: 'bpm', test: r => r.bpm >= 168 && r.bpm <= 174 },
  { id: 'bpm2', label: '84–90', kind: 'bpm', test: r => r.bpm >= 84 && r.bpm <= 90 },
  { id: 'k8a', label: '8A', kind: 'key', test: r => r.key === '8A' },
  { id: 'k9a', label: '9A', kind: 'key', test: r => r.key === '9A' },
  { id: 'gjungle', label: 'Jungle', kind: 'genre', test: r => r.genre === 'Jungle' },
  { id: 'gliquid', label: 'Liquid', kind: 'genre', test: r => r.genre === 'Liquid' },
  { id: 'gatmos', label: 'Atmospheric', kind: 'genre', test: r => r.genre === 'Atmospheric' },
  { id: 'unplayed', label: 'Unplayed', kind: 'flag', test: r => !r.played },
];

function CrateScreen() {
  const { crateIds, pushView, startLive, setIds, openSheet } = useApp();
  const [q, setQ] = React.useState('');
  const [active, setActive] = React.useState([]); // chip ids
  const inputRef = React.useRef(null);

  const toggle = (id) => setActive(a => a.includes(id) ? a.filter(x => x !== id) : [...a, id]);

  const records = React.useMemo(() => {
    let list = crateIds.map(id => PROTO_RECORDS.find(r => r.id === id)).filter(Boolean);
    const qq = q.trim().toLowerCase();
    if (qq) list = list.filter(r => (r.artist + ' ' + r.title + ' ' + r.label + ' ' + r.cat + ' ' + r.genre).toLowerCase().includes(qq));
    const byKind = {};
    active.forEach(id => { const c = CRATE_CHIPS.find(c => c.id === id); if (c) (byKind[c.kind] = byKind[c.kind] || []).push(c); });
    Object.values(byKind).forEach(chips => { list = list.filter(r => chips.some(c => c.test(r))); });
    return list.sort((a, b) => b.bpm - a.bpm);
  }, [crateIds, q, active]);

  return (
    <>
      <div className="vx-nav">
        <div>
          <div className="vx-nav-kicker">{crateIds.length} RECORDS · 7 LABELS</div>
          <div className="vx-title">Crate</div>
        </div>
        <div className="vx-nav-actions">
          <Press className="vx-iconbtn" onClick={() => startLive(setIds.length ? 'set' : 'freestyle')} style={{ background: 'var(--lime-dim)', borderColor: 'var(--lime-line)', color: 'var(--accent-text)' }}><Ic.play size={17} /></Press>
          <Press className="vx-iconbtn" onClick={() => openSheet('settings')}><Ic.gear size={18} /></Press>
          <Press className="vx-iconbtn" onClick={() => openSheet('discogsImport')}><Ic.plus size={19} /></Press>
        </div>
      </div>

      <div style={{ padding: '0 var(--pad)' }}>
        <div className="vp-input" style={{ height: 40 }}>
          <Ic.search size={17} c="var(--text-3)" />
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} placeholder="Search artist, label, cat #" />
          {q && <Press onClick={() => setQ('')} style={{ color: 'var(--text-3)' }}><Ic.x size={16} /></Press>}
        </div>
        <div className="vp-chips" style={{ marginTop: 11 }}>
          <Press className={'vx-chip' + (active.length === 0 ? ' vx-chip--active' : '')} onClick={() => setActive([])}>All</Press>
          {CRATE_CHIPS.map(c => (
            <Press key={c.id} className={'vx-chip vx-chip--mono' + (active.includes(c.id) ? ' vx-chip--active' : '')} onClick={() => toggle(c.id)}>{c.label}</Press>
          ))}
        </div>
      </div>

      <div className="vp-scroll" style={{ padding: '0 var(--pad)', marginTop: 4 }}>
        <div className="vx-sectionhead" style={{ marginTop: 14 }}>
          <h3 style={{ fontSize: 13.5, color: 'var(--text-2)', fontWeight: 600 }}>SORTED BY TEMPO</h3>
          <span className="count">{records.length} shown</span>
        </div>
        {records.length === 0 ? (
          <div className="vx-empty" style={{ marginTop: 30 }}>
            <div className="ei"><Ic.search size={24} /></div>
            <h4>No records match</h4>
            <p>Try clearing filters or searching a different label.</p>
          </div>
        ) : (
          <div className="vx-list" style={{ paddingBottom: 10 }}>
            {records.map(r => <AppRecordRow key={r.id} r={r} onTap={() => pushView('release', { id: r.id })} />)}
          </div>
        )}
      </div>

      <AppTabBar />
    </>
  );
}

/* ---- Release detail (push) ---- */
function ReleaseView({ id, back }) {
  const { recordById, crateIds, addToSet, setIds, openSheet, showToast } = useApp();
  const r = recordById(id);
  const [liked, setLiked] = React.useState(false);
  const inSet = setIds.includes(id);

  const crate = crateIds.map(recordById).filter(x => x && x.id !== id);
  const fitCount = crate.filter(x => camHarmonic(r.key, x.key)).length;
  const rel = [
    [r.key, 'same', crate.filter(x => x.key === r.key).length],
    [camStep(r.key, 1), '+1', crate.filter(x => x.key === camStep(r.key, 1)).length],
    [camStep(r.key, -1), '−1', crate.filter(x => x.key === camStep(r.key, -1)).length],
    [camRel(r.key), 'rel', crate.filter(x => x.key === camRel(r.key)).length],
  ];
  const tracks = [['A1', r.title, r.bpm, r.key], ['A2', r.title + ' — Reprise', r.bpm, r.key],
    ['B1', 'Undertow', r.bpm - 2, camStep(r.key, -1)], ['B2', 'Undertow — Dub', Math.round(r.bpm / 2), camStep(r.key, -1)]];

  return (
    <>
      <div className="vx-nav" style={{ paddingTop: 0, alignItems: 'center' }}>
        <Press className="vx-iconbtn" onClick={back}><Ic.back size={19} /></Press>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 12.5, color: 'var(--text-2)', letterSpacing: '0.04em' }}>{r.label} · {r.cat}</div>
        <Press className="vx-iconbtn" onClick={() => openSheet('recordActions', { id })}><Ic.dots size={19} /></Press>
      </div>

      <div className="vp-scroll" style={{ padding: '0 var(--pad)' }}>
        <div style={{ display: 'flex', gap: 15, alignItems: 'center', marginTop: 4 }} className="vp-fadeup">
          <Cover seed={r.seed} cat={r.cat} size={92} radius={14} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 550 }}>{r.artist}</div>
            <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1, marginTop: 2 }}>{r.title}</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 9, flexWrap: 'wrap' }}>
              <span className="vx-chip vx-chip--mono">{r.genre}</span>
              <span className="vx-chip vx-chip--mono">{r.yr}</span>
              <span className="vx-chip vx-chip--mono">★ {r.rating}</span>
            </div>
          </div>
        </div>

        <div className="vx-card vx-card-pad vx-herodata" style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 6, padding: '14px 8px' }}>
          <div style={{ flex: 1, textAlign: 'center' }}><Bpm value={r.bpm} size={30} /><div className="label-mono" style={{ marginTop: 6 }}>Tempo</div></div>
          <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--hair)' }} />
          <div style={{ flex: 1, textAlign: 'center' }}><div className="vx-bpm" style={{ fontSize: 30, color: 'var(--accent-text)' }}>{r.key}</div><div className="label-mono" style={{ marginTop: 6 }}>{CAMELOT_KEY[r.key] || 'Key'}</div></div>
          <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--hair)' }} />
          <div style={{ flex: 1, textAlign: 'center' }}><div className="vx-bpm" style={{ fontSize: 30 }}>{fitCount}</div><div className="label-mono" style={{ marginTop: 6 }}>Fit crate</div></div>
        </div>

        <div className="vx-card vx-card-pad" style={{ marginTop: 12, padding: '13px 15px' }}>
          <div className="spread" style={{ marginBottom: 9 }}>
            <span className="label-mono" style={{ color: 'var(--accent-text)' }}>A1 · CUE PREVIEW</span>
            <span className="label-mono">1:24 / 3:48</span>
          </div>
          <Wave n={54} seed={11} height={30} className="lime" peak={19} />
        </div>

        <div className="vx-sectionhead"><h3>Tracklist</h3><span className="count">{tracks.length} tracks</span></div>
        <div className="vx-list">
          {tracks.map(([pos, name, bpm, key], i) => (
            <div key={i} className="vx-trow" style={{ gap: 12 }}>
              <span className="label-mono" style={{ width: 18, color: 'var(--text-2)' }}>{pos}</span>
              <div className="vx-trow-main" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="vx-trow-title" style={{ fontSize: 14.5 }}>{name}</span>
              </div>
              <div className="vx-trow-meta"><span className="vx-bpm" style={{ fontSize: 14 }}>{bpm}</span><span className={'vx-key' + (key === r.key ? ' vx-key--lime' : '')}>{key}</span></div>
            </div>
          ))}
        </div>

        <div className="vx-sectionhead"><h3>Mixes well into</h3><span className="more">{fitCount} in crate</span></div>
        <div style={{ display: 'flex', gap: 8 }}>
          {rel.map(([k, lab, n], i) => (
            <div key={i} className="vx-card" style={{ flex: 1, padding: '11px 6px', textAlign: 'center' }}>
              <div className="vx-bpm" style={{ fontSize: 17, color: lab === 'same' ? 'var(--accent-text)' : 'var(--cyan)' }}>{k}</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 3 }}>{lab} · {n}</div>
            </div>
          ))}
        </div>

        <div className="vx-sectionhead"><h3>Notes</h3></div>
        <div className="vx-card vx-card-pad" style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.5, marginBottom: 14 }}>{r.notes}</div>
      </div>

      <div style={{ display: 'flex', gap: 10, padding: '12px var(--pad) 26px', borderTop: '1px solid var(--hair)', background: 'var(--bar-bg)', WebkitBackdropFilter: 'blur(20px)', backdropFilter: 'blur(20px)' }}>
        <Press className="vx-iconbtn" onClick={() => { setLiked(l => !l); showToast(liked ? 'Removed from wishlist' : 'Saved to wishlist', <Ic.heart size={15} />); }}
          style={{ width: 50, height: 50, borderRadius: 15, color: liked ? 'var(--accent-text)' : 'var(--text)', background: liked ? 'var(--lime-dim)' : 'var(--card)', borderColor: liked ? 'var(--lime-line)' : 'var(--hair)' }}>
          <Ic.heart size={20} />
        </Press>
        <button className={'vx-btn tap ' + (inSet ? 'vx-btn--dark' : 'vx-btn--primary')} style={{ flex: 1, width: 'auto' }}
          onClick={() => { if (!inSet) { addToSet(id); showToast('Added to Warehouse set', <Ic.check size={15} />); } }}>
          {inSet ? <><Ic.check size={19} />In your set</> : <><Ic.plus size={19} c="var(--lime-ink)" />Add to set</>}
        </button>
      </div>
    </>
  );
}

/* camelot helpers for stepping */
function camStep(k, d) { const p = camParse(k); let n = ((p.n - 1 + d) % 12 + 12) % 12 + 1; return n + p.l; }
function camRel(k) { const p = camParse(k); return p.n + (p.l === 'A' ? 'B' : 'A'); }

/* ---- record actions sheet ---- */
function RecordActionsSheet({ id, close }) {
  const { recordById, addToSet, showToast, setIds, pushView, closeSheet } = useApp();
  const r = recordById(id);
  const items = [
    [Ic.build, setIds.includes(id) ? 'Already in set' : 'Add to set', () => { addToSet(id); showToast('Added to set', <Ic.check size={15} />); close(); }],
    [Ic.dig, 'Find similar to dig', () => { close(); }],
    [Ic.tag, 'Edit notes & tags', () => { close(); }],
    [Ic.heart, 'Save to wishlist', () => { showToast('Saved to wishlist'); close(); }],
  ];
  return (
    <div style={{ padding: '0 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 4px 14px' }}>
        <Cover seed={r.seed} cat={r.cat} size={42} />
        <div><div style={{ fontSize: 15, fontWeight: 650 }}>{r.artist} — {r.title}</div><div style={{ fontSize: 12, color: 'var(--text-2)' }}>{r.label} · {r.cat}</div></div>
      </div>
      <div className="vx-list">
        {items.map(([I, label, fn], i) => (
          <Press key={i} className="vx-trow tap-row" onClick={fn} style={{ gap: 13 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--card-2)', border: '1px solid var(--hair)', display: 'grid', placeItems: 'center', color: 'var(--text)' }}><I size={18} /></div>
            <div className="vx-trow-main"><div className="vx-trow-title" style={{ fontSize: 15 }}>{label}</div></div>
            <Ic.chevron size={17} c="var(--text-3)" />
          </Press>
        ))}
      </div>
      <button className="vx-btn vx-btn--ghost tap" style={{ marginTop: 14 }} onClick={close}>Cancel</button>
    </div>
  );
}

TAB_VIEWS.crate = CrateScreen;
PUSH_VIEWS.release = ReleaseView;
SHEET_VIEWS.recordActions = RecordActionsSheet;
Object.assign(window, { AppRecordRow, CrateScreen, ReleaseView, camStep, camRel });
