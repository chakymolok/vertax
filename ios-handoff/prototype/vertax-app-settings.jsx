/* VERTAX iOS prototype — Settings sheet (appearance, language, privacy, data, about) */

const ACCENTS = [['#C8FF2E', 'Lime'], ['#67D4E6', 'Cyan'], ['#E8B15F', 'Amber'], ['#E58FB0', 'Rose'], ['#9CA8FF', 'Indigo']];
const LANGS = [['en', 'English'], ['ru', 'Русский'], ['de', 'Deutsch'], ['es', 'Español']];

/* small iOS-style switch */
function VxSwitch({ on, onToggle }) {
  return (
    <Press onClick={onToggle} style={{ width: 46, height: 28, borderRadius: 999, padding: 3, flex: '0 0 auto',
      background: on ? 'var(--lime)' : 'var(--card-2)', border: '1px solid ' + (on ? 'var(--lime)' : 'var(--hair-2)'),
      display: 'flex', justifyContent: on ? 'flex-end' : 'flex-start', transition: 'background .2s, justify-content .2s' }}>
      <span style={{ width: 22, height: 22, borderRadius: '50%', background: on ? 'var(--lime-ink)' : '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.35)', transition: 'all .2s' }} />
    </Press>
  );
}

function SettingsGroup({ title, children }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div className="label-mono" style={{ margin: '0 4px 8px' }}>{title}</div>
      <div className="vx-card" style={{ padding: '2px 14px' }}>{children}</div>
    </div>
  );
}
function SettingsRow({ icon, label, sub, right, onClick, last, danger }) {
  return (
    <Press onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 0', borderBottom: last ? 'none' : '1px solid var(--hair)', cursor: onClick ? 'pointer' : 'default' }}>
      {icon && <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--card-2)', border: '1px solid var(--hair)', display: 'grid', placeItems: 'center', color: danger ? 'var(--amber)' : 'var(--text)', flex: '0 0 auto' }}>{icon}</div>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 550, color: danger ? 'var(--amber)' : 'var(--text)' }}>{label}</div>
        {sub && <div style={{ fontSize: 11.5, color: 'var(--text-2)', marginTop: 1 }}>{sub}</div>}
      </div>
      {right}
    </Press>
  );
}

