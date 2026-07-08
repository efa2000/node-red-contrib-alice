/**
 * Дополнительный тест: невалидный токен -> HTTP 401 на upgrade.
 * Ожидание: node.error с понятным текстом + реконнект продолжается (backoff не сброшен).
 */
'use strict';

const PLUGIN_DIR = '/home/efa/projects/NodeRedHome/node-red-contrib-alice';
process.env.ALICE_WS_URL = 'ws://127.0.0.1:18081/v1/ws';

const { EventEmitter } = require('events');
const { WebSocketServer } = require(PLUGIN_DIR + '/node_modules/ws');

let failed = 0;
function ok(cond, name) {
  console.log((cond ? '  PASS: ' : (failed++, '  FAIL: ')) + name);
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

let upgradeAttempts = 0;
const wss = new WebSocketServer({
  port: 18081,
  path: '/v1/ws',
  verifyClient: (info) => { upgradeAttempts++; return false; } // всегда 401
});

let nodeConstructor = null;
const fakeRED = {
  nodes: { createNode: () => {}, registerType: (n, c) => { nodeConstructor = c; } },
  httpAdmin: { get: () => {} }
};
require(PLUGIN_DIR + '/nodes/alice.js')(fakeRED);

async function main() {
  const node = new EventEmitter();
  node.id = 'svc-401';
  node.credentials = {
    email: 'test@example.com', id: 'uid', password: 'x',
    token: JSON.stringify({ access_token: 'bad-token' })
  };
  const errors = [];
  node.debug = (m) => console.log('    [debug]', m);
  node.trace = () => {};
  node.warn = (m) => console.log('    [warn ]', m);
  node.error = (m) => { errors.push(String(m)); console.log('    [error]', m); };

  nodeConstructor.call(node, { id: 'svc-401', name: 't' });
  await sleep(500);
  ok(upgradeAttempts === 1, 'первая попытка upgrade выполнена');
  ok(errors.some(e => e.includes('401') && e.includes('переавторизуйтесь')),
     'node.error с понятным текстом про 401/переавторизацию');
  ok(node.isOnline === false, 'нода offline');

  // ждём вторую попытку (backoff 1с + джиттер до 10с)
  await sleep(12000);
  ok(upgradeAttempts >= 2, 'реконнект после 401 продолжается (попыток: ' + upgradeAttempts + ')');

  // закрываем ноду
  let done = false;
  node.emit('close', () => { done = true; });
  await sleep(700);
  ok(done, 'close-процедура отработала');

  console.log(failed === 0 ? '401 TEST: ALL GREEN' : '401 TEST: ' + failed + ' FAILURE(S)');
  wss.close();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error('ABORTED:', e.message); process.exit(1); });
