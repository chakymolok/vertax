const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const cssFiles = ['css/base.css', 'css/layout.css', 'css/components.css', 'css/themes.css', 'css/display.css', 'css/app-i18n.css'];
const contentFiles = ['index.html', ...fs.readdirSync(path.join(root, 'js')).filter((f) => f.endsWith('.js')).map((f) => `js/${f}`)];

const content = contentFiles.map((file) => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
const safelist = [/^is-/, /^has-/, /^vertax-/, /^laiso-/, /^runt/, /^active$/, /^open$/, /^danger$/, /^hidden$/, /^selected$/, /^loading$/, /^error$/];

const selectors = new Set();
for (const file of cssFiles) {
  const css = fs.readFileSync(path.join(root, file), 'utf8');
  for (const match of css.matchAll(/\.([a-zA-Z0-9_-]+)/g)) selectors.add(match[1]);
}

const maybeUnused = [...selectors].filter((name) => {
  if (safelist.some((rx) => rx.test(name))) return false;
  return !content.includes(name);
});

console.log(`Selectors scanned: ${selectors.size}`);
console.log(`Potentially unused (audit only): ${maybeUnused.length}`);
maybeUnused.slice(0, 200).forEach((name) => console.log(name));
