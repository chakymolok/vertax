/* VERTAX iOS prototype — Build tab (set builder, drag-to-reorder) */

function GripIcon() {
  return <svg width="18" height="18" viewBox="0 0 18 18" fill="var(--text-3)"><circle cx="6" cy="4" r="1.3" /><circle cx="12" cy="4" r="1.3" /><circle cx="6" cy="9" r="1.3" /><circle cx="12" cy="9" r="1.3" /><circle cx="6" cy="14" r="1.3" /><circle cx="12" cy="14" r="1.3" /></svg>;
}

function BuildScreen() {
  const { setIds, setSetIds, recordById, addToSet, removeFromSet, pushView, showToast, startLive } = useApp();
  const records = setIds.map(recordById).filter(Boolean);
  const listRef = React.useRef(null);

  const bpms = records.map(r => r.bpm);
  const minB = bpms.length ? Math.min(...bpms) : 0;
  const maxB = bpms.length ? Math.max(...bpms) : 0;
  let good = 0;
  for (let i = 1; i < records.length; i++) if (transition(records[i - 1], records[i]).tone === 'good') good++;
  const harmonicPct = records.length > 1 ? Math.round((good / (records.length - 1)) * 100) : 100;
  const mins = Math.round(records.length * 4.1);

  // suggested next
  const last = records[records.length - 1];
  const suggestion = React.useMemo(() => {
    const cands = PROTO_RECORDS.filter(r => !setIds.includes(r.id));
    if (!last) return cands[0];
    return cands.map(c => ({ c, tr: transition(last, c) }))
      .sort((a, b) => (a.tr.tone === 'good' ? 0 : 1) - (b.tr.tone === 'good' ? 0 : 1) || Math.abs(a.tr.db) - Math.abs(b.tr.db))[0];
  }, [setIds, last]);

  const onGrip = (e, index) => {
    e.preventDefault(); e.stopPropagation();
    const slots = Array.from(listRef.current.querySelectorAll('[data-row]'));
    if (!slots.length) return;
    const H = slots[0].offsetHeight + 10;
    const startY = e.clientY;
    const dragged = slots[index];
    dragged.classList.add('dragging');
    dragged.style.transition = 'none';
    let target = index;
    const move = (ev) => {
      const dy = ev.clientY - startY;
      dragged.style.transform = `translateY(${dy}px)`;
      target = Math.max(0, Math.min(slots.length - 1, index + Math.round(dy / H)));
      slots.forEach((el, j) => {
        if (j === index) return;
        let shift = 0;
        if (index < target && j > index && j <= target) shift = -H;
        else if (index > target && j < index && j >= target) shift = H;
        el.style.transition = 'transform .18s cubic-bezier(.32,.72,0,1)';
        el.style.transform = `translateY(${shift}px)`;
      });
    };
    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      slots.forEach(el => { el.style.transition = 'none'; el.style.transform = ''; });
      dragged.classList.remove('dragging');
      if (target !== index) {
        const arr = setIds.slice();
        const [m] = arr.splice(index, 1);
        arr.splice(target, 0, m);
        setSetIds(arr);
        showToast('Reordered', <Ic.check size={15} />);
      }
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  };

  return (
    <>
      <div className="vx-nav">
        <div>
          <div className="vx-nav-kicker">SET · {records.length} RECORDS · ~{mins} MIN</div>
          <div className="vx-title">Warehouse</div>
        </div>
        <div className="vx-nav-actions">
          <Press className="vx-iconbtn" onClick={() => showToast('Shuffled by best flow')}><Ic.shuffle size={18} /></Press>
          <button className="vx-btn vx-btn--sm vx-btn--primary tap" onClick={() => startLive('set')}><Ic.play size={15} c="var(--lime-ink)" />Start Live</button>
        </div>
      </div>

      <div style={{ padding: '0 var(--pad)' }}>
        <div className="vx-card vx-card-pad" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div className="label-mono">Tempo flow</div>
            <div className="vx-bpm" style={{ fontSize: 18, marginTop: 5 }}>{minB}<span style={{ color: 'var(--text-3)', margin: '0 4px' }}>→</span>{maxB}</div>
          </div>
          <Wave n={28} seed={7} height={28} className="lime" />
          <div style={{ textAlign: 'right' }}>
            <div className="label-mono">Harmonic</div>
            <div className="vx-bpm" style={{ fontSize: 18, marginTop: 5, color: harmonicPct >= 80 ? 'var(--accent-text)' : 'var(--amber)' }}>{harmonicPct}%</div>
          </div>
        </div>
      </div>

      <div className="vp-scroll" style={{ padding: '0 var(--pad)', marginTop: 4 }}>
        <div className="vx-sectionhead" style={{ marginTop: 14, marginBottom: 8 }}>
          <h3 style={{ fontSize: 13.5, color: 'var(--text-2)', fontWeight: 600 }}>ORDER</h3>
          <span className="count">drag the handle</span>
        </div>

        <div ref={listRef} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {records.map((r, i) => {
            const tr = i > 0 ? transition(records[i - 1], r) : null;
            return (
              <div key={r.id} data-row className="vp-drag-item">
                <div className="vx-card" style={{ display: 'flex', alignItems: 'center', gap: 11, padding: 9 }}>
                  <span className="vx-bpm" style={{ fontSize: 13, color: 'var(--text-3)', width: 15, textAlign: 'center' }}>{i + 1}</span>
                  <Press onClick={() => pushView('release', { id: r.id })} style={{ display: 'flex', alignItems: 'center', gap: 11, flex: 1, minWidth: 0 }}>
                    <Cover seed={r.seed} cat={r.cat} size={42} />
                    <div className="vx-trow-main">
                      <div className="vx-trow-title" style={{ fontSize: 14.5 }}>{r.artist} — {r.title}</div>
                      <div className="vx-trow-sub" style={{ color: tr ? (tr.tone === 'warn' ? 'var(--amber)' : 'var(--accent-text)') : 'var(--text-2)' }}>
                        {tr ? tr.text : 'Opener · first record'}
                      </div>
                    </div>
                  </Press>
                  <div className="vx-trow-meta" style={{ gap: 8 }}>
                    <span className="vx-bpm" style={{ fontSize: 14 }}>{r.bpm}</span>
                    <span className={'vx-key' + (r.key === '8A' ? ' vx-key--lime' : '')}>{r.key}</span>
                    <div onPointerDown={(e) => onGrip(e, i)} style={{ padding: '6px 2px 6px 6px', cursor: 'grab', touchAction: 'none' }}><GripIcon /></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {suggestion && (
          <>
            <div className="vx-sectionhead"><h3>Suggested next</h3><span className="more">Vertax pick</span></div>
            <div className="vx-card vx-card-pad vp-fadeup" style={{ display: 'flex', alignItems: 'center', gap: 12, border: '1px solid var(--lime-line)' }}>
              <Cover seed={(suggestion.c || suggestion).seed} cat={(suggestion.c || suggestion).cat} size={44} />
              <div className="vx-trow-main">
                <div className="vx-trow-title" style={{ fontSize: 14.5 }}>{(suggestion.c || suggestion).artist} — {(suggestion.c || suggestion).title}</div>
                <div className="vx-trow-sub" style={{ color: suggestion.tr ? (suggestion.tr.tone === 'warn' ? 'var(--amber)' : 'var(--accent-text)') : 'var(--text-2)' }}>
                  {suggestion.tr ? suggestion.tr.text : 'Compatible opener'}
                </div>
              </div>
              <Press className="vx-iconbtn" onClick={() => { addToSet((suggestion.c || suggestion).id); showToast('Added to set', <Ic.check size={15} />); }}
                style={{ background: 'var(--lime)', borderColor: 'var(--lime)', color: 'var(--lime-ink)' }}><Ic.plus size={19} /></Press>
            </div>
          </>
        )}
        <div style={{ height: 12 }} />
      </div>

      <AppTabBar />
    </>
  );
}

TAB_VIEWS.build = BuildScreen;
Object.assign(window, { BuildScreen });
