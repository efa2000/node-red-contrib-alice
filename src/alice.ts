import { NodeAPI } from "node-red";
import axios from "axios";
import WebSocket from "ws";
import { AliceServiceConfig, AliceServiceNode } from "./types.js";

// Адрес WebSocket-шлюза. Для отладки и тестов можно переопределить
// через переменную окружения ALICE_WS_URL.
const WS_URL = process.env.ALICE_WS_URL || "wss://ws.nodered-home.ru/v1/ws";

// Реконнект: экспоненциальный backoff от 1 до 60 секунд (×2) + джиттер 0–10 секунд
const RECONNECT_MIN_MS = 1000;
const RECONNECT_MAX_MS = 60000;
const RECONNECT_JITTER_MS = 10000;

// Watchdog: сервер шлёт ping каждые 30 секунд; если ~90 секунд нет ни ping,
// ни сообщений — считаем соединение мёртвым и рвём его сами
const WATCHDOG_TIMEOUT_MS = 90000;

// Таймаут WS-хендшейка: если сервер принял TCP, но не ответил на upgrade,
// библиотека ws сама эмитит error+close — дальше штатный реконнект
const HANDSHAKE_TIMEOUT_MS = 15000;

// Failsafe при закрытии ноды: если сервер не завершил close-хендшейк
// за это время — рвём сокет и отпускаем done()
const CLOSE_FAILSAFE_MS = 1500;

// Кадр протокола WS-шлюза (JSON text frame)
interface GateFrame {
  v?: number;
  type?: string;
  reqId?: string;
  devId?: string;
  payload?: unknown;
  text?: string;
}

