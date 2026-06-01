/* VERTAX iOS prototype — Discogs import flow (paste a profile/collection link) */

function parseDiscogsHandle(raw) {
  const s = (raw || '').trim();
  if (!s) return '';
  const m = s.match(/discogs\.com\/(?:user\/)?([A-Za-z0-9_\-.]+)/i);
  if (m) return m[1];
  return s.replace(/^@/, '').split(/[\/\s?]/)[0];
}

const IMPORT_STEPS = ['Fetching Discogs profile', 'Reading collection', 'Matching BPM & Key', 'Building your crate'];
const IMPORT_EXAMPLES = ['discogs.com/user/selectordub', '@crate_digger'];

function DiscogsImportSheet({ close }) {
  const { showToast, setCrateIds, setBooted } = useApp();
  const [url, setUrl] = React.useState('');
  const [phase, setPhase] = React.useState('idle'); // idle | loading | done
  const [step, setStep] = React.useState(0);
  const inputRef = React.useRef(null);

  const handle = parseDiscogsHandle(url);
  const total = PROTO_RECORDS.length;
  const labels = new Set(PROTO_RECORDS.map(r => r.label)).size;

  React.useEffect(() => {
    if (phase !== 'loading') return;
    setStep(0);
    const iv = setInterval(() => setStep(s => (s >= IMPORT_STEPS.length ? s : s + 1)), 560);
    const done = setTimeout(() => { setCrateIds(PROTO_RECORDS.map(r => r.id)); setPhase('done'); }, 2500);
    return () => { clearInterval(iv); clearTimeout(done); };
  }, [phase]);

  const run = () => { if (!handle) return; if (inputRef.current) inputRef.current.blur(); setPhase('loading'); };
  const enterApp = () => { setBooted(true); close(); showToast(`Imported ${total} records from @${handle || 'discogs'}`, <Ic.check size={15} />); };

  return (
    <div style={{ padding: '0 18px 4px' }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '2px 2px 16px' }}>
        <div style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--lime-dim)', border: '1px solid var(--lime-line)', display: 'grid', placeItems: 'center', color: 'var(--accent-text)', flex: '0 0 auto' }}>
          <Ic.import size={20} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 650, letterSpacing: '-0.01em' }}>Import from Discogs</div>
          <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 1 }}>Yours or anyone's public collection</div>
        </div>
        {phase === 'idle' && <Press onClick={close} className="vx-iconbtn"><Ic.x size={18} /></Press>}
      </div>

      {phase === 'idle' && (
        <div className="vp-fadeup">
          <div className="vp-input">
            <span className="vx-mono" style={{ fontSize: 13, color: 'var(--text-3)' }}>@</span>
            <input ref={inputRef} value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && run()} placeholder="Profile link or username" autoFocus />
            {url && <Press onClick={() => setUrl('')} style={{ color: 'var(--text-3)' }}><Ic.x size={16} /></Press>}
          </div>
          {handle ? (
            <div className="vx-mono" style={{ fontSize: 11.5, color: 'var(--accent-text)', margin: '9px 2px 0' }}>→ discogs.com/user/{handle}</div>
          ) : (
            <div style={{ display: 'flex', gap: 7, marginTop: 11, flexWrap: 'wrap' }}>
              {IMPORT_EXAMPLES.map(ex => (
                <Press key={ex} className="vx-chip vx-chip--mono" onClick={() => setUrl(ex)}>{ex}</Press>
              ))}
            </div>
          )}
          <p style={{ fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.5, margin: '16px 2px 0' }}>
            Vertax pulls every release — artist, label, catalog # and year — then matches BPM &amp; Camelot key automatically. Your collection stays on device.
          </p>
          <button className={'vx-btn tap ' + (handle ? 'vx-btn--primary' : 'vx-btn--dark')} style={{ marginTop: 18, opacity: handle ? 1 : 0.55 }} onClick={run}>
            <Ic.import size={19} c={handle ? 'var(--lime-ink)' : 'var(--text)'} />Import collection
          </button>
        </div>
      )}

      {phase === 'loading' && (
        <div className="vp-fadeup">
          <div className="vx-card vx-card-pad" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--card-2)', border: '1px solid var(--hair)', display: 'grid', placeItems: 'center', color: 'var(--accent-text)', flex: '0 0 auto' }}><Ic.user size={20} /></div>
            <div><div style={{ fontSize: 14.5, fontWeight: 600 }}>@{handle}</div><div className="vx-mono" style={{ fontSize: 11.5, color: 'var(--text-2)', marginTop: 1 }}>discogs.com/user/{handle}</div></div>
          </div>
          <div className="vx-card vx-card-pad vstack-16">
            {IMPORT_STEPS.map((s, i) => (
              <div key={i} className={'vp-step' + (i < step ? ' done' : i === step ? ' active' : '')}>
                <div className="vp-step-ic">{i < step ? <Ic.check size={13} /> : i === step ? <div className="vp-spinner" style={{ width: 13, height: 13, borderWidth: 1.5 }} /> : null}</div>
                {s}
              </div>
            ))}
          </div>
        </div>
      )}

      {phase === 'done' && (
        <div className="vp-fadeup" style={{ textAlign: 'center', paddingTop: 8 }}>
          <div className="vp-pop" style={{ width: 64, height: 64, borderRadius: 20, margin: '0 auto 16px', background: 'var(--lime-dim)', border: '1px solid var(--lime-line)', display: 'grid', placeItems: 'center', color: 'var(--accent-text)' }}>
            <Ic.check size={30} />
          </div>
          <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em' }}>Collection imported</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 0, margin: '18px 0 4px' }}>
            <div style={{ flex: 1 }}><div className="vx-bpm" style={{ fontSize: 26 }}>{total}</div><div className="label-mono" style={{ marginTop: 5 }}>Records</div></div>
            <div style={{ width: 1, background: 'var(--hair)', margin: '2px 0' }} />
            <div style={{ flex: 1 }}><div className="vx-bpm" style={{ fontSize: 26 }}>{labels}</div><div className="label-mono" style={{ marginTop: 5 }}>Labels</div></div>
            <div style={{ width: 1, background: 'var(--hair)', margin: '2px 0' }} />
            <div style={{ flex: 1 }}><div className="vx-bpm" style={{ fontSize: 26, color: 'var(--accent-text)' }}>{total}</div><div className="label-mono" style={{ marginTop: 5 }}>Analyzed</div></div>
          </div>
          <button className="vx-btn vx-btn--primary tap" style={{ marginTop: 20 }} onClick={enterApp}>Go to crate</button>
        </div>
      )}
    </div>
  );
}

SHEET_VIEWS.discogsImport = DiscogsImportSheet;
Object.assign(window, { DiscogsImportSheet, parseDiscogsHandle });
