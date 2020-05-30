# Node-Red-Contrib-Alice (NodeRed Home)

## Инструкция (RUS)
Модуль позволяет использовать Node-Red совместно с сервисом голосового помошника Yandex.Alice (голосовое управление устройствами умного дома)

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
Для того, что бы устройство ответило Алисе, что комманда выполнена успешно, на вход должно прийти соответсвующее значение

!!! значение на вход должно прийти в течении 2,5 секунд в противном случае будет возвращен ответ, что устройство не доступно 

Если ваше устройство отвечает дольше или совсем не возвращает подтверждение просто добавьте функцию которая сразу будет передавать на вход, выходное значение 
![Simple device](https://github.com/efa2000/node-red-contrib-alice/blob/master/img/siple_dev.PNG?raw=true)

### Поддерживаемые устройства
Тип	| Описание | Пример устройства
---|---|---
devices.types.light	| Устройство, которое имеет управляемые светящиеся элементы. | Лампочка, светильник, ночник, люстра.
devices.types.socket | Розетка. | Умная розетка.
devices.types.switch | Выключатель. | Настенный выключатель света, тумблер, автомат в электрическом щитке, умное реле.
devices.types.thermostat | Устройство с возможностью регулирования температуры. | Водонагреватель, теплый пол, обогреватель, электровентилятор. Для кондиционера рекомендуется использовать отдельный тип devices.types.thermostat.ac.
devices.types.thermostat.ac | стройство, управляющее микроклиматом в помещении, с возможностью регулирования температуры и режима работы. | Кондиционер.
devices.types.media_device | Аудио, видео, мультимедиа техника. Устройства, которые умеют воспроизводить звук и видео. | DVD-плеер, ресивер, медиаприставка и другие медиаустройства. Для телевизора рекомендуется использовать отдельный тип devices.types.media_device.tv.
devices.types.media_device.tv | Устройство для просмотра видеоконтента. На устройстве можно изменять громкость и переключать каналы. | Умный телевизор, ИК-пульт от телевизора, медиа-приставка, ресивер.
devices.types.media_device.tv_box | Устройство, подключаемое к телевизору или дисплею, для просмотра видеоконтента. На устройстве можно управлять громкостью воспроизведения и переключать каналы. | ИК-пульт от тв-приставки, умная тв-приставка.
devices.types.media_device.receiver | Устройство, подключаемое к телевизору или дисплею, для просмотра видеоконтента. На устройстве можно изменять громкость, переключать каналы и источники аудио-/видеосигнала. | ИК-пульт от ресивера, AV-ресивер, спутниковый ресивер.
devices.types.cooking | Различная умная кухонная техника. | Холодильник, духовой шкаф, кофеварка, мультиварка. Для чайника рекомендуется использовать отдельный тип devices.types.cooking.kettle, для кофеварки — devices.types.cooking.coffee_maker.
devices.types.cooking.coffee_maker	| стройство, которое умеет делать кофе. | Кофеварка, кофемашина.
devices.types.cooking.kettle | Устройство, которое умеет кипятить воду и/или делать чай. | Умный чайник, термопот.
devices.types.openable | Устройство, которое умеет открываться и/или закрываться. | Дверь, ворота, окно, ставни. Для штор и жалюзи рекомендуется использовать отдельный тип devices.types.openable.curtain.
devices.types.openable.curtain | Устройство, которое выполняет функцию штор. | Шторы, жалюзи.
devices.types.humidifier | Устройство, которое умеет изменять влажность в помещении. | Увлажнитель воздуха.
devices.types.purifier | Устройство с функцией очистки воздуха. | Очиститель воздуха, мойка воздуха.
devices.types.vacuum_cleaner | Устройство, которое выполняет функцию пылесоса. | Робот-пылесос.
devices.types.washing_machine | Устройство для стирки белья. | Стиральная машина.
devices.types.other	Остальные устройства. | Остальные устройства, не подходящие под типы выше. | 

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