export = (RED: NodeAPI): void => {
  function AliceService(this: AliceServiceNode, config: AliceServiceConfig): void {
    RED.nodes.createNode(this, config);
    this.debug("Starting Alice service... ID: " + this.id);

    const email = this.credentials.email;
    const token = this.credentials.token;

    //вызов для удаления всех устройств
    const suburl = Buffer.from(email).toString('base64');
    RED.httpAdmin.get("/noderedhome/" + suburl + "/clearalldevice", (_req, res) => {
      axios.request({
        method: 'POST',
        url: 'https://api.nodered-home.ru/gtw/device/clearallconfigs',
        headers: {
          'content-type': 'application/json',
          'Authorization': "Bearer " + this.getToken()
        },
        data: {}
      })
      .then(() => {
        this.trace("All devices configs deleted on gateway successfully");
        res.sendStatus(200);
      })
      .catch(error => {
        this.debug("Error when delete All devices configs deleted on gateway: " + error.message);
        res.sendStatus(500);
      });
    });

    RED.httpAdmin.get("/noderedhome/" + this.id + "/getfullconfig", (_req, res) => {
      axios.request({
        method: 'GET',
        url: 'https://api.iot.yandex.net/v1.0/user/info',
        headers: {
          'content-type': 'application/json',
          'Authorization': "Bearer " + this.getToken()
        }
      })
      .then(result => {
        this.trace("Full Alice SmartHome config successfully retrieved");
        res.json(result.data);
      })
      .catch(error => {
        this.debug("Error when retrieve Alice SmartHome config: " + error.message);
        res.sendStatus(500);
      });
    });

    this.isOnline = false;

    if (!token) {
      this.error("Authentication is required!!!");
      return;
    }

    // Токен хранится как JSON-строка OAuth-ответа Яндекса
    let accessToken: string;
    try {
      accessToken = JSON.parse(token).access_token;
      if (!accessToken) {
        throw new Error("access_token is empty");
      }
    } catch (_err) {
      this.error("Authentication token is corrupted, please re-authenticate in node settings!!!");
      return;
    }

    // ---------- WebSocket-транспорт (замена MQTT / Yandex IoT Core) ----------

    let ws: WebSocket | null = null;          // текущее соединение
    let closing = false;                      // нода закрывается — реконнект запрещён
    let reconnectDelay = RECONNECT_MIN_MS;    // текущая база backoff
    let reconnectTimer: NodeJS.Timeout | null = null;
    let watchdogTimer: NodeJS.Timeout | null = null;

    const stopWatchdog = () => {
      if (watchdogTimer) {
        clearTimeout(watchdogTimer);
        watchdogTimer = null;
      }
    };

    // Любая активность от сервера (ping или сообщение) сбрасывает watchdog
    const resetWatchdog = () => {
      stopWatchdog();
      watchdogTimer = setTimeout(() => {
        watchdogTimer = null;
        this.debug("WS watchdog: no activity for " + WATCHDOG_TIMEOUT_MS + "ms, terminating connection");
        if (ws) {
          ws.terminate(); // событие close запустит обычный реконнект
        }
      }, WATCHDOG_TIMEOUT_MS);
    };

    const scheduleReconnect = () => {
      if (closing || reconnectTimer) {
        return;
      }
      const delay = reconnectDelay + Math.floor(Math.random() * RECONNECT_JITTER_MS);
      reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_MS);
      this.debug("WS reconnect scheduled in " + delay + "ms");
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, delay);
    };

    const connect = () => {
      if (closing) {
        return;
      }
      this.debug("Connecting to WS gateway: " + WS_URL);
      const socket = new WebSocket(WS_URL, {
        headers: { Authorization: "Bearer " + accessToken },
        handshakeTimeout: HANDSHAKE_TIMEOUT_MS
      });
      ws = socket;

      socket.on("open", () => {
        // online эмитим не здесь, а по кадру hello: сервер может закрыть
        // уже открытое соединение кодом 4429 (превышен лимит подключений)
        this.debug("WS connection opened, waiting for hello");
        resetWatchdog();
      });

      // Стандартный WS ping от сервера (pong библиотека ws шлёт сама)
      socket.on("ping", () => {
        resetWatchdog();
      });

      socket.on("message", (raw) => {
        resetWatchdog();
        let frame: GateFrame;
        try {
          frame = JSON.parse(raw.toString());
        } catch (_err) {
          this.warn("WS: invalid JSON frame ignored");
          return;
        }
        if (!frame || typeof frame !== "object") {
          this.warn("WS: unexpected frame ignored");
          return;
        }
        switch (frame.type) {
          case "hello":
            // Подтверждение авторизации — только теперь считаем себя онлайн
            this.debug("WS gateway connected (hello received)");
            reconnectDelay = RECONNECT_MIN_MS; // успешный коннект — сбрасываем backoff
            this.emit('online');
            break;
          case "command":
            // payload — массив capability-объектов, как раньше в MQTT-топике команд
            this.trace("Incoming command devId:" + frame.devId + " timestamp:" + new Date().getTime());
            if (!Array.isArray(frame.payload)) {
              this.warn("WS: command frame without payload array ignored. devId:" + frame.devId);
              return;
            }
            if (frame.devId) {
              // исключение в слушателе не должно убивать обработку кадров на сокете
              try {
                this.emit(String(frame.devId), frame.payload);
              } catch (err) {
                this.warn("WS: command listener error: " + (err instanceof Error ? err.message : String(err)));
              }
            }
            break;
          case "message":
            // Служебное сообщение от шлюза (замена message-топика)
            if (typeof frame.text === "string") {
              this.warn(frame.text);
            } else {
              this.trace("WS: message frame without text ignored");
            }
            break;
          default:
            this.trace("WS: unknown frame type ignored: " + frame.type);
        }
      });

      // Сервер отверг подключение на этапе upgrade (не 101)
      socket.on("unexpected-response", (req, res) => {
        stopWatchdog();
        if (res.statusCode === 401) {
          this.error("WS gateway rejected token (401): токен недействителен, переавторизуйтесь в настройках ноды");
        } else {
          this.debug("WS unexpected server response: HTTP " + res.statusCode);
        }
        req.destroy();
        if (ws === socket) {
          ws = null;
        }
        this.emit('offline');
        scheduleReconnect(); // backoff не сбрасываем — продолжаем попытки
      });

      socket.on("error", (err) => {
        // за error всегда следует close — реконнект планируется там
        this.debug("WS error: " + err.message);
      });

      socket.on("close", (code, reason) => {
        stopWatchdog();
        if (code === 4429) {
          this.warn("WS gateway closed connection (4429): превышен лимит подключений — не более 5 на пользователя");
        }
        this.debug("WS connection closed. code:" + code + " reason:" + reason.toString());
        if (ws === socket) {
          ws = null;
        }
        this.emit('offline');
        scheduleReconnect();
      });
    };

    connect();

    this.on('offline', () => {
      this.isOnline = false;
    });

    this.on('online', () => {
      this.isOnline = true;
    });

    this.on('close', (done: () => void) => {
      closing = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      stopWatchdog();
      this.emit('offline');
      const socket = ws;
      ws = null;
      if (!socket || socket.readyState === WebSocket.CLOSED) {
        done();
        return;
      }
      // done() зовём по фактическому закрытию сокета: иначе при redeploy новая
      // нода коннектится раньше, чем сервер освободил слот, и ловит 4429
      let doneCalled = false;
      const finish = () => {
        if (!doneCalled) {
          doneCalled = true;
          done();
        }
      };
      socket.once('close', finish);
      try {
        socket.close(1000);
      } catch (_err) {
        socket.terminate();
      }
      // страховка: если сервер не завершил close-хендшейк — рвём сокет и отпускаем done
      setTimeout(() => {
        if (socket.readyState !== WebSocket.CLOSED) {
          socket.terminate();
        }
        finish();
      }, CLOSE_FAILSAFE_MS).unref();
    });

    // Сигнатура сохранена для совместимости с alice-device:
    // path — старый MQTT-топик ($me/device/events/{devId}), retain не используется
    this.send2gate = (path: string, data: string, _retain: boolean) => {
      this.trace("Outgoing: " + path);
      const arrPath = path.split('/');
      const devId = arrPath[arrPath.length - 1];
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        // эквивалент MQTT publish с qos 0 в офлайне — молча дропаем
        this.debug("WS not connected, command_result dropped. devId:" + devId);
        return;
      }
      let payload: unknown;
      try {
        payload = JSON.parse(data);
      } catch (_err) {
        this.warn("send2gate: invalid JSON data ignored. devId:" + devId);
        return;
      }
      ws.send(JSON.stringify({ v: 1, type: "command_result", devId: devId, payload: payload }));
    };

    this.getToken = () => {
      return accessToken;
    };
  }

  RED.nodes.registerType("alice-service", AliceService, {
    credentials: {
      email: { type: "text" },
      password: { type: "password" },
      token: { type: "password" },
      id: { type: "text" }
    }
  });
};
