import { NodeAPI } from "node-red";
import axios from "axios";
import pjson from "../package.json";
import {
  AliceDeviceConfig,
  AliceDeviceNode,
  AliceServiceNode,
  CapabilityRegistration,
  CapabilityState,
  SensorRegistration,
  SensorState,
  DeviceConfig,
  DeviceStates
} from "./types.js";

export = (RED: NodeAPI): void => {
  function AliceDevice(this: AliceDeviceNode, config: AliceDeviceConfig): void {
    RED.nodes.createNode(this, config);
    const service = RED.nodes.getNode(config.service) as AliceServiceNode;
    service.setMaxListeners(service.getMaxListeners() + 1);

    this.initState = false;
    let updating = false;
    let needSendEvent = false;
    const capabilites: Record<string, string> = {};
    const sensors: Record<string, string> = {};

    const deviceconfig: DeviceConfig = {
      id: this.id,
      name: config.name,
      description: config.description,
      room: config.room,
      type: config.dtype,
      device_info: {
        manufacturer: "NodeRed Home",
        model: "virtual device",
        sw_version: pjson.version
      },
      capabilities: [],
      properties: []
    };

    const states: DeviceStates = {
      id: this.id,
      capabilities: [],
      properties: []
    };

    if (service.isOnline) {
      this.emit("online");
      this.initState = true;
    }

    // функция обновления информации об устройстве
    const _updateDeviceInfo = (): void => {
      if (deviceconfig.capabilities.length == 0 && deviceconfig.properties.length == 0) {
        this.debug("DELETE Device config from gateway ...");
        axios.request({
          timeout: 5000,
          method: 'POST',
          url: 'https://api.nodered-home.ru/gtw/device/config',
          headers: {
            'content-type': 'application/json',
            'Authorization': "Bearer " + service.getToken()
          },
          data: {
            id: this.id,
            config: deviceconfig
          }
        })
        .then(() => {
          this.trace("Device config deleted on gateway successfully");
        })
        .catch(error => {
          this.debug("Error when delete device config on gateway: " + error.message);
        });
        return;
      }

      if (!updating) {
        updating = true;
        setTimeout(() => {
          this.debug("Updating Device config ...");
          updating = false;
          axios.request({
            timeout: 5000,
            method: 'POST',
            url: 'https://api.nodered-home.ru/gtw/device/config',
            headers: {
              'content-type': 'application/json',
              'Authorization': "Bearer " + service.getToken()
            },
            data: {
              id: this.id,
              config: deviceconfig
            }
          })
          .then(() => {
            this.trace("Device config updated successfully");
          })
          .catch(error => {
            this.debug("Error when update device config: " + error.message);
          });
        }, 1000);
      }
    };

    // функция обновления состояния устройства (умений и сенсоров)
    const _updateDeviceState = (event: Record<string, any> | null = null): void => {
      axios.request({
        timeout: 5000,
        method: 'POST',
        url: 'https://state.nodered-home.ru/gtw/device/state',
        headers: {
          'content-type': 'application/json',
          'Authorization': "Bearer " + service.getToken()
        },
        data: {
          id: this.id,
          event: event,
          state: states
        }
      })
      .then(() => {
        this.trace("Device state updated successfully");
      })
      .catch(error => {
        this.debug("Error when update device state: " + error.message);
      });
    };

    // отправка эвентов
    const _sendEvent = (event: CapabilityState): void => {
      const data = JSON.stringify(event);
      service.send2gate('$me/device/events/' + this.id, data, false);
    };

    // Установка параметров умения
    this.setCapability = (capId: string, capab: CapabilityRegistration): Promise<boolean> => {
      return new Promise((resolve, reject) => {
        const instance = capab.parameters.instance || '';
        const capabIndex = capab.type + "." + instance;
        if (capabilites[capabIndex] && capabilites[capabIndex] != capId) {
          reject(new Error("Dublicated capability on same device!"));
          return;
        }
        // проверям было ли такое умение раньше и удаляем перед обновлением
        if (deviceconfig.capabilities.findIndex(a => a.id === capId) > -1) {
          this.delCapability(capId);
        }
        capabilites[capabIndex] = capId;
        capab.id = capId;
        deviceconfig.capabilities.push(capab);
        _updateDeviceInfo();
        resolve(true);
      });
    };

    // Установка параметров сенсора
    this.setSensor = (sensId: string, sensor: SensorRegistration): Promise<boolean> => {
      return new Promise((resolve, reject) => {
        const sensorIndex = sensor.type + "." + sensor.parameters.instance;
        if (sensors[sensorIndex] && sensors[sensorIndex] != sensId) {
          reject(new Error("Dublicated sensor on same device!"));
          return;
        }
        // проверяем было ли такой сенсор раньше и удаляем перед обновлением
        if (deviceconfig.properties.findIndex(a => a.id === sensId) > -1) {
          this.delSensor(sensId);
        }
        sensors[sensorIndex] = sensId;
        sensor.id = sensId;
        deviceconfig.properties.push(sensor);
        _updateDeviceInfo();
        resolve(true);
      });
    };

    // обновление текущего state умения
    this.updateCapabState = (capId: string, state: CapabilityState): Promise<boolean> => {
      return new Promise((resolve) => {
        state.id = capId;
        if (needSendEvent) {
          _sendEvent(state);
        }
        const index = states.capabilities.findIndex(a => a.id === capId);
        if (index > -1) {
          states.capabilities.splice(index, 1);
        }
        states.capabilities.push(state);
        const currentevent = {
          id: this.id,
          capabilities: [state]
        };
        _updateDeviceState(currentevent);
        resolve(true);
      });
    };

    // обновление текущего state сенсора
    this.updateSensorState = (sensID: string, state: SensorState): Promise<boolean> => {
      return new Promise((resolve) => {
        state.id = sensID;
        const index = states.properties.findIndex(a => a.id === sensID);
        if (index > -1) {
          states.properties.splice(index, 1);
        }
        states.properties.push(state);
        const currentevent = {
          id: this.id,
          properties: [state]
        };
        _updateDeviceState(currentevent);
        resolve(true);
      });
    };

    // удаление умения
    this.delCapability = (capId: string): Promise<boolean> => {
      return new Promise((resolve) => {
        const index = deviceconfig.capabilities.findIndex(a => a.id === capId);
        if (index > -1) {
          deviceconfig.capabilities.splice(index, 1);
        }
        const capabIndex = Object.keys(capabilites).find(key => capabilites[key] === capId);
        if (capabIndex) delete capabilites[capabIndex];
        _updateDeviceInfo();
        const stateindex = states.capabilities.findIndex(a => a.id === capId);
        if (stateindex > -1) {
          states.capabilities.splice(stateindex, 1);
        }
        _updateDeviceState();
        resolve(true);
      });
    };

    // удаление сенсора
    this.delSensor = (sensID: string): Promise<boolean> => {
      return new Promise((resolve) => {
        const index = deviceconfig.properties.findIndex(a => a.id === sensID);
        if (index > -1) {
          deviceconfig.properties.splice(index, 1);
        }
        const sensorIndex = Object.keys(sensors).find(key => sensors[key] === sensID);
        if (sensorIndex) delete sensors[sensorIndex];
        _updateDeviceInfo();
        const stateindex = states.properties.findIndex(a => a.id === sensID);
        if (stateindex > -1) {
          states.properties.splice(stateindex, 1);
        }
        _updateDeviceState();
        resolve(true);
      });
    };

    service.on("online", () => {
      this.debug("Received a signal online from the service");
      this.emit("online");
      this.initState = true;
    });

    service.on("offline", () => {
      this.debug("Received a signal offline from the service");
      this.emit("offline");
      this.initState = false;
      this.status({ fill: "red", shape: "dot", text: "offline" });
    });

    service.on(this.id, (incomingStates: any[]) => {
      setTimeout(() => {
        needSendEvent = false;
      }, 2000);
      needSendEvent = true;
      incomingStates.forEach(cap => {
        let capabIndex = cap.type + "." + cap.state.instance;
        if (cap.type === "devices.capabilities.color_setting") {
          capabIndex = cap.type + ".";
        }
        const capId = capabilites[capabIndex];
        this.emit(capId, cap.state.value, cap.state);
      });
    });

    this.on('close', (removed: boolean, done: () => void) => {
      this.emit('offline');
      if (removed) {
        deviceconfig.capabilities = [];
        deviceconfig.properties = [];
        states.capabilities = [];
        states.properties = [];
        _updateDeviceState();
        _updateDeviceInfo();
      }
      setTimeout(() => {
        done();
      }, 500);
    });
  }

  RED.nodes.registerType("alice-device", AliceDevice);
};
