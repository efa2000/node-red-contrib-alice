# Протокольные smoke-тесты WS-транспорта (v3.0.0)

Тесты ноды `alice-service` против локального мок-сервера (порт 18080, протокол v1
из `MIGRATION-IOT-CORE.md` корня NodeRedHome). Нода инстанцируется из
скомпилированного `nodes/alice.js` через фейковый RED, эндпоинт подменяется
переменной `ALICE_WS_URL`.

Запуск (после `npm run build` в корне плагина):

```bash
node test/ws-smoke/smoke.js             # базовый протокол: Bearer, hello→online, command→emit, send2gate→command_result, реконнект, close
node test/ws-smoke/smoke-401.js         # HTTP 401 на upgrade → error «переавторизуйтесь» + реконнект без сброса backoff
node test/ws-smoke/smoke-edge.js        # 4429, битые payload команды (не роняют процесс), backoff растёт
node test/ws-smoke/smoke-hang.js        # молчащий upgrade → handshakeTimeout 15с → реконнект
node test/ws-smoke/smoke-throw-after.js # исключение в слушателе не убивает обработку кадров
node test/ws-smoke/smoke-close.js       # close ноды: done() по фактическому закрытию, redeploy без 4429, failsafe 1.5с
```

Все 6 зелёные на момент коммита v3.0.0 (2026-07-08, независимое ревью пройдено).

⚠️ Известный нюанс: путь обработки 401 опирается на контракт `ws@8` — при
наличии слушателя `unexpected-response` библиотека НЕ эмитит `error`/`close`,
поэтому `alice.ts` там вручную делает `req.destroy()` + планирует реконнект.
При апгрейде на `ws@9+` перепроверить этот путь (`smoke-401.js` это поймает).