function SettingsSheet({ close }) {
  const { t, setTweak, showToast, openSheet } = useApp();
  const [lang, setLang] = React.useState(() => localStorage.getItem('vx_lang') || 'en');
  const [view, setView] = React.useState('root'); // root | language | about
  const [privacy, setPrivacy] = React.useState({ onDevice: true, analytics: false, crash: true });

  const pickLang = (code) => { setLang(code); localStorage.setItem('vx_lang', code); setView('root'); showToast('Language: ' + LANGS.find(l => l[0] === code)[1], <Ic.check size={15} />); };

  if (view === 'language') {
    return (
      <div style={{ padding: '0 18px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 0 14px' }}>
          <Press className="vx-iconbtn" onClick={() => setView('root')}><Ic.back size={18} /></Press>
          <div style={{ fontSize: 17, fontWeight: 650 }}>Language</div>
        </div>
        <div className="vx-card" style={{ padding: '2px 14px' }}>
          {LANGS.map(([code, name], i) => (
            <SettingsRow key={code} label={name} last={i === LANGS.length - 1} onClick={() => pickLang(code)}
              right={lang === code ? <Ic.check size={18} c="var(--accent-text)" /> : null} />
          ))}
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '12px 4px 0', lineHeight: 1.5 }}>Full interface localization ships at build time — Vertax is structured for it. BPM, Camelot and catalog data stay language-neutral.</p>
      </div>
    );
  }

  if (view === 'about') {
    return (
      <div style={{ padding: '0 18px 8px', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 0 14px', textAlign: 'left' }}>
          <Press className="vx-iconbtn" onClick={() => setView('root')}><Ic.back size={18} /></Press>
          <div style={{ fontSize: 17, fontWeight: 650 }}>About</div>
        </div>
        <div style={{ width: 56, height: 56, borderRadius: '50%', margin: '14px auto 0', background: 'radial-gradient(circle at 50% 50%, var(--lime) 0 30%, #0c0f0e 31% 40%, var(--card-2) 41%)', border: '1px solid var(--hair)' }} />
        <div className="vx-mono" style={{ fontSize: 16, letterSpacing: '0.06em', marginTop: 14 }}>VERTAX</div>
        <div className="label-mono" style={{ marginTop: 5 }}>DIG · PLAY · SHARE</div>
        <div style={{ fontSize: 13, color: 'var(--text-2)', margin: '14px auto 0', maxWidth: 270, lineHeight: 1.5 }}>A smart crate assistant for vinyl DJs. Know what you own, what fits, and what to dig next.</div>
        <div className="vx-mono" style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 16 }}>Version 1.0 · build 100</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button className="vx-btn vx-btn--dark tap" onClick={() => showToast('Opened vertax.live')}>Website</button>
          <button className="vx-btn vx-btn--dark tap" onClick={() => showToast('Opened changelog')}>Changelog</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '0 18px 16px', maxHeight: '76vh', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 2px 4px' }}>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>Settings</div>
        <Press className="vx-iconbtn" onClick={close}><Ic.x size={18} /></Press>
      </div>

      {/* APPEARANCE */}
      <SettingsGroup title="APPEARANCE">
        <div style={{ padding: '13px 0', borderBottom: '1px solid var(--hair)' }}>
          <div style={{ fontSize: 14.5, fontWeight: 550, marginBottom: 11 }}>Accent</div>
          <div style={{ display: 'flex', gap: 11 }}>
            {ACCENTS.map(([hex, name]) => (
              <Press key={hex} onClick={() => { setTweak('accent', hex); showToast(name + ' accent'); }} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 34, height: 34, borderRadius: '50%', background: hex, border: t.accent === hex ? '2px solid #fff' : '2px solid transparent', boxShadow: t.accent === hex ? '0 0 0 1px ' + hex : 'none' }} />
                <span style={{ fontSize: 9.5, color: t.accent === hex ? 'var(--text)' : 'var(--text-3)', fontFamily: 'var(--mono)' }}>{name}</span>
              </Press>
            ))}
          </div>
        </div>
        <div style={{ padding: '13px 0', borderBottom: '1px solid var(--hair)' }}>
          <div className="spread"><span style={{ fontSize: 14.5, fontWeight: 550 }}>Theme</span></div>
          <div className="vx-seg" style={{ marginTop: 10 }}>
            {[['dark', 'Dark'], ['light', 'Light']].map(([v, l]) => (
              <button key={v} className={t.theme === v ? 'on' : ''} onClick={() => setTweak('theme', v)}>{l}</button>
            ))}
          </div>
        </div>
        <div style={{ padding: '13px 0' }}>
          <div className="spread"><span style={{ fontSize: 14.5, fontWeight: 550 }}>Density</span></div>
          <div className="vx-seg" style={{ marginTop: 10 }}>
            {[['compact', 'Compact'], ['cozy', 'Cozy'], ['roomy', 'Roomy']].map(([v, l]) => (
              <button key={v} className={t.density === v ? 'on' : ''} onClick={() => setTweak('density', v)}>{l}</button>
            ))}
          </div>
        </div>
      </SettingsGroup>

      {/* GENERAL */}
      <SettingsGroup title="GENERAL">
        <SettingsRow icon={<Ic.tag size={16} />} label="Language" sub={LANGS.find(l => l[0] === lang)[1]} onClick={() => setView('language')} right={<Ic.chevron size={17} c="var(--text-3)" />} />
        <SettingsRow icon={<Ic.disc size={16} />} label="Default BPM range" sub="168–176 · DnB" last right={<Ic.chevron size={17} c="var(--text-3)" />} onClick={() => showToast('Tempo preferences')} />
      </SettingsGroup>

      {/* DATA */}
      <SettingsGroup title="COLLECTION & DATA">
        <SettingsRow icon={<Ic.import size={16} />} label="Import from Discogs" sub="Re-sync or add a collection" onClick={() => openSheet('discogsImport')} right={<Ic.chevron size={17} c="var(--text-3)" />} />
        <SettingsRow icon={<Ic.arrowUp size={16} />} label="Export collection" sub="Save crate.json to Files" onClick={() => showToast('Exported crate.json to Files', <Ic.check size={15} />)} right={<Ic.chevron size={17} c="var(--text-3)" />} />
        <SettingsRow icon={<Ic.layers size={16} />} label="Backup sets & history" sub="On-device · last: today" last onClick={() => showToast('Backup created')} right={<Ic.chevron size={17} c="var(--text-3)" />} />
      </SettingsGroup>

      {/* PRIVACY */}
      <SettingsGroup title="PRIVACY">
        <SettingsRow label="Keep collection on device" sub="No cloud sync" right={<VxSwitch on={privacy.onDevice} onToggle={() => setPrivacy(p => ({ ...p, onDevice: !p.onDevice }))} />} />
        <SettingsRow label="Anonymous analytics" sub="Help improve Vertax" right={<VxSwitch on={privacy.analytics} onToggle={() => setPrivacy(p => ({ ...p, analytics: !p.analytics }))} />} />
        <SettingsRow label="Crash reports" last right={<VxSwitch on={privacy.crash} onToggle={() => setPrivacy(p => ({ ...p, crash: !p.crash }))} />} />
      </SettingsGroup>

      {/* SUPPORT */}
      <SettingsGroup title="SUPPORT">
        <SettingsRow icon={<Ic.heart size={16} />} label="Support the author" sub="Tip to keep Vertax independent" danger onClick={() => showToast('💚 Thank you for supporting Vertax')} right={<Ic.chevron size={17} c="var(--amber)" />} />
        <SettingsRow icon={<Ic.disc size={16} />} label="About Vertax" sub="Version 1.0" last onClick={() => setView('about')} right={<Ic.chevron size={17} c="var(--text-3)" />} />
      </SettingsGroup>

      <div style={{ height: 8 }} />
    </div>
  );
}

SHEET_VIEWS.settings = SettingsSheet;
Object.assign(window, { SettingsSheet, VxSwitch });
