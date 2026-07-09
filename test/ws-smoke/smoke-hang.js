/**
 * Сервер принимает TCP, но никогда не отвечает на HTTP upgrade.
 * После фикса у клиента есть handshakeTimeout: 15000 — библиотека ws сама
 * эмитит error+close, дальше штатный реконнект.
 * Ожидание: через ~15с + backoff (1с + джиттер 0-10с) появляется вторая
 * попытка соединения. Ждём 40с и требуем >= 2 попыток.
 */
'use strict';

const PLUGIN_DIR = '/home/efa/projects/NodeRedHome/node-red-contrib-alice';
process.env.ALICE_WS_URL = 'ws://127.0.0.1:18083/v1/ws';

const net = require('net');
const { EventEmitter } = require('events');

let connAttempts = 0;
const srv = net.createServer((sock) => {
  connAttempts++;
  console.log('  [tcp] accepted connection #' + connAttempts + ' (никогда не отвечаем)');
  sock.on('error', () => {});
  // молчим: ни 101, ни 4xx, соединение держим открытым
});
srv.listen(18083);

let nodeConstructor = null;
const fakeRED = {
  nodes: { createNode: () => {}, registerType: (n, c) => { nodeConstructor = c; } },
  httpAdmin: { get: () => {} }
};
require(PLUGIN_DIR + '/nodes/alice.js')(fakeRED);

const node = new EventEmitter();
node.id = 'svc-hang';
node.credentials = { email: 't@e.com', id: 'u', password: '', token: JSON.stringify({ access_token: 'x' }) };
const logs = [];
for (const m of ['debug', 'trace', 'warn', 'error', 'log']) {
  node[m] = (msg) => { logs.push(m + ': ' + msg); console.log('  [node.' + m + '] ' + msg); };
}
node.status = () => {};

const t0 = Date.now();
nodeConstructor.call(node, { id: 'svc-hang', name: 't' });

setTimeout(() => {
  console.log('');
  console.log('Спустя 40с: попыток соединения: ' + connAttempts);
  const sawTimeout = logs.some(l => /error.*timed out|close.*code:1006/i.test(l) || /Opening handshake has timed out/.test(l));
  const pass = connAttempts >= 2;
  if (pass) {
    console.log('RESULT: OK — handshake-таймаут (~15с) сработал'
      + (sawTimeout ? ' (error/close получены)' : '') + ', клиент переподключается');
  } else {
    console.log('RESULT: FAIL — клиент завис в CONNECTING, реконнекта нет');
  }
  node.emit('close', () => { console.log('  [close] done() вызван'); });
  setTimeout(() => { srv.close(); process.exit(pass ? 0 : 1); }, 2000);
}, 40000);
