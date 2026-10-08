import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
const forbidden = /\b(?:document\.|window\.|HTMLElement\b|localStorage\b|sessionStorage\b|Math\.random\(|setTimeout\(|UnityEngine\b)/;
async function scan(folder) {
  for (const e of await readdir(folder, { withFileTypes: true })) {
    const path = join(folder, e.name);
    if (e.isDirectory()) await scan(path);
    else if (e.name.endsWith('.js')) {
      const src = await readFile(path, 'utf8');
      if (forbidden.test(src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,''))) throw new Error(`Forbidden platform API in ${path}`);
    }
  }
}
await scan(new URL('../src/domain/', import.meta.url).pathname);
console.log('Domain architecture boundary OK');
