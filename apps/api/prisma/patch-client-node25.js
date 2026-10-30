/**
 * Node.js 25+ resolve imports estritos; o client gerado usa require('#main-entry-point')
 * sem package.json "imports" no pacote .prisma/client. Substitui por require relativo.
 */
const fs = require('fs');
const path = require('path');

const pkg = require.resolve('@prisma/client/package.json');
const defaultJs = path.join(path.dirname(pkg), '..', '..', '.prisma', 'client', 'default.js');

if (!fs.existsSync(defaultJs)) {
  console.warn('patch-client-node25: default.js não encontrado, ignorando.');
  process.exit(0);
}

let s = fs.readFileSync(defaultJs, 'utf8');
if (s.includes("require('#main-entry-point')")) {
  s = s.replace("require('#main-entry-point')", "require('./index.js')");
  fs.writeFileSync(defaultJs, s);
  console.log('patch-client-node25: default.js ajustado para Node.js 25+.');
}
