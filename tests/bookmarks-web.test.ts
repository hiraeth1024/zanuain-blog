import test from 'node:test';
import assert from 'node:assert/strict';
import dns from 'node:dns/promises';
import http from 'node:http';
import { syncBuiltinESMExports } from 'node:module';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import type { LookupFunction } from 'node:net';
import { fetchPage, safeFetch } from '../server/bookmarks/web.ts';

test('抓取兼容单地址和 IPv4/IPv6 自动选择，并提取网页信息', async t => {
  const addresses = [
    {address: '93.184.215.14', family: 4},
    {address: '2606:2800:220:1:248:1893:25c8:1946', family: 6},
  ];
  const lookup = t.mock.method(dns, 'lookup', async () => addresses);
  syncBuiltinESMExports();
  t.after(() => { lookup.mock.restore(); syncBuiltinESMExports(); });

  t.mock.method(http, 'get', (_url: URL, options: {lookup: LookupFunction}, respond: (response: Readable) => void) => {
    options.lookup('metadata.example', {all: true}, (error, result) => {
      assert.equal(error, null);
      assert.deepEqual(result, addresses);
    });
    options.lookup('metadata.example', {all: false}, (error, address, family) => {
      assert.equal(error, null);
      assert.equal(address, addresses[0].address);
      assert.equal(family, 4);
    });
    const request = new EventEmitter();
    queueMicrotask(() => {
      const response = Readable.from([Buffer.from('<title>测试页面</title><meta name="description" content="网页描述"><meta name="author" content="作者"><meta property="og:image" content="/cover.png">')]);
      Object.assign(response, {statusCode: 200, headers: {'content-type': 'text/html; charset=utf-8'}});
      response.on('end', () => request.emit('close'));
      respond(response);
    });
    return request;
  });
  const {metadata} = await fetchPage('http://metadata.example/');
  assert.equal(metadata.title, '测试页面');
  assert.equal(metadata.description, '网页描述');
  assert.equal(metadata.author, '作者');
  assert.equal(metadata.preview_image, 'http://metadata.example/cover.png');
  assert.equal(lookup.mock.callCount(), 1);
});

test('混合公网与私网 DNS 结果在发起请求前拒绝', async t => {
  const lookup = t.mock.method(dns, 'lookup', async () => [
    {address: '93.184.215.14', family: 4},
    {address: '127.0.0.1', family: 4},
  ]);
  syncBuiltinESMExports();
  t.after(() => { lookup.mock.restore(); syncBuiltinESMExports(); });
  const get = t.mock.method(http, 'get', () => { throw new Error('不应发起请求'); });
  await assert.rejects(safeFetch('http://metadata.example/'), /不能抓取本机、内网或保留地址/);
  assert.equal(get.mock.callCount(), 0);
});
