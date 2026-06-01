/* VERTAX iOS prototype — data + harmonic helpers. Exports to window. */

/* Camelot helpers */
const CAMELOT_KEY = {
  '8A': 'A min', '8B': 'C maj', '9A': 'E min', '9B': 'G maj', '7A': 'D min', '7B': 'F maj',
  '4A': 'F min', '4B': 'Ab maj', '10A': 'B min', '10B': 'D maj', '5A': 'C min', '11A': 'F# min',
  '6A': 'G min', '3A': 'Bb min', '12A': 'Db min', '1A': 'Ab min', '2A': 'Eb min',
};
function camParse(k) { const m = String(k).match(/^(\d+)([AB])$/); return m ? { n: +m[1], l: m[2] } : { n: 0, l: 'A' }; }
function camHarmonic(a, b) {
  const x = camParse(a), y = camParse(b);
  if (x.n === y.n && x.l === y.l) return 'same';           // perfect
  if (x.n === y.n && x.l !== y.l) return 'rel';            // relative major/minor
  const d = Math.min((x.n - y.n + 12) % 12, (y.n - x.n + 12) % 12);
  if (x.l === y.l && d === 1) return 'adj';                // ±1 same letter
  return null;
}
/* transition quality between two records for Build flow */
function transition(a, b) {
  const h = camHarmonic(a.key, b.key);
  const db = b.bpm - a.bpm;
  const adb = Math.abs(db);
  let tone = 'good', text;
  if (h === 'same') text = 'Same key · seamless';
  else if (h === 'adj') text = (camParse(b.key).n > camParse(a.key).n ? '+1 · energy lift' : '−1 · cooldown');
  else if (h === 'rel') text = 'Relative · mood shift';
  else { tone = 'warn'; text = 'Key clash — mix carefully'; }
  if (adb >= 4 && tone === 'good') { tone = 'warn'; text = (db > 0 ? '+' : '−') + adb + ' BPM jump'; }
  else if (adb >= 1) text += ' · ' + (db > 0 ? '+' : '−') + adb + ' BPM';
  return { tone, text, db, h };
}

const PROTO_RECORDS = [
  { id: 'r1', artist: 'Hidden Tide', title: 'Glasshouse', label: 'Driftwax', cat: 'DWX014', yr: '2023', bpm: 172, key: '8A', genre: 'Deep DnB', rating: 4.6, played: true, seed: 'glasshouse', notes: 'Warm pad intro, long mixable outro. Goes early-set.' },
  { id: 'r2', artist: 'Mvson', title: 'Low Ceiling', label: 'Cold Signal', cat: 'CSL008', yr: '2022', bpm: 174, key: '9A', genre: 'Jungle', rating: 4.8, played: true, seed: 'lowceiling', notes: 'Chopped amen, heavy sub. Peak-time roller.' },
  { id: 'r3', artist: 'Aether Loop', title: 'Saltmarsh', label: 'Pale Blue', cat: 'PBR003', yr: '2024', bpm: 170, key: '8A', genre: 'Atmospheric', rating: 4.4, played: false, seed: 'saltmarsh', notes: 'Field-recording textures. Beautiful opener.' },
  { id: 'r4', artist: 'Bauri', title: 'Quiet Storm — VIP', label: 'Inner Tape', cat: 'INT021', yr: '2021', bpm: 168, key: '7A', genre: 'Liquid', rating: 4.2, played: true, seed: 'quietstorm', notes: 'Rolling liquid. Smooth 7A exit.' },
  { id: 'r5', artist: 'Komatic', title: 'Northwall', label: 'Halftone', cat: 'HLF005', yr: '2023', bpm: 174, key: '9A', genre: 'UK Bass', rating: 4.5, played: false, seed: 'northwall', notes: 'Half-step pressure. Crowd mover.' },
  { id: 'r6', artist: 'Senan', title: 'Driftwood Dub', label: 'Bunker Dub', cat: 'BNK012', yr: '2020', bpm: 86, key: '4A', genre: 'Halftime', rating: 4.0, played: true, seed: 'driftwood', notes: 'Halftime dub weight. Great curveball.' },
  { id: 'r7', artist: 'Pylon Field', title: 'Marsh Lights', label: 'Driftwax', cat: 'DWX017', yr: '2024', bpm: 172, key: '8B', genre: 'Atmospheric', rating: 4.3, played: false, seed: 'marshlights', notes: 'Major-key lift. Bridges into brighter sets.' },
  { id: 'r8', artist: 'Orla Vance', title: 'Tin Roof', label: 'Cold Signal', cat: 'CSL011', yr: '2023', bpm: 170, key: '7A', genre: 'Liquid', rating: 4.1, played: true, seed: 'tinroof', notes: 'Soulful vocal chop, deep bed.' },
  { id: 'r9', artist: 'Dovetail', title: 'Undertow', label: 'Pale Blue', cat: 'PBR006', yr: '2022', bpm: 174, key: '10A', genre: 'Roller', rating: 4.7, played: false, seed: 'undertow', notes: 'Tech roller, minimal. Glue track.' },
  { id: 'r10', artist: 'Mvson', title: 'Cassette Ghost', label: 'Inner Tape', cat: 'INT024', yr: '2024', bpm: 176, key: '9A', genre: 'Jungle', rating: 4.5, played: false, seed: 'cassetteghost', notes: 'Lo-fi breaks, tape hiss. Energetic.' },
  { id: 'r11', artist: 'Kasm', title: 'Beacon', label: 'Halftone', cat: 'HLF008', yr: '2023', bpm: 172, key: '8A', genre: 'Deep DnB', rating: 4.4, played: true, seed: 'beacon', notes: 'Deep roller, sits in your 8A core.' },
  { id: 'r12', artist: 'Wren', title: 'Coldwater', label: 'Bunker Dub', cat: 'BNK015', yr: '2021', bpm: 88, key: '5A', genre: 'Halftime', rating: 3.9, played: false, seed: 'coldwater', notes: 'Spacious halftime. Set reset.' },
];

