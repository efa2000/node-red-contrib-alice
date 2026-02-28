"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const axios_1 = __importDefault(require("axios"));
const package_json_1 = __importDefault(require("../package.json"));
module.exports = (RED) => {
    function AliceDevice(config) {
        RED.nodes.createNode(this, config);
        const service = RED.nodes.getNode(config.service);
        service.setMaxListeners(service.getMaxListeners() + 1);
        this.initState = false;
        let updating = false;
        let needSendEvent = false;
        const capabilites = {};
        const sensors = {};
        const deviceconfig = {
            id: this.id,
            name: config.name,
            description: config.description,
            room: config.room,
            type: config.dtype,
            device_info: {
                manufacturer: "NodeRed Home",
                model: "virtual device",
                sw_version: package_json_1.default.version
            },
            capabilities: [],
            properties: []
        };
        const states = {
            id: this.id,
            capabilities: [],
            properties: []
        };
        if (service.isOnline) {
            this.emit("online");
            this.initState = true;
        }
        const _updateDeviceInfo = () => {
            if (deviceconfig.capabilities.length == 0 && deviceconfig.properties.length == 0) {
                this.debug("DELETE Device config from gateway ...");
                axios_1.default.request({
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
                    axios_1.default.request({
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
        const _updateDeviceState = (event = null) => {
            axios_1.default.request({
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
        const _sendEvent = (event) => {
            const data = JSON.stringify(event);
            service.send2gate('$me/device/events/' + this.id, data, false);
        };
        this.setCapability = (capId, capab) => {
            return new Promise((resolve, reject) => {
                const instance = capab.parameters.instance || '';
                const capabIndex = capab.type + "." + instance;
                if (capabilites[capabIndex] && capabilites[capabIndex] != capId) {
                    reject(new Error("Dublicated capability on same device!"));
                    return;
                }
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
        this.setSensor = (sensId, sensor) => {
            return new Promise((resolve, reject) => {
                const sensorIndex = sensor.type + "." + sensor.parameters.instance;
                if (sensors[sensorIndex] && sensors[sensorIndex] != sensId) {
                    reject(new Error("Dublicated sensor on same device!"));
                    return;
                }
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
        this.updateCapabState = (capId, state) => {
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
        this.updateSensorState = (sensID, state) => {
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
        this.delCapability = (capId) => {
            return new Promise((resolve) => {
                const index = deviceconfig.capabilities.findIndex(a => a.id === capId);
                if (index > -1) {
                    deviceconfig.capabilities.splice(index, 1);
                }
                const capabIndex = Object.keys(capabilites).find(key => capabilites[key] === capId);
                if (capabIndex)
                    delete capabilites[capabIndex];
                _updateDeviceInfo();
                const stateindex = states.capabilities.findIndex(a => a.id === capId);
                if (stateindex > -1) {
                    states.capabilities.splice(stateindex, 1);
                }
                _updateDeviceState();
                resolve(true);
            });
        };
        this.delSensor = (sensID) => {
            return new Promise((resolve) => {
                const index = deviceconfig.properties.findIndex(a => a.id === sensID);
                if (index > -1) {
                    deviceconfig.properties.splice(index, 1);
                }
                const sensorIndex = Object.keys(sensors).find(key => sensors[key] === sensID);
                if (sensorIndex)
                    delete sensors[sensorIndex];
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
        service.on(this.id, (incomingStates) => {
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
        this.on('close', (removed, done) => {
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
//# sourceMappingURL=alice-device.js.map