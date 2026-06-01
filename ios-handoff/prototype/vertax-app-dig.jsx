/* VERTAX iOS prototype — Dig tab (Analyze + Collection Gaps) */

function analyzeTarget(t) {
  const crate = PROTO_RECORDS;
  const minDiff = Math.min(...crate.map(r => Math.abs(r.bpm - t.bpm)));
  const tempo = Math.max(8, Math.min(98, 100 - minDiff * 7));
  const harmCount = crate.filter(r => camHarmonic(t.key, r.key)).length;
  const harmonic = Math.max(10, Math.min(96, 30 + harmCount * 7));
  const styleCount = crate.filter(r => r.genre === t.genre).length;
  const style = Math.max(12, Math.min(92, styleCount * 22));
  const score = Math.round(tempo * 0.4 + harmonic * 0.4 + style * 0.2);
  const sameRegion = crate.filter(r => Math.abs(r.bpm - t.bpm) <= 4 && camHarmonic(t.key, r.key)).length;
  const opportunity = Math.max(18, Math.min(95, 92 - sameRegion * 16));
  const verdict = score >= 72 ? 'good' : score >= 45 ? 'partial' : 'weak';
  const verdictText = verdict === 'good'
    ? `Buy it — strengthens your ${t.bpm} / ${t.key} core.`
    : verdict === 'partial'
      ? 'Maybe — only partial overlap with how you play.'
      : 'Skip for now — barely fits your crate.';
  const matches = crate.filter(r => camHarmonic(t.key, r.key) && Math.abs(r.bpm - t.bpm) <= 6)
    .sort((a, b) => Math.abs(a.bpm - t.bpm) - Math.abs(b.bpm - t.bpm)).slice(0, 3);
  const bars = [
    ['Tempo cluster', `${t.bpm} vs your core`, tempo, ''],
    ['Harmonic role', `${t.key} links ${harmCount} records`, harmonic, ''],
    ['Style overlap', t.genre, style, 'cyan'],
    ['Crate opportunity', sameRegion ? 'Some cover here' : 'Open lane', opportunity, 'amber'],
  ];
  return { score, verdict, verdictText, bars, matches };
}

const ANALYZE_STEPS = ['Fetching Discogs release', 'Reading tracklist & key', 'Matching against your crate', 'Scoring harmonic fit'];