const GENRES = ['Deep DnB', 'Jungle', 'Atmospheric', 'Liquid', 'UK Bass', 'Halftime', 'Roller'];
const KEYS = ['7A', '8A', '8B', '9A', '10A', '4A', '5A'];

/* Find database — searchable lookups for the Find tab */
const FIND_DB = [
  { q: ['phari', 'halflight', 'prx114'], artist: 'Nilo Reign', title: 'Halflight', label: 'Proxima', cat: 'PRX114', bpm: 172, key: '8A', mkey: 'A min', genre: 'Deep DnB', conf: 96, source: 'Beatport' },
  { q: ['komatic', 'northwall', 'hlf005'], artist: 'Komatic', title: 'Northwall', label: 'Halftone', cat: 'HLF005', bpm: 174, key: '9A', mkey: 'E min', genre: 'UK Bass', conf: 92, source: 'GetSongBPM' },
  { q: ['senan', 'driftwood', 'bnk012'], artist: 'Senan', title: 'Driftwood Dub', label: 'Bunker Dub', cat: 'BNK012', bpm: 86, key: '4A', mkey: 'F min', genre: 'Halftime', conf: 81, source: 'AcousticBrainz' },
  { q: ['dovetail', 'undertow', 'pbr006'], artist: 'Dovetail', title: 'Undertow', label: 'Pale Blue', cat: 'PBR006', bpm: 174, key: '10A', mkey: 'B min', genre: 'Roller', conf: 94, source: 'Beatport' },
];

/* Analyze target releases */
const ANALYZE_TARGETS = [
  { id: 'a1', artist: 'Nilo Reign', title: 'Halflight', label: 'Proxima', cat: 'PRX114', bpm: 172, key: '8A', genre: 'Deep DnB', seed: 'halflight', rating: 4.7, haves: 142, score: 86, verdict: 'good', tracks: [['A1', 'Halflight', 172, '8A'], ['B1', 'Afterglow', 170, '8A']] },
  { id: 'a2', artist: 'Sub Theory', title: 'Dry Season', label: 'Format', cat: 'FMT202', bpm: 140, key: '11A', genre: 'Techno', seed: 'dryseason', rating: 4.1, haves: 88, score: 48, verdict: 'partial', tracks: [['A', 'Dry Season', 140, '11A']] },
];

Object.assign(window, { CAMELOT_KEY, camParse, camHarmonic, transition, PROTO_RECORDS, GENRES, KEYS, FIND_DB, ANALYZE_TARGETS });
