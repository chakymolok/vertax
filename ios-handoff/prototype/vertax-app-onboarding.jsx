/* VERTAX iOS prototype — onboarding flow */

function VertaxMark({ size = 26 }) {
  return <div style={{ width: size, height: size, borderRadius: '50%', background: 'radial-gradient(circle at 50% 50%, var(--lime) 0 30%, #0c0f0e 31% 40%, var(--card-2) 41%)', border: '1px solid var(--hair)' }} />;
}

function HeroRecord({ size = 188 }) {
  return (
    <div style={{ width: size, height: size, display: 'grid', placeItems: 'center', position: 'relative' }}>
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: 'repeating-radial-gradient(circle at 50% 50%, #0c0f0e 0 2px, #14191a 2px 4.4px)',
        boxShadow: '0 18px 50px rgba(0,0,0,0.55), inset 0 0 0 1px var(--hair)',
        display: 'grid', placeItems: 'center',
      }}>
        <div style={{ width: size * 0.38, height: size * 0.38, borderRadius: '50%', background: 'var(--lime)', display: 'grid', placeItems: 'center', boxShadow: '0 0 26px color-mix(in srgb, var(--lime) 30%, transparent)' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--bg)' }} />
        </div>
        <div style={{ position: 'absolute', width: size * 0.7, height: size * 0.7, borderRadius: '50%', border: '1px solid var(--hair)' }} />
      </div>
    </div>
  );
}

function Onboarding({ onDone }) {
  const { showToast, openSheet } = useApp();
  const [step, setStep] = React.useState(0);

  const finish = (msg) => { showToast(msg, <Ic.check size={15} />); onDone(); };
  const doImport = () => openSheet('discogsImport');

  return (
    <div className="vp-layer" style={{ zIndex: 80, background: 'var(--bg)' }}>
      <StatusBar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '6px 28px 26px', minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <VertaxMark />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 15, letterSpacing: '0.04em' }}>VERTAX</span>
          <span className="label-mono" style={{ marginLeft: 'auto' }}>DIG·PLAY·SHARE</span>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 0 }} key={step} className="vp-fadeup">
          {step === 0 && (
            <div>
              <div style={{ display: 'grid', placeItems: 'center', marginBottom: 8 }}><HeroRecord /></div>
              <h1 style={{ fontSize: 27, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.08 }}>A smart crate for<br />vinyl DJs.</h1>
              <p style={{ fontSize: 14.5, color: 'var(--text-2)', lineHeight: 1.5, marginTop: 10 }}>
                Vertax knows your collection — what you own, what fits the record in your hand, and what to dig next.
              </p>
              <div className="vstack-12" style={{ marginTop: 22 }}>
                {[[Ic.find, 'Find BPM & Key', 'For any track, fast'],
                  [Ic.dig, 'Check if it fits', 'Before you buy the record'],
                  [Ic.build, 'Build harmonic sets', 'Compatible order by tempo & key']].map(([I, a, b], i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--card)', border: '1px solid var(--hair)', display: 'grid', placeItems: 'center', color: 'var(--accent-text)', flex: '0 0 auto' }}><I size={19} /></div>
                    <div><div style={{ fontSize: 14.5, fontWeight: 600 }}>{a}</div><div style={{ fontSize: 12, color: 'var(--text-2)' }}>{b}</div></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <div className="label-mono" style={{ color: 'var(--accent-text)' }}>THE SMART PART</div>
              <h1 style={{ fontSize: 25, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.12, marginTop: 8 }}>Math decides the fit.<br />Vertax explains it.</h1>
              <div className="vx-card vx-card-pad vp-pop" style={{ marginTop: 22, display: 'flex', alignItems: 'center', gap: 16 }}>
                <ScoreRing value={86} size={88} stroke={8} label="FIT" color="var(--lime)" />
                <div>
                  <span className="vx-verdict good"><span style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor' }} />Strong fit</span>
                  <div style={{ fontSize: 14, fontWeight: 600, marginTop: 9, lineHeight: 1.3 }}>Fills your 170–174&nbsp;/&nbsp;8A bridge.</div>
                </div>
              </div>
              <p style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.5, marginTop: 18 }}>
                Compatibility is real harmonic and tempo math against your own crate — not a guess. The verdict just puts it in plain words.
              </p>
            </div>
          )}

          {step === 2 && (
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.1 }}>Start your crate</h1>
              <p style={{ fontSize: 14, color: 'var(--text-2)', marginTop: 9, lineHeight: 1.45 }}>Bring your records in — or look around first with a demo.</p>
              <div className="vstack-12" style={{ marginTop: 22 }}>
                <Press className="vx-card vx-card-pad" onClick={doImport} style={{ display: 'flex', alignItems: 'center', gap: 13, borderColor: 'var(--lime-line)' }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--lime-dim)', border: '1px solid var(--lime-line)', display: 'grid', placeItems: 'center', color: 'var(--accent-text)', flex: '0 0 auto' }}>
                    <Ic.import size={20} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15.5, fontWeight: 650 }}>Import from Discogs</div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-2)' }}>Pull your whole collection</div>
                  </div>
                  <Ic.chevron size={18} c="var(--text-3)" />
                </Press>
                <Press className="vx-card vx-card-pad" onClick={() => finish('Empty crate created')} style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--card-2)', border: '1px solid var(--hair)', display: 'grid', placeItems: 'center', flex: '0 0 auto' }}><Ic.plus size={20} /></div>
                  <div style={{ flex: 1 }}><div style={{ fontSize: 15.5, fontWeight: 650 }}>Add a record manually</div><div style={{ fontSize: 12.5, color: 'var(--text-2)' }}>Start one sleeve at a time</div></div>
                  <Ic.chevron size={18} c="var(--text-3)" />
                </Press>
                <Press className="vx-card vx-card-pad" onClick={() => finish('Demo crate loaded · 12 records')} style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--card-2)', border: '1px solid var(--hair)', display: 'grid', placeItems: 'center', flex: '0 0 auto' }}><Ic.disc size={20} /></div>
                  <div style={{ flex: 1 }}><div style={{ fontSize: 15.5, fontWeight: 650 }}>Continue with demo</div><div style={{ fontSize: 12.5, color: 'var(--text-2)' }}>Explore with a sample collection</div></div>
                  <Ic.chevron size={18} c="var(--text-3)" />
                </Press>
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="vx-pagedots" style={{ marginBottom: 18 }}>
            {[0, 1, 2].map(i => <i key={i} className={i === step ? 'on' : ''} />)}
          </div>
          {step < 2
            ? <button className="vx-btn vx-btn--primary tap" onClick={() => setStep(step + 1)}>Continue</button>
            : <button className="vx-btn vx-btn--ghost tap" onClick={() => finish('Demo crate loaded · 12 records')}>Skip — just look around</button>}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Onboarding, VertaxMark, HeroRecord });
