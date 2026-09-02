import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const publicDir = resolve('public');
const mime = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

function staticFilePath(requestUrl) {
  const url = new URL(requestUrl, 'http://127.0.0.1');
  let pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith('/')) pathname += 'index.html';
  const file = normalize(join(publicDir, pathname));
  if (!file.startsWith(publicDir)) return null;
  return file;
}

const server = createServer((req, res) => {
  const file = staticFilePath(req.url || '/');
  if (!file || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('not found');
    return;
  }
  res.writeHead(200, {
    'Content-Type': mime[extname(file)] || 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  createReadStream(file).pipe(res);
});

await new Promise((resolveServer) => server.listen(0, '127.0.0.1', resolveServer));
const { port } = server.address();
const url = `http://127.0.0.1:${port}/`;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];

page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', (err) => {
  errors.push(err.message);
});

await page.addInitScript(() => {
  window.Telegram = { WebApp: { initData: '', ready: () => {} } };
  window.WebApp = { initData: '', ready: () => {} };
});

await page.route('**/*', async (route) => {
  const requestUrl = route.request().url();
  if (requestUrl.startsWith(url)) return route.continue();
  return route.fulfill({ status: 204, body: '' });
});

await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(
  () => window.laisoBuck && window.laisoBuck.state && window.laisoBuck.render
);
await page.waitForFunction(() => window.dbInstance !== null || window.db !== undefined);

assert.equal(await page.locator('#laiso-app').count(), 1, '#laiso-app should exist');
assert.equal(
  await page.evaluate(() => !!(window.db || window.dbInstance)),
  true,
  'IndexedDB should initialize'
);

async function assertSingleFooter() {
  assert.equal(
    await page.locator('.vertax-global-footer').count(),
    1,
    'Global BPM/KEY footer should render exactly once'
  );
  assert.equal(
    await page.locator('.laiso-footer').count(),
    0,
    'Legacy in-view footer should not be rendered'
  );
}

async function renderView(view) {
  await page.evaluate((nextView) => {
    window.laisoBuck.state.view = nextView;
    window.laisoBuck.render();
  }, view);
  await page.locator('#laiso-root').waitFor({ state: 'visible' });
  const html = await page.locator('#laiso-root').innerHTML();
  assert.ok(html.trim().length > 0, `${view} should render non-empty HTML`);
  await assertSingleFooter();
  return html;
}

await renderView('home');
assert.equal(
  await page.evaluate(() => document.body.dataset.vertaxView),
  'home',
  'Rendered view should be exposed to the responsive shell'
);
await page.locator('[data-action="theme-toggle"]').click();
await page.waitForFunction(() => document.body.classList.contains('vertax-theme-dark'));
assert.equal(
  await page.evaluate(() => localStorage.getItem('vertax-theme')),
  'dark',
  'Theme toggle should persist Graphite Night'
);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForFunction(
  () => window.laisoBuck && window.laisoBuck.state && window.laisoBuck.render
);
assert.equal(
  await page.evaluate(() => document.body.classList.contains('vertax-theme-dark')),
  true,
  'Graphite Night should survive reload'
);
await page.locator('[data-action="theme-toggle"]').click();
await page.waitForFunction(() => document.body.classList.contains('vertax-theme-light'));
await renderView('collection');
const setHtml = await renderView('set');
assert.ok(setHtml.trim().length > 0, 'viewSet should return non-empty HTML');
await renderView('backup');

await page.evaluate(() => {
  window.laisoBuck.state.ui.generatedSet = [
    {
      id: 'track-1',
      recordId: 'vinyl-1',
      title: 'Smoke Track',
      bpm: 120,
      key: 'A minor',
      camelot: '8A',
      vinylTitle: 'Smoke Record',
      vinylArtist: 'Smoke Artist',
      displayPosition: 'A1',
    },
  ];
  window.laisoBuck.state.view = 'set';
  window.laisoBuck.render();
});

const actionNames = await page
  .locator('[data-action]')
  .evaluateAll((els) => els.map((el) => el.dataset.action));
for (const action of ['set-generate', 'set-save']) {
  assert.ok(actionNames.includes(action), `DOM should include data-action=${action}`);
}

await renderView('backup');
const backupActions = await page
  .locator('[data-action]')
  .evaluateAll((els) => els.map((el) => el.dataset.action));
assert.ok(
  backupActions.includes('backup-download'),
  'DOM should include data-action=backup-download'
);

