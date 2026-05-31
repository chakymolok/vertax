const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'public');

const entries = [
  'index.html',
  'sw.js',
  'about',
  'admin',
  'vk',
  'assets',
  'dist',
  'fonts',
  'js/about.js',
  'js/admin.js',
];

const fileCopies = [
  ['css/about.css', 'about.css'],
  ['css/admin.css', 'admin.css'],
];

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      copyRecursive(path.join(src, name), path.join(dest, name));
    }
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

for (const entry of entries) {
  const src = path.join(root, entry);
  if (!fs.existsSync(src)) continue;
  copyRecursive(src, path.join(outDir, entry));
}

for (const copy of fileCopies) {
  const src = path.join(root, copy[0]);
  if (!fs.existsSync(src)) continue;
  copyRecursive(src, path.join(outDir, copy[1]));
}

console.log('public/ static output ready');
