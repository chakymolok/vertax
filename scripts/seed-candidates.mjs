import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configPath = path.join(root, 'config', 'candidate-labels.json');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanBaseUrl(value) {
  return String(value || '').replace(/\/+$/, '');
}

function cleanLimit(value) {
  return Math.max(1, Math.min(25, Number(value) || 20));
}

async function readConfig() {
  const raw = await fs.readFile(configPath, 'utf8');
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed.labels) ? parsed.labels : [];
}

function labelMatchesFilter(label, filter) {
  if (!filter) return true;
  const needle = String(filter).trim().toLowerCase();
  return (
    String(label.name || '')
      .toLowerCase()
      .includes(needle) || String(label.discogs_label_id || '') === needle
  );
}

function labelMatchesGenre(label, filter) {
  if (!filter) return true;
  const needle = String(filter).trim().toLowerCase();
  return String(label.genre_family || '').toLowerCase() === needle;
}

async function postJson(baseUrl, token, body) {
  const res = await fetch(`${baseUrl}/api/admin/maintenance`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) {
    const message = json.error || json.message || `HTTP ${res.status}`;
    const error = new Error(message);
    error.response = json;
    error.status = res.status;
    throw error;
  }
  return json;
}

async function loadSeedState(baseUrl, token) {
  try {
    const json = await postJson(baseUrl, token, { action: 'candidate_seed_state' });
    const map = new Map();
    (json.labels || []).forEach((item) => {
      if (item && item.label_id) map.set(String(item.label_id), item);
    });
    return map;
  } catch (error) {
    console.warn(`Could not load seed state: ${error.message}`);
    return new Map();
  }
}

async function seedLabel(label, options, state) {
  const summary = { label: label.name, processed: 0, saved: 0, updated: 0, failed: 0, errors: [] };
  if (!label.discogs_label_id) {
    console.warn(`[skip] ${label.name}: missing discogs_label_id`);
    return Object.assign(summary, { skipped: true });
  }

  const maxBatches = Math.max(1, Number(label.max_batches_per_run) || 1);
  let offset = Math.max(0, Number(state && state.last_offset) || 0);
  console.log(`\n[label] ${label.name} (${label.discogs_label_id}) starting offset ${offset}`);

  for (let batch = 0; batch < maxBatches; batch += 1) {
    console.log(`[batch] ${label.name}: offset=${offset} limit=${options.limit}`);
    try {
      const json = await postJson(options.baseUrl, options.token, {
        action: 'seed_candidates',
        label_id: label.discogs_label_id,
        label_name: label.name,
        genre_family: label.genre_family || null,
        offset,
        limit: options.limit,
      });
      summary.processed += Number(json.processed_in_batch) || 0;
      summary.saved += Number(json.saved) || 0;
      summary.updated += Number(json.updated) || 0;
      summary.failed += Number(json.failed) || 0;
      if (Array.isArray(json.errors) && json.errors.length) {
        summary.errors.push(...json.errors.map((item) => ({ label: label.name, ...item })));
      }
      console.log(
        `[ok] processed=${json.processed_in_batch} saved=${json.saved} updated=${json.updated} failed=${json.failed} next_offset=${json.next_offset} has_more=${json.has_more}`
      );
      if (!json.has_more || json.next_offset == null) break;
      offset = Number(json.next_offset) || 0;
      if (batch < maxBatches - 1) await sleep(options.pauseMs);
    } catch (error) {
      summary.failed += 1;
      summary.errors.push({ label: label.name, error: error.message });
      console.error(`[error] ${label.name}: ${error.message}`);
      break;
    }
  }
  return summary;
}

async function main() {
  const filter = process.env.LABEL_FILTER || '';
  const genreFilter = process.env.GENRE_FILTER || '';
  const hasExplicitFilter = Boolean(filter || genreFilter);
  const labels = (await readConfig()).filter(
    (label) => label && (label.enabled !== false || hasExplicitFilter)
  );
  const selected = labels
    .filter((label) => labelMatchesFilter(label, filter))
    .filter((label) => labelMatchesGenre(label, genreFilter));
  const limit = cleanLimit(process.env.LIMIT);
  const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';

  console.log(
    `Vertax candidate seed: ${selected.length} label(s), limit=${limit}, dry_run=${dryRun}`
  );
  selected.forEach((label) => {
    console.log(
      `- ${label.name} id=${label.discogs_label_id || 'TODO'} family=${label.genre_family || 'other'} max_batches=${label.max_batches_per_run || 1}`
    );
  });

  if (dryRun) {
    console.log('Dry run complete. No API calls were made.');
    return;
  }

  const baseUrl = cleanBaseUrl(process.env.VERTAX_BASE_URL);
  const token = process.env.VERTAX_ADMIN_TOKEN;
  if (!baseUrl) throw new Error('VERTAX_BASE_URL is required');
  if (!token) throw new Error('VERTAX_ADMIN_TOKEN is required');

  const stateMap = await loadSeedState(baseUrl, token);
  const totals = {
    labels_processed: 0,
    saved: 0,
    updated: 0,
    failed: 0,
    labels_with_errors: [],
  };

  for (const label of selected) {
    const labelState = stateMap.get(String(label.discogs_label_id));
    const result = await seedLabel(label, { baseUrl, token, limit, pauseMs: 2000 }, labelState);
    if (!result.skipped) totals.labels_processed += 1;
    totals.saved += result.saved;
    totals.updated += result.updated;
    totals.failed += result.failed;
    if (result.errors.length) totals.labels_with_errors.push(label.name);
    await sleep(2000);
  }

  console.log('\nSummary');
  console.log(JSON.stringify(totals, null, 2));
}

main().catch((error) => {
  console.error(error && error.message ? error.message : error);
  process.exit(1);
});
