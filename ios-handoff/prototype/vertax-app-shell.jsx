/* VERTAX iOS prototype — shell: context, scaling, navigation, hosts */

const AppCtx = React.createContext(null);
const useApp = () => React.useContext(AppCtx);

/* tap-scale pressable wrapper */
function Press({ as = 'div', className = '', onClick, children, style, ...rest }) {
  const El = as;
  return <El className={'tap ' + className} onClick={onClick} style={style} {...rest}>{children}</El>;
}

/* interactive bottom tab bar */
function AppTabBar() {
  const { tab, setTab } = useApp();
  const tabs = [['crate', 'Crate', Ic.crate], ['find', 'Find', Ic.find], ['build', 'Build', Ic.build], ['dig', 'Dig', Ic.dig]];
  return (
    <div className="vx-tabbar">
      {tabs.map(([id, label, Icon]) => (
        <Press key={id} className={'vx-tab' + (tab === id ? ' on' : '')} onClick={() => setTab(id)}>
          <Icon size={25} sw={tab === id ? 2 : 1.7} />
          <span className="tl">{label}</span>
        </Press>
      ))}
      <div className="vx-home-ind" />
    </div>
  );
}

/* push layer (right-to-left), self-managing enter/exit */
function PushLayer({ entry, onClosed }) {
  const [on, setOn] = React.useState(false);
  React.useEffect(() => { const r = requestAnimationFrame(() => setOn(true)); const t = setTimeout(() => setOn(true), 24); return () => { cancelAnimationFrame(r); clearTimeout(t); }; }, []);
  const close = React.useCallback(() => { setOn(false); setTimeout(onClosed, 340); }, [onClosed]);
  const View = PUSH_VIEWS[entry.type];
  return (
    <div className={'vp-layer vp-push vp-push--anim ' + (on ? 'on' : 'off')}>
      <StatusBar />
      {View ? <View {...entry.props} back={close} /> : null}
    </div>
  );
}

/* bottom sheet */
function SheetHost({ entry, onClosed }) {
  const [on, setOn] = React.useState(false);
  React.useEffect(() => { const r = requestAnimationFrame(() => setOn(true)); const t = setTimeout(() => setOn(true), 24); return () => { cancelAnimationFrame(r); clearTimeout(t); }; }, []);
  const close = React.useCallback(() => { setOn(false); setTimeout(onClosed, 360); }, [onClosed]);
  const View = SHEET_VIEWS[entry.type];
  return (
    <>
      <div className={'vp-backdrop' + (on ? ' on' : '')} onClick={close} />
      <div className={'vp-sheet' + (on ? ' on' : '')}>
        <div className="vp-sheet-grab" />
        {View ? <View {...entry.props} close={close} /> : null}
      </div>
    </>
  );
}

const PUSH_VIEWS = {};
const SHEET_VIEWS = {};

/* the App */
function App() {
  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    accent: '#C8FF2E',
    radius: 22,
    theme: 'dark',
    density: 'cozy',
  }/*EDITMODE-END*/;
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  const [booted, setBooted] = React.useState(false);
  const [tab, setTab] = React.useState('crate');
  const [push, setPush] = React.useState(null);      // {type, props}
  const [sheet, setSheet] = React.useState(null);
  const [toast, setToast] = React.useState(null);
  const toastTimer = React.useRef(0);

  // shared collection state
  const [crateIds, setCrateIds] = React.useState(() => PROTO_RECORDS.map(r => r.id));
  const [setIds, setSetIds] = React.useState(['r3', 'r1', 'r11', 'r5']);
  const [live, setLive] = React.useState(null); // {mode:'set'|'freestyle'}

  const showToast = React.useCallback((msg, icon) => {
    clearTimeout(toastTimer.current);
    setToast({ msg, icon });
    toastTimer.current = setTimeout(() => setToast(null), 2100);
  }, []);

  const recordById = React.useCallback((id) => PROTO_RECORDS.find(r => r.id === id), []);

  const api = {
    t, setTweak,
    tab, setTab: (x) => { setTab(x); },
    pushView: (type, props) => setPush({ type, props }),
    openSheet: (type, props) => setSheet({ type, props }),
    closeSheet: () => setSheet(null),
    showToast,
    crateIds, setCrateIds,
    addToCrate: (id) => setCrateIds(ids => ids.includes(id) ? ids : [id, ...ids]),
    setIds, setSetIds,
    addToSet: (id) => setSetIds(ids => ids.includes(id) ? ids : [...ids, id]),
    removeFromSet: (id) => setSetIds(ids => ids.filter(x => x !== id)),
    recordById,
    live, startLive: (mode = 'set') => setLive({ mode }), endLive: () => setLive(null),
    booted, setBooted,
  };

  // stage scaling
  const [scale, setScale] = React.useState(1);
  React.useEffect(() => {
    const fit = () => {
      const vw = window.innerWidth, vh = window.innerHeight;
      setScale(Math.min((vw - 24) / 414, (vh - 24) / 868, 1.18));
    };
    fit(); window.addEventListener('resize', fit); return () => window.removeEventListener('resize', fit);
  }, []);

  const Tab = TAB_VIEWS[tab];
  const accentDark = t.theme === 'dark';

  return (
    <AppCtx.Provider value={api}>
      <div className="vp-stage" data-stagetheme={accentDark ? 'dark' : 'light'}>
        <div className="vp-scaler" style={{ transform: `scale(${scale})` }}>
          <div className="vx-phone">
            <div className="vx-screen" data-dir="a" data-theme={t.theme} data-density={t.density}
              style={{ '--lime': t.accent, '--lime-line': 'color-mix(in srgb, ' + t.accent + ' 38%, transparent)', '--lime-dim': 'color-mix(in srgb, ' + t.accent + ' 14%, transparent)', '--r-card': t.radius + 'px' }}>

              {/* base tab layer */}
              <div className="vp-layer">
                <StatusBar />
                {Tab ? <Tab /> : null}
              </div>

              {/* push */}
              {push && <PushLayer entry={push} onClosed={() => setPush(null)} />}

              {/* sheet */}
              {sheet && <SheetHost entry={sheet} onClosed={() => setSheet(null)} />}

              {/* toast */}
              {toast && (
                <div className={'vp-toast on'}>
                  {toast.icon ? <span style={{ color: 'var(--accent-text)' }}>{toast.icon}</span> : null}
                  {toast.msg}
                </div>
              )}

              {/* onboarding overlay */}
              {!booted && <Onboarding onDone={() => setBooted(true)} />}

              {/* live set mode — fullscreen overlay */}
              {live && <LiveSet mode={live.mode} />}
            </div>
          </div>
        </div>
      </div>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Brand" />
        <TweakColor label="Accent" value={t.accent}
          options={['#C8FF2E', '#67D4E6', '#E8B15F', '#E58FB0', '#9CA8FF']}
          onChange={(v) => setTweak('accent', v)} />
        <TweakSection label="Surface" />
        <TweakRadio label="Theme" value={t.theme} options={['dark', 'light']} onChange={(v) => setTweak('theme', v)} />
        <TweakRadio label="Density" value={t.density} options={['compact', 'cozy', 'roomy']} onChange={(v) => setTweak('density', v)} />
        <TweakSlider label="Corner radius" value={t.radius} min={10} max={30} step={2} unit="px" onChange={(v) => setTweak('radius', v)} />
      </TweaksPanel>
    </AppCtx.Provider>
  );
}

const TAB_VIEWS = {};

Object.assign(window, { AppCtx, useApp, Press, AppTabBar, App, PUSH_VIEWS, SHEET_VIEWS, TAB_VIEWS });
