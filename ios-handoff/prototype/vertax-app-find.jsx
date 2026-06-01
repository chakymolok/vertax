/* VERTAX iOS prototype — Find tab (BPM / Key lookup) */

function findLookup(q) {
  const s = q.trim().toLowerCase();
  if (!s) return null;
  return FIND_DB.find(d => d.q.some(tok => tok.includes(s) || s.includes(tok)) ||
    (d.artist + ' ' + d.title).toLowerCase().includes(s) || d.cat.toLowerCase() === s) || null;
}

const RECENT = [['Komatic', 'Northwall'], ['Dovetail', 'Undertow'], ['Senan', 'Driftwood Dub']];

function FindScreen() {
  const { showToast, addToSet, openSheet } = useApp();
  const [q, setQ] = React.useState('');
  const [status, setStatus] = React.useState('idle'); // idle|loading|result|notfound
  const [result, setResult] = React.useState(null);
  const inputRef = React.useRef(null);

  const run = (query) => {
    const qq = (query != null ? query : q).trim();
    if (!qq) return;
    setQ(qq);
    setStatus('loading');
    setResult(null);
    if (inputRef.current) inputRef.current.blur();
    setTimeout(() => {
      const hit = findLookup(qq);
      if (hit) { setResult(hit); setStatus('result'); }
      else setStatus('notfound');
    }, 1250);
  };
  const reset = () => { setQ(''); setStatus('idle'); setResult(null); };

  return (
    <>
      <div className="vx-nav">
        <div>
          <div className="vx-nav-kicker">FIND · BPM / KEY</div>
          <div className="vx-title">Find</div>
        </div>
        <div className="vx-nav-actions"><Press className="vx-iconbtn" onClick={() => openSheet('discogsImport')}><Ic.import size={19} /></Press></div>
      </div>

      <div style={{ padding: '0 var(--pad)' }}>
        <div className="vp-input">
          <Ic.search size={18} c="var(--text-3)" />
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && run()} placeholder="Artist, title or catalog #" />
          {q ? (status === 'loading'
            ? <div className="vp-spinner" />
            : <Press onClick={() => run()} style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--lime)', color: 'var(--lime-ink)', display: 'grid', placeItems: 'center', flex: '0 0 auto' }}><Ic.chevron size={17} /></Press>
          ) : null}
        </div>
      </div>

      <div className="vp-scroll" style={{ padding: '0 var(--pad)', marginTop: 16 }}>
        {status === 'idle' && (
          <div className="vp-fadeup">
            <div className="vx-sectionhead" style={{ marginTop: 0 }}><h3 style={{ fontSize: 13.5, color: 'var(--text-2)', fontWeight: 600 }}>RECENT</h3></div>
            <div className="vx-list">
              {RECENT.map(([a, ti], i) => (
                <Press key={i} className="vx-trow tap-row" onClick={() => run(a + ' ' + ti)} style={{ gap: 13 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--card)', border: '1px solid var(--hair)', display: 'grid', placeItems: 'center', color: 'var(--text-3)' }}><Ic.clock size={18} /></div>
                  <div className="vx-trow-main"><div className="vx-trow-title" style={{ fontSize: 15 }}>{a} — {ti}</div><div className="vx-trow-sub">Tap to look up again</div></div>
                  <Ic.arrowUp size={16} c="var(--text-3)" />
                </Press>
              ))}
            </div>
            <Press className="vx-card vx-card-pad" onClick={() => openSheet('discogsImport')} style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 13 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--lime-dim)', border: '1px solid var(--lime-line)', display: 'grid', placeItems: 'center', color: 'var(--accent-text)' }}><Ic.import size={20} /></div>
              <div style={{ flex: 1 }}><div style={{ fontSize: 15, fontWeight: 650 }}>Import from Discogs</div><div style={{ fontSize: 12.5, color: 'var(--text-2)' }}>Pull a whole collection by profile link</div></div>
              <Ic.chevron size={18} c="var(--text-3)" />
            </Press>
          </div>
        )}

        {status === 'loading' && (
          <div className="vp-fadeup">
            <div className="vx-card vx-card-pad">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div className="vp-spinner" /><span style={{ fontSize: 13.5, color: 'var(--text-2)' }}>Checking Beatport, GetSongBPM, AcousticBrainz…</span>
              </div>
              <div className="vp-skel" style={{ height: 46, width: '60%', marginBottom: 12 }} />
              <div style={{ display: 'flex', gap: 10 }}>
                <div className="vp-skel" style={{ height: 30, flex: 1 }} /><div className="vp-skel" style={{ height: 30, flex: 1 }} /><div className="vp-skel" style={{ height: 30, flex: 1 }} />
              </div>
            </div>
          </div>
        )}

        {status === 'notfound' && (
          <div className="vx-empty vp-fadeup" style={{ marginTop: 24 }}>
            <div className="ei"><Ic.search size={24} /></div>
            <h4>No reliable match</h4>
            <p>We couldn't confirm BPM &amp; key for “{q}”. Try the catalog number, or add it manually and set values yourself.</p>
            <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'center' }}>
              <button className="vx-btn vx-btn--ghost vx-btn--sm tap" onClick={reset}>Clear</button>
              <button className="vx-btn vx-btn--dark vx-btn--sm tap" onClick={() => showToast('Opening manual entry')}>Add manually</button>
            </div>
          </div>
        )}

        {status === 'result' && result && (
          <div className="vp-fadeup">
            <div className="vx-card vx-card-pad vx-herodata">
              <div className="spread">
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, color: 'var(--text-2)', fontWeight: 550 }}>{result.artist}</div>
                  <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1, marginTop: 2 }}>{result.title}</div>
                </div>
                <span className="vx-chip vx-chip--mono">{result.genre}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <div className="vx-card-2" style={{ flex: 1, textAlign: 'center', padding: '12px 4px', background: 'var(--card-2)', borderRadius: 13 }}>
                  <Bpm value={result.bpm} size={26} /><div className="label-mono" style={{ marginTop: 5 }}>Tempo</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center', padding: '12px 4px', background: 'var(--card-2)', borderRadius: 13 }}>
                  <div className="vx-bpm" style={{ fontSize: 26, color: 'var(--accent-text)' }}>{result.key}</div><div className="label-mono" style={{ marginTop: 5 }}>Camelot</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center', padding: '12px 4px', background: 'var(--card-2)', borderRadius: 13 }}>
                  <div className="vx-bpm" style={{ fontSize: 26 }}>{result.mkey.split(' ')[0]}</div><div className="label-mono" style={{ marginTop: 5 }}>{result.mkey.split(' ')[1] || 'Key'}</div>
                </div>
              </div>
            </div>

            <div className="vx-card vx-card-pad" style={{ marginTop: 12 }}>
              <div className="spread" style={{ marginBottom: 9 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>Confidence</span>
                <span className="vx-bpm" style={{ fontSize: 13, color: result.conf >= 90 ? 'var(--accent-text)' : 'var(--amber)' }}>{result.conf}%</span>
              </div>
              <div className={'vx-bar' + (result.conf >= 90 ? '' : ' amber')}><i style={{ width: result.conf + '%' }} /></div>
              <div className="spread" style={{ marginTop: 11 }}>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Source</span>
                <span className="vx-chip vx-chip--mono" style={{ height: 22 }}>{result.source}</span>
              </div>
              <div className="spread" style={{ marginTop: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Label · Cat</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-2)' }}>{result.label} · {result.cat}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button className="vx-btn vx-btn--dark tap" onClick={() => showToast('Saved to crate', <Ic.check size={15} />)}><Ic.plus size={18} />Save to crate</button>
              <button className="vx-btn vx-btn--primary tap" onClick={() => { addToSet('r5'); showToast('Added to set', <Ic.check size={15} />); }}><Ic.build size={18} c="var(--lime-ink)" />Use in set</button>
            </div>
            <Press onClick={reset} style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 13, marginTop: 16, paddingBottom: 8 }}>New search</Press>
          </div>
        )}
      </div>

      <AppTabBar />
    </>
  );
}

TAB_VIEWS.find = FindScreen;
Object.assign(window, { FindScreen, findLookup });