function DigScreen() {
  const { showToast, addToCrate, pushView } = useApp();
  const [mode, setMode] = React.useState('analyze');
  const [q, setQ] = React.useState('');
  const [state, setState] = React.useState('idle'); // idle|loading|result
  const [target, setTarget] = React.useState(null);
  const [result, setResult] = React.useState(null);
  const [stepN, setStepN] = React.useState(0);
  const [disp, setDisp] = React.useState(0);

  const start = (tg) => { setTarget(tg); setState('loading'); setResult(null); };
  const reset = () => { setState('idle'); setResult(null); setTarget(null); setQ(''); };

  React.useEffect(() => {
    if (state !== 'loading' || !target) return;
    setStepN(0);
    const iv = setInterval(() => setStepN(n => (n >= ANALYZE_STEPS.length ? n : n + 1)), 520);
    const done = setTimeout(() => { setResult(analyzeTarget(target)); setDisp(0); setState('result'); }, 2250);
    return () => { clearInterval(iv); clearTimeout(done); };
  }, [state, target]);

  React.useEffect(() => {
    if (state !== 'result' || !result) return;
    let raf; const t0 = performance.now(), dur = 950;
    const tick = (now) => { const p = Math.min(1, (now - t0) / dur); setDisp(Math.round(result.score * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [state, result]);

  const ringColor = result ? (result.verdict === 'good' ? 'var(--lime)' : result.verdict === 'partial' ? 'var(--amber)' : 'var(--text-3)') : 'var(--lime)';

  return (
    <>
      <div className="vx-nav">
        <div>
          <div className="vx-nav-kicker">DIG · {mode === 'analyze' ? 'WORTH IT?' : 'WHAT TO DIG'}</div>
          <div className="vx-title">Dig</div>
        </div>
      </div>

      <div style={{ padding: '0 var(--pad)' }}>
        <div className="vx-seg">
          <button className={mode === 'analyze' ? 'on' : ''} onClick={() => setMode('analyze')}>Analyze</button>
          <button className={mode === 'gaps' ? 'on' : ''} onClick={() => setMode('gaps')}>Gaps</button>
        </div>
      </div>

      <div className="vp-scroll" style={{ padding: '0 var(--pad)', marginTop: 14 }}>
        {mode === 'analyze' && state === 'idle' && (
          <div className="vp-fadeup">
            <div className="vp-input">
              <Ic.disc size={18} c="var(--text-3)" />
              <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && q.trim() && start(ANALYZE_TARGETS[0])} placeholder="Paste Discogs link or cat #" />
              {q && <Press onClick={() => start(ANALYZE_TARGETS[0])} style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--lime)', color: 'var(--lime-ink)', display: 'grid', placeItems: 'center', flex: '0 0 auto' }}><Ic.chevron size={17} /></Press>}
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--text-3)', margin: '10px 2px 0', lineHeight: 1.45 }}>Vertax pulls the release, then scores it against your own crate with real harmonic &amp; tempo math.</p>

            <div className="vx-sectionhead"><h3 style={{ fontSize: 13.5, color: 'var(--text-2)', fontWeight: 600 }}>TRY A RELEASE</h3></div>
            <div className="vx-list">
              {ANALYZE_TARGETS.map(tg => (
                <Press key={tg.id} className="vx-trow tap-row" onClick={() => start(tg)} style={{ gap: 13 }}>
                  <Cover seed={tg.seed} cat={tg.cat} size={46} />
                  <div className="vx-trow-main">
                    <div className="vx-trow-title" style={{ fontSize: 15 }}>{tg.artist} — {tg.title}</div>
                    <div className="vx-trow-sub" style={{ fontFamily: 'var(--mono)' }}>{tg.label} · {tg.cat}</div>
                  </div>
                  <div className="vx-trow-meta"><span className="vx-bpm" style={{ fontSize: 14 }}>{tg.bpm}</span><span className="vx-key">{tg.key}</span></div>
                </Press>
              ))}
            </div>
          </div>
        )}

        {mode === 'analyze' && state === 'loading' && target && (
          <div className="vp-fadeup">
            <div className="vx-card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 11 }}>
              <Cover seed={target.seed} cat={target.cat} size={46} radius={11} />
              <div style={{ flex: 1 }}><div style={{ fontSize: 14.5, fontWeight: 600 }}>{target.artist} — {target.title}</div><div style={{ fontSize: 11.5, color: 'var(--text-2)', fontFamily: 'var(--mono)' }}>{target.label} · {target.cat}</div></div>
            </div>
            <div className="vx-card vx-card-pad vstack-16" style={{ marginTop: 12 }}>
              {ANALYZE_STEPS.map((s, i) => (
                <div key={i} className={'vp-step' + (i < stepN ? ' done' : i === stepN ? ' active' : '')}>
                  <div className="vp-step-ic">{i < stepN ? <Ic.check size={13} /> : i === stepN ? <div className="vp-spinner" style={{ width: 13, height: 13, borderWidth: 1.5 }} /> : null}</div>
                  {s}
                </div>
              ))}
            </div>
          </div>
        )}

        {mode === 'analyze' && state === 'result' && result && target && (
          <div className="vp-fadeup">
            <div className="vx-card vx-card-pad vx-herodata" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <ScoreRing value={disp} size={92} stroke={8} label="FIT" color={ringColor} />
              <div style={{ flex: 1 }}>
                <span className={'vx-verdict ' + result.verdict}><span style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor' }} />{result.verdict === 'good' ? 'Strong fit' : result.verdict === 'partial' ? 'Partial fit' : 'Weak fit'}</span>
                <div style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.3, marginTop: 10 }}>{result.verdictText}</div>
                <div style={{ display: 'flex', gap: 14, marginTop: 10 }}><Bpm value={target.bpm} size={16} /><div className="vx-bpm" style={{ fontSize: 16, color: 'var(--accent-text)' }}>{target.key}</div></div>
              </div>
            </div>

            <div className="vx-sectionhead"><h3>Why</h3><Press onClick={reset} style={{ fontSize: 13, color: 'var(--text-2)' }}>New</Press></div>
            <div className="vx-card vx-card-pad vstack-16">
              {result.bars.map(([ti, su, v, col], i) => (
                <div key={i}>
                  <div className="spread" style={{ marginBottom: 7 }}>
                    <div><span style={{ fontSize: 13.5, fontWeight: 600 }}>{ti}</span><span style={{ fontSize: 12, color: 'var(--text-2)', marginLeft: 8 }}>{su}</span></div>
                    <span className="vx-bpm" style={{ fontSize: 12.5, color: col === 'amber' ? 'var(--amber)' : col === 'cyan' ? 'var(--cyan)' : 'var(--accent-text)' }}>{v}</span>
                  </div>
                  <div className={'vx-bar ' + col}><i style={{ width: v + '%' }} /></div>
                </div>
              ))}
            </div>

            {result.matches.length > 0 && (
              <>
                <div className="vx-sectionhead"><h3>Pairs with</h3><span className="count">{result.matches.length}</span></div>
                <div className="vx-list">
                  {result.matches.map(r => (
                    <Press key={r.id} className="vx-trow tap-row" onClick={() => pushView('release', { id: r.id })}>
                      <Cover seed={r.seed} cat={r.cat} size={44} />
                      <div className="vx-trow-main"><div className="vx-trow-title" style={{ fontSize: 14.5 }}>{r.artist} — {r.title}</div><div className="vx-trow-sub">{camHarmonic(target.key, r.key) === 'same' ? 'Same key · seamless' : 'Harmonic match'}</div></div>
                      <span className={'vx-key' + (camHarmonic(target.key, r.key) === 'same' ? ' vx-key--lime' : '')}>{r.key}</span>
                    </Press>
                  ))}
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: 10, margin: '16px 0 12px' }}>
              <button className="vx-btn vx-btn--dark tap" onClick={() => showToast('Saved to wishlist', <Ic.heart size={15} />)}><Ic.heart size={18} />Wishlist</button>
              <button className="vx-btn vx-btn--primary tap" onClick={() => { showToast('Added to crate', <Ic.check size={15} />); reset(); }}><Ic.plus size={18} c="var(--lime-ink)" />Add to crate</button>
            </div>
          </div>
        )}

        {mode === 'gaps' && <GapsBody onDig={(t) => showToast('Searching Discogs for ' + t)} />}
        <div style={{ height: 10 }} />
      </div>

      <AppTabBar />
    </>
  );
}

