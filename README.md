# NodeRed Home (node-red-contrib-alice)

[![platform](https://img.shields.io/badge/platform-Node--RED-red?logo=nodered)](https://nodered.org)
[![Min Node Version](https://img.shields.io/node/v/node-red-contrib-alice.svg)](https://nodejs.org/en/)
[![GitHub version](https://img.shields.io/github/package-json/v/efa2000/node-red-contrib-alice?logo=npm)](https://www.npmjs.com/package/node-red-contrib-alice)
![NPM Total Downloads](https://img.shields.io/npm/dt/node-red-contrib-alice.svg)
![NPM Downloads per month](https://img.shields.io/npm/dm/node-red-contrib-alice)

Интеграция Node-RED с умным домом Яндекса. Подключите любые устройства из Node-RED к Алисе и управляйте ими голосом.

Integration of Node-RED with Yandex Smart Home. Connect any device from Node-RED to Alice voice assistant.

**Telegram:** [https://t.me/nodered_home_chat](https://t.me/nodered_home_chat) — поддержка и обсуждение / support & discussion

**Сайт / Website:** [https://nodered-home.ru](https://nodered-home.ru)

---

## ⚠️ Обновитесь до версии 3.x до 1 ноября 2026

Яндекс закрывает сервис **Yandex IoT Core**, через который версии 2.x получали команды Алисы (MQTT):

- **1 ноября 2026** — голосовые команды («Алиса, включи свет») и управление из приложения **перестанут работать** на версиях 2.x. Отправка состояний и датчиков продолжит работать.
- **1 декабря 2026** — Yandex IoT Core отключается: с этого момента полноценно работают **только версии 3.0.0 и новее**.

Начиная с **версии 3.0.0** плагин не зависит от IoT Core: команды доставляются по WebSocket (`wss://ws.nodered-home.ru`, исходящее подключение на стандартный порт 443 вместо 8883 — проще за файрволами и прокси).

**Как обновиться** — прямо из интерфейса Node-RED: меню → **Управление палитрой** (Manage palette) → вкладка **Ноды** → найдите `node-red-contrib-alice` → кнопка **Обновить**, затем перезапустите Node-RED.

Альтернатива через npm:

```
cd ~/.node-red
npm install node-red-contrib-alice@latest
```

Флоу, настройки и авторизация сохраняются — переавторизация и перенастройка устройств **не требуются**.

Бонус: теперь можно подключать несколько инстансов Node-RED под одним аккаунтом (до 5 одновременных подключений) — в MQTT-версии они конфликтовали.

---

## Быстрый старт

1. Установите Node-RED ([инструкция](https://nodered.org/docs/getting-started/))
2. Установите модуль из палитры Node-RED или через npm:
   ```
   npm install node-red-contrib-alice
   ```
3. Перетащите на рабочую область ноду **alice-device** и нужные умения (on/off, range, color, mode и т.д.)
4. Откройте настройки ноды alice-device, нажмите «Зарегистрироваться» — авторизуйтесь через Яндекс
5. Соедините умения с вашими устройствами в Node-RED
6. В приложении «Дом с Алисой» добавьте навык **NodeRed Home** — устройства появятся автоматически

## Концепция

Каждое устройство в Node-RED состоит из:
- **alice-device** — само устройство (лампочка, розетка, кондиционер и т.д.)
- **Умения** — функции устройства, которые подключаются к alice-device:
  - **on_off** — включение/выключение
  - **range** — числовые параметры (яркость, громкость, температура)
  - **color** — управление цветом
  - **mode** — режимы работы (скорость вентилятора, режим кондиционера)
  - **toggle** — переключатели (пауза, беззвучный режим)
  - **sensor** — датчики (температура, влажность, CO2)
  - **event** — события (открытие двери, движение)
  - **video** — видеопоток

Умения можно комбинировать в любом порядке. Например, лампочка = on_off + range (яркость) + color.

Подробнее об устройствах и умениях: [документация Яндекса](https://yandex.ru/dev/dialogs/alice/doc/smart-home/concepts/capability-types-docpage/)

## Подтверждение команд

Когда Алиса отправляет команду, устройство должно вернуть подтверждение (отправить значение на вход ноды умения). Если ваше устройство не отвечает или отвечает медленно — включите опцию **Response** в настройках умения, и подтверждение будет отправлено автоматически.

## Тарифы

- До 4 устройств — **бесплатно**
- 5 и более устройств — **299 руб./мес.**

---

## ⚠️ Update to version 3.x before November 1, 2026

Yandex is shutting down **Yandex IoT Core**, the MQTT service that versions 2.x rely on for receiving Alice commands:

- **November 1, 2026** — voice commands and app control **will stop working** on 2.x. Sending states and sensor data will keep working.
- **December 1, 2026** — Yandex IoT Core shuts down: from that point on, **only versions 3.0.0 and newer** work fully.

Starting with **version 3.0.0** the plugin no longer depends on IoT Core: commands are delivered over WebSocket (`wss://ws.nodered-home.ru`, outgoing connection on standard port 443 instead of 8883 — friendlier to firewalls and proxies).

**How to update** — right from the Node-RED editor: menu → **Manage palette** → **Nodes** tab → find `node-red-contrib-alice` → click **Update**, then restart Node-RED.

Alternatively via npm:

```
cd ~/.node-red
npm install node-red-contrib-alice@latest
```

Flows, settings and authorization are preserved — **no re-authentication or device reconfiguration required**.

Bonus: you can now connect several Node-RED instances under one account (up to 5 simultaneous connections) — MQTT versions conflicted with each other.

---

## Quick Start

1. Install Node-RED ([guide](https://nodered.org/docs/getting-started/))
2. Install the module from the Node-RED palette or via npm:
   ```
   npm install node-red-contrib-alice
   ```
3. Drag an **alice-device** node and the desired capability nodes (on/off, range, color, mode, etc.) onto your flow
4. Open the alice-device settings, click "Register" and sign in with your Yandex account
5. Wire the capability nodes to your devices in Node-RED
6. In the Yandex "Home with Alice" app, add the **NodeRed Home** skill — your devices will appear automatically

## Concept

Each device in Node-RED consists of:
- **alice-device** — the device itself (light, switch, AC, etc.)
- **Capabilities** — device functions connected to alice-device:
  - **on_off** — turn on/off
  - **range** — numeric parameters (brightness, volume, temperature)
  - **color** — color control
  - **mode** — operating modes (fan speed, AC mode)
  - **toggle** — toggles (mute, pause)
  - **sensor** — sensors (temperature, humidity, CO2)
  - **event** — events (door open, motion detected)
  - **video** — video stream

Capabilities can be combined in any order. For example, a light = on_off + range (brightness) + color.

More about devices and capabilities: [Yandex documentation](https://yandex.ru/dev/dialogs/alice/doc/smart-home/concepts/capability-types-docpage/)

## Command Confirmation

When Alice sends a command, the device must return a confirmation (send a value to the capability node input). If your device does not respond or responds slowly, enable the **Response** option in the capability settings — the confirmation will be sent automatically.

## Pricing

- Up to 4 devices — **free**
- 5 or more devices — **299 RUB/month**
