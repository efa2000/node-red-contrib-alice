/**
 * Тест close-процедуры ноды после фикса (done() по фактическому закрытию сокета):
 *  A) обычный close: done() вызывается ровно один раз, ПОСЛЕ того как сервер
 *     увидел закрытие соединения (close-хендшейк завершён), код 1000;
 *  B) redeploy-паттерн при лимите 1 коннект на пользователя: close старой ноды ->
 *     (в done) сразу создание новой -> новая коннектится БЕЗ 4429 и получает hello;
 *  C) failsafe: сервер завершил upgrade, но игнорирует close-фрейм -> done()
 *     приходит по failsafe-таймеру (~1500мс), ровно один раз;
 *  D) сокета нет (коннект отвалился, идёт backoff) -> done() сразу.
 */
'use strict';

const PLUGIN_DIR = '/home/efa/projects/NodeRedHome/node-red-contrib-alice';
const PORT = 18085;
process.env.ALICE_WS_URL = 'ws://127.0.0.1:' + PORT + '/v1/ws';

const net = require('net');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const { WebSocketServer } = require(PLUGIN_DIR + '/node_modules/ws');

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

let nodeConstructor = null;
require(PLUGIN_DIR + '/nodes/alice.js')({
  nodes: { createNode: () => {}, registerType: (n, c) => { nodeConstructor = c; } },
  httpAdmin: { get: () => {} }
});

function makeFakeNode(id) {
  const node = new EventEmitter();
  node.id = id;
  node.credentials = { email: 't@e.com', id: 'uid', password: '', token: JSON.stringify({ access_token: 'x' }) };
  node.warns = [];
  for (const m of ['debug', 'trace', 'error', 'log']) node[m] = () => {};
  node.warn = (t) => { node.warns.push(String(t)); };
  node.status = () => {};
  return node;
}

async function main() {
  console.log('== A. done() ровно один раз, после закрытия сокета ==');
  // сервер с лимитом 1 активное соединение на пользователя (модель шлюза)
  const serverEvents = new EventEmitter();
  const active = new Set();
  const wss = new WebSocketServer({ port: PORT, path: '/v1/ws' });
  wss.on('connection', (sock) => {
    if (active.size >= 1) {
      sock.close(4429, 'too many connections');
      return;
    }
    active.add(sock);
    sock.on('close', () => active.delete(sock));
    sock.send(JSON.stringify({ v: 1, type: 'hello' }));
    serverEvents.emit('connection', sock);
  });

  const node1 = makeFakeNode('svc-close-1');
  const conn1P = waitFor(serverEvents, 'connection', 5000, 'conn1');
  nodeConstructor.call(node1, { id: 'svc-close-1', name: 't' });
  const [sock1] = await conn1P;
  await waitFor(node1, 'online', 3000, 'online1');

  let serverSawClose = false;
  let closeCode1 = 0;
  sock1.on('close', (code) => { serverSawClose = true; closeCode1 = code; });

  let done1Count = 0;
  let done1AfterServerClose = false;
  const done1P = new Promise((resolve) => {
    node1.emit('close', () => {
      done1Count++;
      done1AfterServerClose = serverSawClose;
      resolve();
    });
  });
  const tClose1 = Date.now();
  await done1P;
  const done1Ms = Date.now() - tClose1;
  ok(done1Count === 1, 'done() вызван');
  ok(done1AfterServerClose, 'done() вызван ПОСЛЕ того, как сервер увидел закрытие сокета');
  ok(closeCode1 === 1000, 'сокет закрыт кодом 1000 (получено: ' + closeCode1 + ')');
  console.log('    done через ' + done1Ms + 'мс после emit(close)');
  await sleep(2000); // > failsafe 1500мс — двойного done быть не должно
  ok(done1Count === 1, 'done() не вызван повторно (failsafe с guard)');

  console.log('== B. redeploy при лимите 1 коннект: без 4429 ==');
  // Node-RED создаёт новые ноды после done() старых — повторяем паттерн:
  // старый сокет уже закрыт (проверено в A), сразу создаём новую ноду
  const node2 = makeFakeNode('svc-close-2');
  const conn2P = waitFor(serverEvents, 'connection', 5000, 'conn2');
  nodeConstructor.call(node2, { id: 'svc-close-2', name: 't' });
  const [sock2] = await conn2P;
  await waitFor(node2, 'online', 3000, 'online2 (hello без 4429)');
  ok(node2.isOnline === true, 'новая нода online с первой попытки');
  ok(!node2.warns.some(w => w.includes('4429')), 'новая нода не получила 4429 (залипания слота нет)');

  // закрываем node2 и сервер сценариев A/B
  let done2Count = 0;
  const done2P = new Promise((resolve) => {
    node2.emit('close', () => { done2Count++; resolve(); });
  });
  await done2P;
  ok(done2Count === 1, 'close новой ноды: done() вызван один раз');
  void sock2;
  await new Promise(r => wss.close(r));

  console.log('== C. failsafe: сервер игнорирует close-фрейм ==');
  // сырой TCP-сервер: отвечает 101 на upgrade и дальше молчит (close-фрейм игнорирует)
  const rawSrv = net.createServer((sock) => {
    sock.on('error', () => {});
    let buf = '';
    sock.on('data', (chunk) => {
      if (buf === null) return; // upgrade уже сделан — игнорируем всё, включая close-фрейм
      buf += chunk.toString('latin1');
      if (buf.includes('\r\n\r\n')) {
        const m = /Sec-WebSocket-Key: (.+)\r\n/i.exec(buf);
        const accept = crypto.createHash('sha1')
          .update(m[1].trim() + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
        sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\n'
          + 'Connection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
        buf = null;
      }
    });
  });
  await new Promise(r => rawSrv.listen(PORT, r));

  const node3 = makeFakeNode('svc-close-3');
  nodeConstructor.call(node3, { id: 'svc-close-3', name: 't' });
  await sleep(500); // upgrade завершён, сокет OPEN (hello не придёт — и не нужен)
  let done3Count = 0;
  const t3 = Date.now();
  const done3P = new Promise((resolve) => {
    node3.emit('close', () => { done3Count++; resolve(); });
  });
  await done3P;
  const elapsed3 = Date.now() - t3;
  console.log('    done через ' + elapsed3 + 'мс после emit(close)');
  ok(done3Count === 1, 'done() вызван (сервер молчал)');
  ok(elapsed3 >= 1300 && elapsed3 <= 3000, 'done() пришёл по failsafe ~1500мс (' + elapsed3 + 'мс)');
  await sleep(1000);
  ok(done3Count === 1, 'done() не задвоился после failsafe+terminate');
  await new Promise(r => rawSrv.close(r));

  console.log('== D. сокета нет (идёт backoff после отказа) -> done() сразу ==');
  const node4 = makeFakeNode('svc-close-4');
  nodeConstructor.call(node4, { id: 'svc-close-4', name: 't' }); // сервер уже закрыт -> ECONNREFUSED
  await sleep(400); // error+close пришли, ws=null, ждём в backoff (>=1с)
  let done4Count = 0;
  const t4 = Date.now();
  node4.emit('close', () => { done4Count++; });
  await sleep(100);
  ok(done4Count === 1, 'done() вызван сразу, без сокета');
  ok(Date.now() - t4 <= 150, 'без ожиданий (было бы 500мс по старому коду)');

  console.log('');
  console.log(failed === 0 ? 'CLOSE TEST: ALL GREEN' : 'CLOSE TEST: ' + failed + ' FAILURE(S)');
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('CLOSE TEST ABORTED:', err.message);
  process.exit(1);
});
