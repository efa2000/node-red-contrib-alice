# NodeRed Home (node-red-contrib-alice)

[![platform](https://img.shields.io/badge/platform-Node--RED-red?logo=nodered)](https://nodered.org)
[![Min Node Version](https://img.shields.io/node/v/node-red-contrib-alice.svg)](https://nodejs.org/en/)
![Repo size](https://img.shields.io/github/repo-size/efa2000/node-red-contrib-alice)
[![GitHub version](https://img.shields.io/github/package-json/v/efa2000/node-red-contrib-alice?logo=npm)](https://www.npmjs.com/package/node-red-contrib-alice)
[![Package Quality](https://packagequality.com/shield/node-red-contrib-alice.svg)](https://packagequality.com/#?package=node-red-contrib-alice)
![GitHub last commit](https://img.shields.io/github/last-commit/efa2000/node-red-contrib-alice/master)
![NPM Total Downloads](https://img.shields.io/npm/dt/node-red-contrib-alice.svg)
![NPM Downloads per month](https://img.shields.io/npm/dm/node-red-contrib-alice)
[![issues](https://img.shields.io/github/issues/efa2000/node-red-contrib-alice?logo=github)](https://github.com/efa2000/node-red-contrib-alice/issues)

**NodeRed Home** (node-red-contrib-alice) - это бесплатный сервис который позволит, в несколько простых шагов, подключить любые ваши устройства заведенные в Node-RED к умному дому от Яндекса и управлять ими с помощью голосового помощника Алиса.

## ВАЖНО !!!! В связи с необходимостью перезда и обновления сервиса, с 28-го марта его работа была преостановлена, до 11-го апреля (возможно раньше) будет запущенна общедоступная новая версия 
#### Для тех кто оформил добровольную подписку доступен ранний доступ к новой версии. Инструкция по переходу здесь. [https://boosty.to/efa2000/posts/8c64ea4d-949a-4d18-b9c2-ecea3c1229e8](https://boosty.to/efa2000/posts/8c64ea4d-949a-4d18-b9c2-ecea3c1229e8?share=post_link)

#### Этот некоммерческий проект, но Вы можете добровльно поддержать его развитие оформив подписку [https://boosty.to/efa2000](https://boosty.to/efa2000)

#### Обсудить и получить поддержку от сообщества и автора можно в Телеграм канале [https://t.me/nodered_home_chat](https://t.me/nodered_home_chat)

## Инструкция (RUS)
### Использование 
#### Как настроить навык:
1. Установите и настройте Node-Red
2. Из интерфейса Node-Red добавьте модуль node-red-contrib-alice или с использованием npm
```
npm install node-red-contrib-alice
```
3. Добавьте в свою схему устройства и умения Алисы и зарегистрируйтесь на вкладке настройки 
4. Настройте их связь с вашими устройствами
5. В приложении Яндекс добавьте навык NodeRed Home
6. Заведенные устройства появятся автоматически

### Концепция
Кождое устройство может иметь неограниченное число умений (функционала)
К примеру, лампочка может иметь умение включения/выклюяения, но так же дополнительное умение установки цвета и яркости 
Умения устройства можно объеденять в любом порядке 
Более подробно о умениях и устройствах можно почитать в документации Yandex [Документация Яндекса](https://yandex.ru/dev/dialogs/alice/doc/smart-home/concepts/capability-types-docpage/)

### Особенности
Для того, что бы устройство ответило Алисе, что комманда выполнена успешно, на вход должно прийти соответсвующее значение.
Если ваше устройство отвечает дольше или совсем не возвращает подтверждение просто добавьте оставьте галочку Response включенной


## Instruction (ENG - Google Translate)
The module allows you to use Node-Red together with the Yandex.Alice voice assistant service (voice control of smart home devices)

### Use
#### How to set up a skill:
1. Install and configure Node-Red
2. From the Node-Red interface add the node-red-contrib-alice module or using npm
```
npm install node-red-contrib-alice
```
3. Add Alice’s devices and capability to your circuit and register on the settings tab
4. Configure their connection with your devices
5. In the Yandex application, add the NodeRed Home skill
6. Started devices will appear automatically

### Concept
Each device can have an unlimited number of capability (functionality)
For example, a light bulb may have the capability to turn on / off, but also the additional capability to set the color and brightness
Device capabilites can be combined in any order
You can read more about capability and devices in the Yandex documentation [Yandex Documentation] (https://yandex.ru/dev/dialogs/alice/doc/smart-home/concepts/capability-types-docpage/)
