import { readFile } from 'node:fs/promises';
import { ConfigCatalog } from './ConfigCatalog.js';
/** Node-only adapter. Domain and Presenter remain platform independent. */
export async function loadFixture(file = new URL('../../config/demo.fixture.json', import.meta.url)) {
  return new ConfigCatalog(JSON.parse(await readFile(file, 'utf8')));
}
