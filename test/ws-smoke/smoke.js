/**
 * Протокольный smoke-тест WS-транспорта node-red-contrib-alice (nodes/alice.js).
 *
 * Поднимает локальный WS-сервер (порт 18080, путь /v1/ws, проверка Bearer),
 * инстанцирует скомпилированную ноду с фейковым RED и проверяет:
 *  1) коннект с Bearer-заголовком;
 *  2) hello -> emit('online');
 *  3) command -> emit(devId, payload);
 *  4) send2gate -> корректный кадр command_result на сервере;
 *  5) реконнект после обрыва соединения сервером;
 *  6) close-процедуру ноды (код 1000, без реконнекта после закрытия).
 */
'use strict';

const PLUGIN_DIR = '/home/efa/projects/NodeRedHome/node-red-contrib-alice';
process.env.ALICE_WS_URL = 'ws://127.0.0.1:18080/v1/ws';

const { EventEmitter } = require('events');
const { WebSocketServer } = require(PLUGIN_DIR + '/node_modules/ws');

const TOKEN = 'test-access-token-123';

// ---------- утилиты ----------
let failed = 0;
function ok(cond, name) {
  if (cond) {
    console.log('  PASS: ' + name);
  } else {
    failed++;
    console.log('  FAIL: ' + name);
  }
}
function waitFor(emitter, event, timeoutMs, label) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout waiting for ' + label)), timeoutMs);
    emitter.once(event, (...args) => { clearTimeout(t); resolve(args); });
  });
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ---------- локальный WS-сервер ----------
const serverEvents = new EventEmitter(); // 'connection', 'frame'
let connCount = 0;

const wss = new WebSocketServer({
  port: 18080,
  path: '/v1/ws',
  verifyClient: (info) => info.req.headers.authorization === 'Bearer ' + TOKEN
});

wss.on('connection', (sock, req) => {
  connCount++;
  serverEvents.emit('connection', sock, req);
  sock.on('message', (raw) => {
    let frame = null;
    try { frame = JSON.parse(raw.toString()); } catch (_e) { /* игнор */ }
    serverEvents.emit('frame', frame, sock);
  });
});

// ---------- фейковый RED и нода ----------
let nodeConstructor = null;
const fakeRED = {
  nodes: {
    createNode: () => {},
    registerType: (name, ctor) => { nodeConstructor = ctor; }
  },
  httpAdmin: { get: () => {} }
};

require(PLUGIN_DIR + '/nodes/alice.js')(fakeRED);

function makeFakeNode() {
  const node = new EventEmitter();
  node.id = 'service-node-1';
  node.credentials = {
    email: 'test@example.com',
    id: 'yandex-user-id',
    password: 'unused',
    token: JSON.stringify({ access_token: TOKEN, token_type: 'bearer' })
  };
  node.debug = (m) => console.log('    [node.debug]', m);
  node.trace = (m) => console.log('    [node.trace]', m);
  node.warn  = (m) => console.log('    [node.warn ]', m);
  node.error = (m) => console.log('    [node.error]', m);
  node.log   = (m) => console.log('    [node.log  ]', m);
  node.status = () => {};
  return node;
}