await page.evaluate(() => {
  const now = Date.now();
  window.laisoBuck.state.collection = [
    {
      id: 'smoke-vinyl-a',
      artist: 'Seba',
      title: 'Smoke Plate A',
      label: 'Smoke Label',
      catno: 'SMK001',
      addedAt: now,
      tracklist: [
        {
          id: 'smoke-a1',
          position: 'A1',
          side: 'A',
          title: 'Solace',
          bpm: 176,
          key: 'D# minor',
          camelot: '2A',
          duration: '5:30',
        },
        {
          id: 'smoke-b1',
          position: 'B1',
          side: 'B',
          title: 'Bellamee',
          bpm: 174,
          key: 'E minor',
          camelot: '9A',
          duration: '5:10',
        },
      ],
    },
    {
      id: 'smoke-vinyl-b',
      artist: 'Calibre',
      title: 'Smoke Plate B',
      label: 'Smoke Label',
      catno: 'SMK002',
      addedAt: now,
      tracklist: [
        {
          id: 'smoke-a2',
          position: 'A1',
          side: 'A',
          title: 'Ready Beek',
          bpm: 174,
          key: 'D# minor',
          camelot: '2A',
          duration: '5:45',
        },
        {
          id: 'smoke-b2',
          position: 'B1',
          side: 'B',
          title: 'North Flow',
          bpm: 172,
          key: 'B minor',
          camelot: '10A',
          duration: '5:20',
        },
      ],
    },
  ];
  window.laisoBuck.state.vinyls = [];
});

await renderView('home');
await page.getByTestId('home-set-builder').click();
await page.waitForFunction(() => window.laisoBuck.state.view === 'set-source-kind');
await page.getByTestId('set-source-tracks').click();
await page.waitForFunction(() => window.laisoBuck.state.view === 'set-track-source');
await page.locator('[data-testid="set-track-source"]').waitFor({ state: 'visible' });
assert.equal(await page.locator('.vertax-track-source-card').count(), 4, 'All tracks should show');
assert.equal(
  await page.locator('button.vertax-track-source-card[aria-pressed]').count(),
  4,
  'Track source cards should be accessible toggle buttons'
);
await page.locator('[data-action="set-track-search"]').fill('seba');
await page.waitForFunction(
  () => document.querySelectorAll('.vertax-track-source-card:not([hidden])').length === 2
);
await page.locator('[data-action="set-track-clear"]').click();
await page.waitForFunction(() =>
  document.querySelector('[data-action="set-track-build"]').textContent.includes('(0)')
);
const trackSearchInput = page.locator('[data-action="set-track-search"]');
await trackSearchInput.fill('');
await trackSearchInput.evaluate((input) => {
  input.value = '';
  input.dispatchEvent(new Event('input', { bubbles: true }));
});
await page.evaluate(() => {
  window.laisoBuck.state.ui.setTrackSearch = '';
  window.laisoBuck.render();
});
await page.waitForFunction(
  () =>
    window.laisoBuck.state.ui.setTrackSearch === '' &&
    document.querySelectorAll('.vertax-track-source-card:not([hidden])').length === 4
);
await page.locator('[data-action="set-track-select-all"]').click();
await page.waitForFunction(() =>
  document.querySelector('[data-action="set-track-build"]').textContent.includes('(4)')
);
await page.locator('[data-action="set-track-build"]').click();
await page.waitForFunction(() => window.laisoBuck.state.view === 'set');
assert.equal(
  await page.evaluate(() => window.laisoBuck.state.ui.generatedSet.length),
  4,
  'Track source build should keep every selected track'
);
assert.equal(
  await page.locator('.runt-set-card').count(),
  4,
  'Generated set should render four rows'
);
assert.equal(
  await page.locator('[data-action="toggle-set-config"]').getAttribute('aria-expanded'),
  'false',
  'Generated set should prioritize tracks by collapsing build settings'
);
await page.locator('[data-action="toggle-set-config"]').click();
assert.equal(
  await page.locator('[data-action="toggle-set-config"]').getAttribute('aria-expanded'),
  'true',
  'Build settings should remain available on demand'
);
await page.waitForFunction(() => !!document.querySelector('.vertax-set-ux-controls'));
assert.equal(
  await page.locator('[data-action="set-target-pick"]').count(),
  4,
  'Set duration should offer 30, 60, 90 and 120 minute targets'
);
assert.equal(
  await page.locator('[data-action="set-genre-filter"]').count(),
  1,
  'Set builder should keep the genre filter available'
);
assert.equal(
  await page.locator('[data-action="set-move-to"]').count(),
  4,
  'Every set row should expose a direct position control'
);
const firstSetTrackId = await page.evaluate(
  () => window.laisoBuck.state.ui.generatedSet[0] && window.laisoBuck.state.ui.generatedSet[0].id
);
await page.locator('[data-action="set-move-to"]').first().selectOption({ value: '3' });
await page.waitForTimeout(100);
const positionMoveState = await page.evaluate(() => ({
  handler: typeof handlers !== 'undefined' && typeof handlers['set-move-to'],
  value: document.querySelector('[data-action="set-move-to"]')?.value,
  ids: window.laisoBuck.state.ui.generatedSet.map((track) => track.id),
}));
assert.equal(
  positionMoveState.ids[3],
  firstSetTrackId,
  `Position control should move a track directly to the selected slot: ${JSON.stringify(positionMoveState)}`
);
assert.equal(
  await page.evaluate(() => document.activeElement?.dataset?.setIdx),
  '3',
  'Position control should keep focus after moving a track'
);
await page.locator('[data-action="set-mode"][data-mode="tempo-safe"]').first().click();
assert.equal(
  await page.evaluate(() => window.laisoBuck.state.ui.generatedSet.length),
  4,
  'Tempo mode should reorder track-source set without clearing it'
);
await page.locator('[data-action="set-mode"][data-mode="camelot-safe"]').first().click();
assert.equal(
  await page.evaluate(() => window.laisoBuck.state.ui.generatedSet.length),
  4,
  'Camelot mode should reorder track-source set without clearing it'
);

