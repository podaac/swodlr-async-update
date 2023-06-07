import fs from 'fs/promises';
import path from 'path';

/**
 * Loads JSON from the data/ directory asynchronously
 * @param {string} name a filename without the .json extension suffix
 */
export async function loadTestData(name) {
  const dataPath = path.resolve(
      import.meta.url.replace(/^file:/, ''),
      '../data',
      `${name}.json`,
  );
  const data = await fs.readFile(dataPath, 'utf-8');
  return JSON.parse(data);
}