// ---------- сценарий ----------
async function main() {
  console.log('== 1. Коннект с Bearer + hello -> online ==');
  const node = makeFakeNode();

  const connP = waitFor(serverEvents, 'connection', 5000, 'first connection');
  nodeConstructor.call(node, { id: 'service-node-1', name: 'test' });
  ok(nodeConstructor !== null, 'registerType перехвачен, конструктор вызван');
  ok(node.getToken() === TOKEN, 'getToken() возвращает access_token');
  ok(node.isOnline === false, 'isOnline=false до hello');

  const [sock1, req1] = await connP;
  ok(req1.headers.authorization === 'Bearer ' + TOKEN, 'заголовок Authorization: Bearer корректен');

  const onlineP = waitFor(node, 'online', 3000, 'online after hello');
  sock1.send(JSON.stringify({ v: 1, type: 'hello' }));
  await onlineP;
  ok(node.isOnline === true, 'hello -> emit online, isOnline=true');

  console.log('== 2. command -> emit(devId, payload) ==');
  const payload = [{ type: 'devices.capabilities.on_off', state: { instance: 'on', value: true } }];
  const cmdP = waitFor(node, 'dev42', 3000, 'emit dev42');
  sock1.send(JSON.stringify({ v: 1, type: 'command', reqId: 'req-uuid-1', devId: 'dev42', payload: payload }));
  const [gotPayload] = await cmdP;
  ok(Array.isArray(gotPayload) && gotPayload.length === 1, 'payload — массив из 1 элемента');
  ok(gotPayload[0].type === 'devices.capabilities.on_off'
     && gotPayload[0].state.instance === 'on'
     && gotPayload[0].state.value === true, 'payload доставлен без искажений');

  // Неизвестный тип кадра и битый JSON не должны ничего ломать
  const warns = [];
  const origWarn = node.warn;
  node.warn = (m) => { warns.push(m); origWarn(m); };
  sock1.send(JSON.stringify({ v: 1, type: 'totally_unknown' }));
  sock1.send('{broken json');
  sock1.send(JSON.stringify({ v: 1, type: 'message', text: 'служебное сообщение шлюза' }));
  sock1.send(JSON.stringify({ v: 1, type: 'message' })); // без text — warn быть не должно
  await sleep(200);
  ok(node.isOnline === true, 'неизвестные/битые кадры не рвут соединение');
  ok(warns.includes('служебное сообщение шлюза'), 'message с text -> warn с текстом');
  ok(!warns.some(w => w === undefined), 'message без text не даёт warn(undefined)');
  node.warn = origWarn;

  console.log('== 3. send2gate -> command_result ==');
  const frameP = waitFor(serverEvents, 'frame', 3000, 'command_result frame');
  node.send2gate('$me/device/events/dev42',
    JSON.stringify({ type: 'devices.capabilities.on_off', state: { instance: 'on', value: true } }),
    false);
  const [frame] = await frameP;
  ok(frame && frame.v === 1, 'command_result: v=1');
  ok(frame.type === 'command_result', 'command_result: type');
  ok(frame.devId === 'dev42', 'command_result: devId из последнего сегмента path');
  ok(frame.payload && frame.payload.type === 'devices.capabilities.on_off'
     && frame.payload.state && frame.payload.state.instance === 'on'
     && frame.payload.state.value === true, 'command_result: payload — один capability-объект');

  console.log('== 4. Реконнект после обрыва ==');
  const offlineP = waitFor(node, 'offline', 3000, 'offline after terminate');
  const reconnP = waitFor(serverEvents, 'connection', 15000, 'reconnect'); // backoff 1с + джиттер 0-10с
  const countBefore = connCount;
  sock1.terminate();
  await offlineP;
  ok(node.isOnline === false, 'обрыв -> offline, isOnline=false');
  const [sock2] = await reconnP;
  ok(connCount === countBefore + 1, 'клиент переподключился (новое соединение)');
  const online2P = waitFor(node, 'online', 3000, 'online after reconnect hello');
  sock2.send(JSON.stringify({ v: 1, type: 'hello' }));
  await online2P;
  ok(node.isOnline === true, 'после реконнекта снова online');

  // send2gate в офлайне не должен падать (проверим на закрытой ноде ниже)

  console.log('== 5. Close-процедура ноды ==');
  const srvCloseP = waitFor(sock2, 'close', 5000, 'server side close');
  let doneCalled = false;
  node.emit('close', () => { doneCalled = true; });
  const [closeCode] = await srvCloseP;
  await sleep(700); // done вызывается через 500мс
  ok(doneCalled, 'done() коллбек вызван');
  ok(closeCode === 1000, 'сокет закрыт кодом 1000 (получено: ' + closeCode + ')');
  ok(node.isOnline === false, 'после close нода offline');

  // send2gate после закрытия — молча дропает, не бросает
  let threw = false;
  try { node.send2gate('$me/device/events/dev42', '{"a":1}', false); } catch (_e) { threw = true; }
  ok(!threw, 'send2gate при закрытом сокете не бросает исключение');

  const countAfterClose = connCount;
  await sleep(3000);
  ok(connCount === countAfterClose, 'после close реконнекта нет (deliberate close)');

  console.log('');
  console.log(failed === 0 ? 'SMOKE TEST: ALL GREEN' : 'SMOKE TEST: ' + failed + ' FAILURE(S)');
  wss.close();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('SMOKE TEST ABORTED:', err.message);
  wss.close();
  process.exit(1);
});
