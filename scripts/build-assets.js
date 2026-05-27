const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');

const jsFiles = [
  'js/db.js',
  'js/state.js',
  'js/api.js',
  'js/render.js',
  'js/handlers.js',
  'js/app.js',
  'js/app-i18n.js',
];

const cssFiles = [
  'css/base.css',
  'css/layout.css',
  'css/components.css',
  'css/themes.css',
  'css/display.css',
  'css/app-i18n.css',
];

function readFiles(files) {
  return files
    .map((file) => {
      const full = path.join(root, file);
      return `\n/* ${file} */\n${fs.readFileSync(full, 'utf8')}\n`;
    })
    .join('\n');
}

async function build() {
  fs.mkdirSync(dist, { recursive: true });

  const js = await esbuild.transform(readFiles(jsFiles), {
    loader: 'js',
    minify: true,
    target: 'es2018',
    sourcemap: false,
    legalComments: 'none',
  });

  const css = await esbuild.transform(readFiles(cssFiles), {
    loader: 'css',
    minify: true,
    sourcemap: false,
    legalComments: 'none',
  });

  fs.writeFileSync(path.join(dist, 'app.js'), js.code);
  fs.writeFileSync(path.join(dist, 'app.css'), css.code);

  const report = {
    jsBytes: Buffer.byteLength(js.code),
    cssBytes: Buffer.byteLength(css.code),
    jsSources: jsFiles,
    cssSources: cssFiles,
    builtAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(dist, 'build-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`dist/app.js ${report.jsBytes} bytes`);
  console.log(`dist/app.css ${report.cssBytes} bytes`);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
