// build.js — concatena os módulos JS num único HTML standalone.
// Zero dependências. Rode com: node build.js
// Saída: docs/index.html  →  servido automaticamente pelo GitHub Pages
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'src');
const DIST = path.join(__dirname, 'docs');   // GitHub Pages serve de /docs
const MARKER = '<!-- @BUILD:SCRIPTS -->';

// Ordem de carregamento IMPORTA: utils -> parsers -> classify -> render -> app
const JS_ORDER = [
  'js/utils.js',
  'js/parsers/protheus.js',
  'js/parsers/dominio.js',
  'js/classify.js',
  'js/render.js',
  'js/app.js',
];

function build() {
  const templatePath = path.join(SRC, 'index.html');
  if (!fs.existsSync(templatePath)) {
    throw new Error('src/index.html não existe ainda. Crie o template primeiro.');
  }
  const template = fs.readFileSync(templatePath, 'utf8');
  if (!template.includes(MARKER)) {
    throw new Error(`Marcador ${MARKER} não encontrado em src/index.html`);
  }

  const bundle = JS_ORDER.map(rel => {
    const p = path.join(SRC, rel);
    if (!fs.existsSync(p)) {
      console.warn(`  (aviso) módulo ainda não existe, pulando: ${rel}`);
      return '';
    }
    // Remove o shim de export do Node, que não deve ir para o navegador.
    const code = fs.readFileSync(p, 'utf8')
      .replace(/if \(typeof module[^\n]*module\.exports[^\n]*\n?/g, '');
    return `/* ===== ${rel} ===== */\n${code}`;
  }).filter(Boolean).join('\n\n');

  const out = template.replace(MARKER, `<script>\n${bundle}\n</script>`);

  if (!fs.existsSync(DIST)) fs.mkdirSync(DIST, { recursive: true });
  const outPath = path.join(DIST, 'index.html');   // GitHub Pages: docs/index.html
  fs.writeFileSync(outPath, out, 'utf8');
  console.log(`\u2713 build OK \u2192 ${outPath} (${(out.length / 1024).toFixed(0)} KB)`);
}

build();