function GapsBody({ onDig }) {
  const buckets = [['84–90', 30], ['160–166', 55], ['166–170', 80], ['170–174', 100], ['174–178', 38], ['178+', 18]];
  const digIdx = 4;
  const fills = [40, 25, 70, 95, 60, 30, 80, 100, 75, 55, 20, 35];
  return (
    <div className="vp-fadeup">
      <div className="vx-card vx-card-pad">
        <div className="spread" style={{ marginBottom: 14 }}><h3 style={{ fontSize: 15, fontWeight: 650 }}>Tempo coverage</h3><span className="label-mono">RECORDS / BPM</span></div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 92 }}>
          {buckets.map(([lab, h], i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
              <div style={{ width: '100%', height: 92, display: 'flex', alignItems: 'flex-end' }}>
                <div style={{ width: '100%', height: h + '%', borderRadius: 5, background: i === 3 ? 'var(--lime)' : (i === digIdx ? 'transparent' : 'var(--card-2)'), opacity: i === 3 ? 0.9 : 1, border: i === digIdx ? '1.5px dashed var(--lime-line)' : (i === 3 ? 'none' : '1px solid var(--hair)') }} />
              </div>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 8.5, color: i === digIdx ? 'var(--accent-text)' : 'var(--text-3)', whiteSpace: 'nowrap' }}>{lab}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="vx-card vx-card-pad" style={{ marginTop: 12 }}>
        <div className="spread" style={{ marginBottom: 13 }}><h3 style={{ fontSize: 15, fontWeight: 650 }}>Camelot map</h3><span className="label-mono">A · MINOR ROW</span></div>
        <div style={{ display: 'flex', gap: 5 }}>
          {fills.map((f, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ height: 30, borderRadius: 7, marginBottom: 5, background: f < 30 ? 'transparent' : `color-mix(in srgb, var(--lime) ${f}%, var(--card-2))`, border: f < 30 ? '1.5px dashed var(--lime-line)' : '1px solid var(--hair)' }} />
              <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--text-3)' }}>{i + 1}A</span>
            </div>
          ))}
        </div>
      </div>

      <div className="vx-sectionhead"><h3>Dig here next</h3></div>
      <div className="vstack-8">
        {[['174–178 · 9A', 'Only 4 records — your sets stall here'], ['11A · cold keys', 'Thin harmonic exit from 12A'], ['Halftime · 84–90', 'Strong opener pool, you own 6']].map(([t, s], i) => (
          <Press key={i} className="vx-card tap-row" onClick={() => onDig(t)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--lime-dim)', border: '1px solid var(--lime-line)', display: 'grid', placeItems: 'center', color: 'var(--accent-text)', flex: '0 0 auto' }}><Ic.flame size={17} /></div>
            <div className="vx-trow-main"><div className="vx-trow-title" style={{ fontSize: 14.5 }}>{t}</div><div className="vx-trow-sub">{s}</div></div>
            <Ic.chevron size={18} c="var(--text-3)" />
          </Press>
        ))}
      </div>
    </div>
  );
}

TAB_VIEWS.dig = DigScreen;
Object.assign(window, { DigScreen, GapsBody, analyzeTarget });