await page.setViewportSize({ width: 390, height: 844 });
await page.evaluate(() => {
  const seeds = window.laisoBuck.state.ui.generatedSet.slice();
  window.laisoBuck.state.ui.generatedSet = Array.from({ length: 20 }, (_, index) => ({
    ...seeds[index % seeds.length],
    id: `compact-${index}`,
    recordId: `compact-vinyl-${index % 4}`,
    title: `Compact set track ${index + 1}`,
  }));
  window.laisoBuck.state.view = 'set';
  window.laisoBuck.render();
});
await page.waitForFunction(() => document.querySelectorAll('.runt-set-card').length === 20);
const compactGeometry = await page.locator('.runt-set-card').evaluateAll((cards) => ({
  maxHeight: Math.max(...cards.map((card) => card.getBoundingClientRect().height)),
  overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
}));
assert.ok(
  compactGeometry.maxHeight <= 118,
  `Mobile set rows should stay compact, got ${compactGeometry.maxHeight}px`
);
assert.equal(compactGeometry.overflow, false, 'Compact set rows should not overflow horizontally');

const mobileSetControls = await page.evaluate(() => {
  const bar = document.querySelector('.vertax-set-actionbar');
  const save = bar && bar.querySelector('[data-action="set-save"]');
  const theme = document.querySelector('[data-action="theme-toggle"]');
  const language = document.querySelector('.vertax-lang-dial-face');
  const saveStyle = save ? getComputedStyle(save) : null;
  return {
    barPosition: bar ? getComputedStyle(bar).position : '',
    actions: bar ? bar.querySelectorAll('button').length : 0,
    minActionHeight: bar
      ? Math.min(
          ...Array.from(
            bar.querySelectorAll('button'),
            (button) => button.getBoundingClientRect().height
          )
        )
      : 0,
    saveColor: saveStyle && saveStyle.color,
    themeHeight: theme && theme.getBoundingClientRect().height,
    languageHeight: language && language.getBoundingClientRect().height,
  };
});
assert.equal(
  mobileSetControls.barPosition,
  'sticky',
  'Set actions should stay reachable while scrolling'
);
assert.equal(mobileSetControls.actions, 3, 'Set action bar should expose save, add and export');
assert.ok(
  mobileSetControls.minActionHeight >= 44,
  'Set action buttons should keep 44px touch targets'
);
assert.equal(
  mobileSetControls.saveColor,
  'rgb(16, 16, 16)',
  'Lime save action should keep dark text'
);
assert.ok(mobileSetControls.themeHeight >= 44, 'Theme switch should keep a 44px touch target');
assert.ok(
  mobileSetControls.languageHeight >= 44,
  'Language switch should keep a 44px touch target'
);

await renderView('collection');
assert.equal(
  await page.locator('.vertax-collection-sort-select select').isVisible(),
  true,
  'Mobile collection should expose the compact native sort control'
);
await page.locator('[data-action="collection-sort-select"]').selectOption('artist');
assert.equal(
  await page.evaluate(() => window.laisoBuck.state.ui.collectionSort),
  'artist',
  'Mobile collection sort should update the shared state'
);

await renderView('add');
assert.ok(
  parseFloat(
    await page
      .locator('.laiso-input')
      .first()
      .evaluate((input) => getComputedStyle(input).fontSize)
  ) >= 16,
  'Mobile form fields should use at least 16px text to prevent browser zoom'
);
await page.setViewportSize({ width: 1280, height: 720 });

