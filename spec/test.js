import 'babel-polyfill';
import agent from 'superagent';
import path from 'path';
import fs from 'fs';
import assert from 'assert';

const endpoint = `http://localhost:${process.env.PORT || 5050}`;

describe('copy-paste-delete (file)', async () => {
  const filePath = path.join(__dirname, './fixtures/upload.txt');

  let id;

  it('should copy', async () => {
    const { body } = await agent
      .post(`${endpoint}/copy`)
      .attach('data', filePath);

    id = body.id;
  });

  it('should paste', async () => {
    const res = await agent.get(`${endpoint}/paste?id=${id}`);

    assert.strictEqual(res.text, fs.readFileSync(filePath, 'utf8'));
  });
});

describe('copy-paste-delete (string)', async () => {
  const filePath = path.join(__dirname, './fixtures/upload.txt');
  const expected = fs.readFileSync(filePath, 'utf8') + 1;

  let id;

  it('should copy', async () => {
    const { body } = await agent
      .post(`${endpoint}/copy`)
      .field('data', expected);

    id = body.id;
  });

  it('should paste', async () => {
    const res = await agent.get(`${endpoint}/paste?id=${id}`);

    assert.strictEqual(res.text, expected);
  });
});

describe('copy-paste-delete (string - url param)', async () => {
  const filePath = path.join(__dirname, './fixtures/upload.txt');
  const expected = fs.readFileSync(filePath, 'utf8') + 2;

  let id;

  it('should copy', async () => {
    const { body } = await agent.post(`${endpoint}/copy?data=${expected}`);

    id = body.id;
  });

  it('should paste', async () => {
    const res = await agent.get(`${endpoint}/paste?id=${id}`);

    assert.strictEqual(res.text, expected);
  });
});
