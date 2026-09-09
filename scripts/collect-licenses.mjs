import { readdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve('node_modules');
const seen = new Set();
const licenses = [];
async function walk(directory) {
 const actual = await realpath(directory);
 if (seen.has(actual)) return;
 seen.add(actual);
 for (const entry of await readdir(directory, { withFileTypes: true })) {
  const file = path.join(directory, entry.name);
  if (entry.isDirectory() || entry.isSymbolicLink()) {
   if (entry.name === '.bin') continue;
   try { await walk(file); } catch (error) { if (error.code !== 'ENOTDIR') throw error; }
  } else if (/^(licen[sc]e|copying|notice)([.-]|$)/i.test(entry.name)) {
   licenses.push({ name: path.relative(root, file), text: await readFile(file, 'utf8') });
  }
 }
}
await walk(root);
licenses.sort((a,b) => a.name.localeCompare(b.name));
if (licenses.length < 10) throw new Error('Dependency license collection incomplete.');
await writeFile('THIRD_PARTY_LICENSES.txt', licenses.map(item => `=== ${item.name} ===\n\n${item.text}\n`).join('\n'));
console.log(`Included ${licenses.length} third-party license and notice files.`);
