/**
 * Edge-тесты ревью WS-транспорта node-red-contrib-alice:
 *  1) 4429 после open: не должно быть online, backoff НЕ сбрасывается (нет молотилки раз в секунду);
 *  2) command-кадр без payload (или payload не массив) при слушателе в стиле alice-device
 *     (incomingStates.forEach) -> проверяем, роняет ли это процесс (uncaughtException);
 *  3) hello -> обрыв -> проверка, что backoff сброшен по hello (реконнект приходит быстро).
 */
'use strict';

const PLUGIN_DIR = '/home/efa/projects/NodeRedHome/node-red-contrib-alice';
process.env.ALICE_WS_URL = 'ws://127.0.0.1:18082/v1/ws';

const { EventEmitter } = require('events');
const { WebSocketServer } = require(PLUGIN_DIR + '/node_modules/ws');

const TOKEN = 'edge-token';
let failed = 0;
function ok(cond, name) {
  console.log((cond ? '  PASS: ' : '  FAIL: ') + name);
  if (!cond) failed++;
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function waitFor(emitter, event, timeoutMs, label) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout waiting for ' + label)), timeoutMs);
    emitter.once(event, (...args) => { clearTimeout(t); resolve(args); });
  });
}

const serverEvents = new EventEmitter();
const connTimes = [];
const wss = new WebSocketServer({ port: 18082, path: '/v1/ws' });
wss.on('connection', (sock, req) => {
  connTimes.push(Date.now());
  serverEvents.emit('connection', sock, req);
});

let nodeConstructor = null;
const fakeRED = {
  nodes: { createNode: () => {}, registerType: (n, c) => { nodeConstructor = c; } },
  httpAdmin: { get: () => {} }
};
require(PLUGIN_DIR + '/nodes/alice.js')(fakeRED);

function makeFakeNode(id) {
  const node = new EventEmitter();
  node.id = id;
  node.credentials = {
    email: 't@e.com', id: 'uid', password: '',
    token: JSON.stringify({ access_token: TOKEN })
  };
  for (const m of ['debug', 'trace', 'warn', 'error', 'log']) node[m] = () => {};
  node.status = () => {};
  return node;
}

let uncaught = null;
process.on('uncaughtException', (err) => { uncaught = err; });

async function main() {
  console.log('== A. 4429 после open: нет online, backoff растёт ==');
  const node = makeFakeNode('svc-edge');
  const c1 = waitFor(serverEvents, 'connection', 5000, 'conn1');
  nodeConstructor.call(node, { id: 'svc-edge', name: 't' });
  const [s1] = await c1;
  // сервер сразу закрывает 4429, hello не шлёт
  const c2 = waitFor(serverEvents, 'connection', 20000, 'conn2');
  s1.close(4429, 'too many connections');
  await sleep(300);
  ok(node.isOnline === false, '4429: isOnline остался false (online не эмитился по open)');
  const [s2] = await c2;
  const gap1 = connTimes[1] - connTimes[0]; // ожидание: base 1s (+джиттер 0-10с)
  const c3 = waitFor(serverEvents, 'connection', 40000, 'conn3');
  s2.close(4429, 'too many connections');
  const [s3] = await c3;
  const gap2 = connTimes[2] - connTimes[1]; // ожидание: base 2s (+джиттер)
  console.log('    gap1=' + gap1 + 'ms gap2=' + gap2 + 'ms');
  ok(gap1 >= 900, '4429: первый реконнект не раньше базовой задержки 1с (' + gap1 + 'ms)');
  ok(gap2 >= 1900, '4429: backoff вырос (второй интервал >= 2с базы: ' + gap2 + 'ms)');

  console.log('== B. hello сбрасывает backoff ==');
  // на третьем соединении даём hello -> backoff должен сброситься к 1с
  const onlineP = waitFor(node, 'online', 3000, 'online');
  s3.send(JSON.stringify({ v: 1, type: 'hello' }));
  await onlineP;
  ok(node.isOnline === true, 'hello -> online');
  const c4 = waitFor(serverEvents, 'connection', 20000, 'conn4');
  s3.terminate();
  await c4;
  const gap3 = connTimes[3] - connTimes[2];
  console.log('    gap3=' + gap3 + 'ms');
  ok(gap3 < 11100, 'после hello backoff сброшен: реконнект в пределах 1с+джиттер10с (' + gap3 + 'ms)');
  const s4 = wss.clients.values().next().value;

  console.log('== C. command без payload при слушателе в стиле alice-device ==');
  s4.send(JSON.stringify({ v: 1, type: 'hello' }));
  await sleep(100);
  // слушатель точь-в-точь как в alice-device.ts:269
  node.on('dev-edge-1', (incomingStates) => {
    incomingStates.forEach(cap => {
      const capabIndex = cap.type + '.' + cap.state.instance;
      void capabIndex;
    });
  });
  uncaught = null;
  s4.send(JSON.stringify({ v: 1, type: 'command', reqId: 'r1', devId: 'dev-edge-1' })); // payload отсутствует
  await sleep(300);
  const crashNoPayload = uncaught;
  uncaught = null;
  s4.send(JSON.stringify({ v: 1, type: 'command', reqId: 'r2', devId: 'dev-edge-1', payload: { not: 'array' } }));
  await sleep(300);
  const crashObjPayload = uncaught;
  uncaught = null;
  s4.send(JSON.stringify({ v: 1, type: 'command', reqId: 'r3', devId: 'dev-edge-1', payload: [{ type: 'x' }] })); // элемент без state
  await sleep(300);
  const crashBadItem = uncaught;
  ok(!crashNoPayload, 'command без payload не роняет процесс' + (crashNoPayload ? ' [UNCAUGHT: ' + crashNoPayload.message + ']' : ''));
  ok(!crashObjPayload, 'command с payload-объектом не роняет процесс' + (crashObjPayload ? ' [UNCAUGHT: ' + crashObjPayload.message + ']' : ''));
  ok(!crashBadItem, 'command с битым элементом массива не роняет процесс' + (crashBadItem ? ' [UNCAUGHT: ' + crashBadItem.message + ']' : ''));
  // соединение живо: валидный кадр после битых доставляется
  const okCmdP = waitFor(node, 'dev-edge-1', 3000, 'valid command after bad ones');
  s4.send(JSON.stringify({ v: 1, type: 'command', reqId: 'r4', devId: 'dev-edge-1',
    payload: [{ type: 'devices.capabilities.on_off', state: { instance: 'on', value: true } }] }));
  const [okPayload] = await okCmdP;
  ok(Array.isArray(okPayload) && okPayload[0].state.instance === 'on',
     'валидный command после битых доставлен — соединение живо');
  ok(node.isOnline === true, 'битые кадры не порвали соединение (isOnline=true)');

  // корректное закрытие
  node.emit('close', () => {});
  await sleep(700);

  console.log('');
  console.log(failed === 0 ? 'EDGE TEST: ALL GREEN' : 'EDGE TEST: ' + failed + ' FAILURE(S)');
  wss.close();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('EDGE TEST ABORTED:', err.message);
  wss.close();
  process.exit(1);
});