await renderView('collection');
assert.equal(
  await page.locator('.vertax-collection-set-build, .runt18c-safe-build').count(),
  0,
  'Collection should not render the obsolete duplicate set-builder block'
);

await page.evaluate(() => {
  window.laisoBuck.state.collection = [];
  window.laisoBuck.state.vinyls = [];
  window.laisoBuck.state.ui.generatedSet = [];
  window.laisoBuck.state.ui.setTrackPool = [];
  window.laisoBuck.state.ui.setTrackSelected = {};
  window.laisoBuck.state.ui.setTrackSelectionCleared = false;
});

await renderView('home');
await page.getByTestId('open-dig').click();
await page.waitForFunction(() => window.laisoBuck.state.view === 'dig');
await page.getByTestId('dig-view').waitFor({ state: 'visible' });
assert.equal(
  await page.getByTestId('dig-onboarding-empty').count(),
  1,
  'Empty collection should show dig onboarding'
);
await page.locator('[data-action="back"]').first().click();
await page.waitForFunction(() => window.laisoBuck.state.view === 'home');

const digEmpty = await page.evaluate(() => window.computeDigAnalysis([]));
assert.equal(digEmpty.record_count, 0, 'empty dig analysis record_count');
assert.equal(digEmpty.track_count, 0, 'empty dig analysis track_count');
assert.equal(digEmpty.confidence, 'none', 'empty dig analysis confidence');

const digSynthetic = await page.evaluate(() => {
  const records = Array.from({ length: 10 }, (_, i) => ({
    id: `r-${i}`,
    title: `Record ${i}`,
    artist: 'Smoke Artist',
    tracklist: [
      { id: `a-${i}`, title: `Track A ${i}`, bpm: 170 + (i % 2), camelot: '9A' },
      { id: `b-${i}`, title: `Track B ${i}`, bpm: i < 5 ? 174 : 175, camelot: '9A' },
    ],
  }));
  return window.computeDigAnalysis(records);
});
assert.equal(digSynthetic.camelot_grid['9A'].level, 'strong', '9A should be strong');
assert.ok(
  digSynthetic.bpm_histogram.some((row) => row.range === '170-179' && row.count === 20),
  '170-179 BPM band should collect DnB/Jungle tempo tracks'
);

await renderView('home');
await page.getByTestId('home-add-record').click();
await page.waitForFunction(() => window.laisoBuck.state.view === 'add');
assert.ok(
  (await page.locator('#laiso-root').innerHTML()).includes('Добавить пластинку'),
  'Add vinyl button should open add view'
);

await renderView('home');
await page.getByTestId('home-about').click();
await page.locator('.laiso-modal').waitFor({ state: 'visible' });
await page.getByTestId('about-modal-close').click();
await page.waitForFunction(() => !document.querySelector('.laiso-modal'));

await page.evaluate(() => {
  clearTimeout(window.laisoBuck.state._toastT);
  clearTimeout(window.laisoBuck.state._patch17ToastT);
  window.laisoBuck.state.toast = 'smoke toast';
  window.laisoBuck.render();
});
await page.waitForFunction(() => {
  const toast = document.querySelector('.laiso-toast');
  return toast && toast.textContent.includes('smoke toast');
});

await renderView('home');
await page.getByTestId('home-collection').click();
await page.waitForFunction(() => window.laisoBuck.state.view === 'collection');
await renderView('home');
await page.getByTestId('home-backup').click();
await page.waitForFunction(() => window.laisoBuck.state.view === 'backup');

const uncaught = errors.filter((line) =>
  /Uncaught|ReferenceError|SyntaxError|TypeError/i.test(line)
);
assert.deepEqual(
  uncaught,
  [],
  `No uncaught console/runtime errors expected: ${uncaught.join('\n')}`
);

try {
  for (const route of ['/about/', '/vk/', '/admin/']) {
    const checkPage = await browser.newPage();
    await checkPage.route('**/*', async (routeRequest) => {
      const requestUrl = routeRequest.request().url();
      if (requestUrl.startsWith(url)) return routeRequest.continue();
      return routeRequest.fulfill({ status: 204, body: '' });
    });
    await checkPage.goto(url.replace(/\/$/, route), { waitUntil: 'domcontentloaded' });
    assert.ok(
      (await checkPage.locator('body').innerText()).trim().length > 0,
      `${route} should render body text`
    );
    await checkPage.close();
  }
} finally {
  await browser.close();
  await new Promise((resolveClose) => server.close(resolveClose));
}

console.log('smoke ok');
