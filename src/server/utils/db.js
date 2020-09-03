import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import JSON5 from 'json5';
import rimraf from 'rimraf';
import mkdirp from 'mkdirp';

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const unlink = promisify(rimraf);

const locks = {};
const writeQueue = {};

const VERBOSE = false;

const db = {
  async read(fullpath) {
    try {
      const data = await readFile(fullpath, 'utf8');
      const json = JSON5.parse(data.toString());
      return json;
    } catch(err) {
      console.log('db::read', err);
    }
  },

  // @todo - we need to queue write calls because it can lead to file corruption
  async write(fullpath, data) {
    try {
      if (locks[fullpath] === true) {
        if (VERBOSE) {
          console.log(`[db.write] enqueue ${fullpath}`);
        }

        writeQueue[fullpath] = data;
        // @todo - this is not clean, as it will resolve before the first
        // write ends... this should be handled properly
        return Promise.resolve();
      } else {
        locks[fullpath] = true;

        if (VERBOSE) {
          console.log(`[db.write] ensuring ${path.dirname(fullpath)}`);
          console.log(`[db.write] writing ${fullpath}`);
        }

        // create directory if not exists
        await mkdirp(path.dirname(fullpath));
        // write the file
        const json = JSON5.stringify(data, null, 2);
        await writeFile(fullpath, json, 'utf8');

        locks[fullpath] = false;

        if (writeQueue[fullpath]) {
          if (VERBOSE) {
            console.log(`[db.write] dequeue ${fullpath}`);
          }

          const data = writeQueue[fullpath];
          delete writeQueue[fullpath];
          await this.write(fullpath, data);
        }
      }
    } catch(err) {
      console.log('db::write', err);
    }
  },

  async delete(fullpath) {
    try {
      await unlink(fullpath);
    } catch(err) {
      console.log('db::delete', err);
    }
  },
};

export default db;
