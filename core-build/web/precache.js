// Writes app/www/precache.json for the web version's service worker: the main app's files, which work offline from
// the first visit. The emulators (ti89/, classic/, hp/, nspire/) are cached the first time each is opened.
// Usage: node core-build/web/precache.js [dir]
const fs = require('fs'), path = require('path');
const WWW = path.resolve(process.argv[2] || path.join(__dirname, '../../app/www'));
const SKIP = new Set(['ti89', 'classic', 'hp', 'nspire']);
const out = [];
(function walk(d, rel) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) { if (!(rel === '' && SKIP.has(e.name))) walk(path.join(d, e.name), r); }
    else if (!/^(sw\.js|precache\.json)$/.test(r) && !/\.(md|txt)$/i.test(e.name) || r === 'docs/guide.md') out.push(r);
  }
})(WWW, '');
out.sort();
fs.writeFileSync(path.join(WWW, 'precache.json'), JSON.stringify(out) + '\n');
console.log(out.length + ' files, ' + (out.reduce((t, f) => t + fs.statSync(path.join(WWW, f)).size, 0) / 1048576).toFixed(1) + ' MB precached');
