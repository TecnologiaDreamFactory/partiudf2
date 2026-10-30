// Converte dream-factory-manual.md -> dream-factory-manual.html com tema PARTIU DF.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mdPath = path.join(__dirname, 'dream-factory-manual.md');
const htmlPath = path.join(__dirname, 'dream-factory-manual.html');

const md = fs.readFileSync(mdPath, 'utf8');
const title = 'PARTIU DF — Manual técnico';

marked.setOptions({ gfm: true, breaks: false });

let body = marked.parse(md);

// a11y / lint HTML: normaliza os checkboxes das task lists.
// O marked gera `<input disabled="" type="checkbox">` (valor de atributo vazio e
// sem nome acessível) — o que dispara avisos. Aqui viram atributos boolean +
// aria-label descrevendo o estado.
body = body.replace(/<input\b[^>]*type="checkbox"[^>]*>/g, (tag) => {
  const checked = /\bchecked\b/.test(tag);
  return `<input type="checkbox" disabled${checked ? ' checked' : ''} aria-label="${
    checked ? 'concluído' : 'pendente'
  }">`;
});

const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Outfit:wght@600;700&display=swap" rel="stylesheet" />
  <style>
    :root {
      --df-blue: #00A8E8;
      --df-blue-dark: #0086BD;
      --df-blue-soft: #E6F6FE;
      --df-ink: #0A1929;
      --df-muted: #64748B;
      --df-surface: #FFFFFF;
      --df-surface-2: #F8FAFC;
      --df-border: #E2E8F0;
      --df-danger: #DC2626;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --df-blue: #29B6F0;
        --df-blue-dark: #00A8E8;
        --df-blue-soft: rgba(0, 168, 232, 0.14);
        --df-ink: #E2E8F0;
        --df-muted: #94A3B8;
        --df-surface: #0F172A;
        --df-surface-2: #0A1224;
        --df-border: #1F2A44;
        --df-danger: #F87171;
      }
      html { color-scheme: dark; }
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      background: var(--df-surface-2);
      color: var(--df-ink);
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      line-height: 1.65;
      font-size: 16px;
      -webkit-font-smoothing: antialiased;
    }
    .container {
      max-width: 920px;
      margin: 0 auto;
      padding: 48px 24px 96px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
    }
    .brand-mark {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: var(--df-blue);
      position: relative;
      flex-shrink: 0;
    }
    .brand-mark::before, .brand-mark::after {
      content: '';
      position: absolute;
      background: #fff;
      border-radius: 50%;
    }
    .brand-mark::before {
      width: 14px;
      height: 14px;
      top: 7px;
      left: 8px;
    }
    .brand-mark::after {
      width: 6px;
      height: 6px;
      bottom: 8px;
      right: 9px;
    }
    .brand-text {
      font-family: 'Outfit', sans-serif;
      font-weight: 700;
      font-size: 14px;
      letter-spacing: 0.5px;
      color: var(--df-blue);
      text-transform: uppercase;
    }
    h1, h2, h3, h4 {
      font-family: 'Outfit', 'Inter', sans-serif;
      color: var(--df-ink);
      line-height: 1.25;
      margin-top: 1.8em;
      margin-bottom: 0.5em;
    }
    h1 { font-size: 2.1rem; font-weight: 700; margin-top: 0; }
    h2 {
      font-size: 1.5rem;
      font-weight: 600;
      padding-top: 1em;
      border-top: 1px solid var(--df-border);
    }
    h3 { font-size: 1.2rem; font-weight: 600; }
    h4 { font-size: 1.05rem; font-weight: 600; }
    p { margin: 0 0 1em; }
    a {
      color: var(--df-blue);
      text-decoration: none;
      border-bottom: 1px solid transparent;
      transition: border-color 0.15s;
    }
    a:hover { border-bottom-color: var(--df-blue); }
    blockquote {
      border-left: 3px solid var(--df-blue);
      background: var(--df-blue-soft);
      padding: 12px 18px;
      margin: 16px 0;
      border-radius: 0 8px 8px 0;
      color: var(--df-ink);
    }
    blockquote p:last-child { margin-bottom: 0; }
    code {
      font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, monospace;
      font-size: 0.9em;
      background: var(--df-surface);
      color: var(--df-blue-dark);
      padding: 2px 6px;
      border-radius: 4px;
      border: 1px solid var(--df-border);
    }
    pre {
      background: var(--df-ink);
      color: #E2E8F0;
      padding: 16px 20px;
      border-radius: 12px;
      overflow-x: auto;
      margin: 16px 0;
      border: 1px solid var(--df-border);
      box-shadow: 0 2px 12px rgba(10, 25, 41, 0.06);
    }
    pre code {
      background: transparent;
      border: none;
      padding: 0;
      color: inherit;
      font-size: 0.88em;
      line-height: 1.6;
    }
    @media (prefers-color-scheme: dark) {
      pre { background: #020617; }
    }
    hr {
      border: none;
      border-top: 1px solid var(--df-border);
      margin: 32px 0;
    }
    ul, ol { padding-left: 24px; margin: 0 0 1em; }
    li { margin: 4px 0; }
    li > input[type="checkbox"] { margin-right: 6px; }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 18px 0;
      font-size: 0.94em;
      background: var(--df-surface);
      border: 1px solid var(--df-border);
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 2px 12px rgba(10, 25, 41, 0.04);
    }
    th, td {
      padding: 10px 14px;
      text-align: left;
      border-bottom: 1px solid var(--df-border);
    }
    th {
      background: var(--df-blue-soft);
      color: var(--df-blue-dark);
      font-weight: 600;
      font-size: 0.85em;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    tbody tr:last-child td { border-bottom: none; }
    tbody tr:hover { background: var(--df-surface-2); }
    .toc {
      background: var(--df-surface);
      border: 1px solid var(--df-border);
      border-radius: 12px;
      padding: 16px 22px;
    }
    .toc ol { margin: 0; padding-left: 22px; }
    .toc a { color: var(--df-ink); }
    .toc a:hover { color: var(--df-blue); }
    .footer {
      margin-top: 64px;
      padding-top: 24px;
      border-top: 1px solid var(--df-border);
      color: var(--df-muted);
      font-size: 0.85em;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="brand">
      <div class="brand-mark" aria-hidden="true"></div>
      <span class="brand-text">PARTIU DF</span>
    </div>
    ${body}
    <div class="footer">
      Gerado a partir de <code>docs/dream-factory-manual.md</code>
    </div>
  </div>
</body>
</html>
`;

fs.writeFileSync(htmlPath, html, 'utf8');
console.log('OK:', htmlPath);
