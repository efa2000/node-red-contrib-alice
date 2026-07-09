'use strict';
// После фикса: emit('command') обёрнут в try/catch — исключение слушателя
// (битый элемент payload) не даёт uncaughtException и не убивает обработку
// кадров на сокете: следующие кадры доходят.
const PLUGIN_DIR = '/home/efa/projects/NodeRedHome/node-red-contrib-alice';
process.env.ALICE_WS_URL = 'ws://127.0.0.1:18084/v1/ws';
const { EventEmitter } = require('events');
const { WebSocketServer } = require(PLUGIN_DIR + '/node_modules/ws');
let uncaught = 0;
process.on('uncaughtException', (e) => { uncaught++; console.log('  [uncaught] ' + e.message); });

const wss = new WebSocketServer({ port: 18084, path: '/v1/ws' });
let nodeConstructor = null;
require(PLUGIN_DIR + '/nodes/alice.js')({
  nodes: { createNode: () => {}, registerType: (n, c) => { nodeConstructor = c; } },
  httpAdmin: { get: () => {} }
});
const node = new EventEmitter();
node.id = 's'; node.credentials = { email: 'a@b.c', id: 'u', password: '', token: JSON.stringify({ access_token: 'x' }) };
for (const m of ['debug','trace','error','log']) node[m] = () => {};
const warns = [];
node.warn = (t) => { warns.push(String(t)); console.log('  [warn] ' + t); };
node.status = () => {};
let after = false;
node.on('devX', (arr) => {
  if (arr[0] && arr[0].probe) { after = true; return; }
  arr.forEach(c => c.state.instance); // бросает на элементе без state
});

wss.on('connection', async (sock) => {
  sock.send(JSON.stringify({ v:1, type:'hello' }));
  await new Promise(r => setTimeout(r, 100));
  sock.send(JSON.stringify({ v:1, type:'command', devId:'devX', payload:[{ type:'x' }] })); // слушатель бросит TypeError
  await new Promise(r => setTimeout(r, 200));
  sock.send(JSON.stringify({ v:1, type:'command', devId:'devX', payload:[{ probe: true }] }));
  sock.send(JSON.stringify({ v:1, type:'message', text:'ещё жив?' }));
  await new Promise(r => setTimeout(r, 400));
  const caught = warns.some(w => w.includes('command listener error'));
  const alive = warns.some(w => w.includes('ещё жив?'));
  const pass = after && alive && caught && uncaught === 0;
  console.log(pass
    ? 'RESULT: OK — исключение слушателя поймано (warn), кадры после него ОБРАБАТЫВАЮТСЯ, uncaughtException нет'
    : 'RESULT: FAIL — after=' + after + ' alive=' + alive + ' caught=' + caught + ' uncaught=' + uncaught);
  node.emit('close', () => {});
  setTimeout(() => { wss.close(); process.exit(pass ? 0 : 1); }, 800);
});
nodeConstructor.call(node, { id: 's', name: 't' });
