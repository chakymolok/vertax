import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const url = pathToFileURL(resolve('index.html')).href;
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
  if (requestUrl.startsWith('file:')) return route.continue();
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

async function renderView(view) {
  await page.evaluate((nextView) => {
    window.laisoBuck.state.view = nextView;
    window.laisoBuck.render();
  }, view);
  await page.locator('#laiso-root').waitFor({ state: 'visible' });
  const html = await page.locator('#laiso-root').innerHTML();
  assert.ok(html.trim().length > 0, `${view} should render non-empty HTML`);
  return html;
}

await renderView('home');
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

await browser.close();
console.log('smoke ok');
