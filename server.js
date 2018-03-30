import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import compression from 'compression';
import wrap from 'co-express';
import shortId from 'short-id';
import { Readable, Writable } from 'stream';
import zlib from 'zlib';
import Busboy from 'busboy';
import toArray from 'stream-to-array';
import os from 'os';
import streamify from 'stream-array';
import http from 'http';

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 5050;

app.use(cors());
app.use(morgan('short'));
app.use(compression());

const clipboard = new Map();
const expiration = new Map();

const setExpiration = (id, time = 15 * 60 * 1000) => {
  clearTimeout(expiration.get(id));

  expiration.set(
    id,
    setTimeout(() => {
      clipboard.delete(id);
      expiration.delete(id);
    }, time)
  );
};

app.post(
  '/copy',
  wrap(async (req, res) => {
    let { data } = {
      ...(req.query || {}),
      ...(req.body || {})
    };

    const gzip = zlib.createGzip({ level: zlib.constants.Z_BEST_COMPRESSION });

    const dataArray = await (async () => {
      if (data != null) {
        console.log('blob - raw string');

        if (typeof data === 'object') {
          data = JSON.stringify(data);
        }

        return [data];
      } else {
        return await new Promise((resolve, reject) => {
          const busboy = new Busboy({ headers: req.headers });
          let foundDataStream = false,
            dataArray = [];

          busboy.on('file', (field, fileStream) => {
            if (field === 'data') {
              console.log('blob - multi-part streamed');

              toArray(fileStream, (err, array) => {
                if (err) {
                  return reject(err);
                }

                dataArray = dataArray.concat(array);
              });

              fileStream.on('error', reject);
              fileStream.on('end', () => (foundDataStream = true));
            }
          });

          busboy.on('field', (field, value) => {
            if (field === 'data') {
              console.log('blob - multi-part text');

              dataArray = dataArray.concat(value);

              foundDataStream = true;
            }
          });

          busboy.on('error', reject);
          busboy.on('finish', () => {
            if (!foundDataStream) {
              return reject('Could not find stream');
            }

            setTimeout(() => {
              resolve(dataArray);
            }, 0);
          });

          req.pipe(busboy);
        });
      }
    })();

    const id = shortId.generate();

    clipboard.set(id, await toArray(streamify(dataArray).pipe(gzip)));

    setExpiration(id);

    res.json({ id });
  })
);

app.get(
  '/paste',
  wrap(async (req, res) => {
    const { id } = {
      ...(req.query || {}),
      ...(req.body || {})
    };

    if (!clipboard.has(id)) {
      res.send().status(404);
      return;
    }

    setExpiration(id);

    streamify(clipboard.get(id))
      .pipe(zlib.createGunzip({ level: zlib.constants.Z_BEST_COMPRESSION }))
      .pipe(res);
  })
);

app.post(
  '/delete',
  wrap(async (req, res) => {
    const { id } = {
      ...(req.query || {}),
      ...(req.body || {})
    };

    if (!clipboard.has(id)) {
      res.send().status(404);
      return;
    }

    clipboard.delete(id);

    res.send();
  })
);

server.listen(port, () => console.log(`Server listening on port ${port}!`));
