"use strict";
module.exports = (RED) => {
    function AliceColor(config) {
        RED.nodes.createNode(this, config);
        const device = RED.nodes.getNode(config.device);
        device.setMaxListeners(device.getMaxListeners() + 1);
        const ctype = 'devices.capabilities.color_setting';
        let scheme = config.scheme;
        const temperature_k = config.temperature_k;
        const temperature_min = parseInt(config.temperature_min);
        const temperature_max = parseInt(config.temperature_max);
        const color_scene = config.color_scene || [];
        let needConvert = false;
        let response = config.response;
        let color_support = config.color_support;
        let lastValue;
        if (scheme == "rgb_normal") {
            scheme = "rgb";
            needConvert = true;
        }
        if (config.response === undefined) {
            response = true;
        }
        if (config.color_support === undefined) {
            color_support = true;
        }
        const init = () => {
            const parameters = {};
            const capab = {
                type: ctype,
                retrievable: true,
                reportable: true,
                parameters: parameters
            };
            if (!color_support && !temperature_k && color_scene.length < 1) {
                this.error("Error on create capability: At least one parameter must be enabled");
                this.status({ fill: "red", shape: "dot", text: "error" });
                return;
            }
            if (color_scene.length > 0) {
                const scenes = color_scene.map(s => ({ id: s }));
                parameters.color_scene = { scenes: scenes };
            }
            if (color_support) {
                parameters.color_model = scheme;
            }
            if (temperature_k) {
                parameters.temperature_k = {
                    min: temperature_min,
                    max: temperature_max
                };
            }
            device.setCapability(this.id, capab)
                .then(() => {
                this.status({ fill: "green", shape: "dot", text: "online" });
            })
                .catch(err => {
                this.error("Error on create capability: " + err.message);
                this.status({ fill: "red", shape: "dot", text: "error" });
            });
        };
        if (device.initState)
            init();
        device.on("online", () => {
            init();
        });
        device.on("offline", () => {
            this.status({ fill: "red", shape: "dot", text: "offline" });
        });
        device.on(this.id, (val, newstate) => {
            const outmsgs = [null, null, null];
            switch (newstate.instance) {
                case 'rgb': {
                    const value = {
                        r: val >> 16,
                        g: val >> 8 & 0xFF,
                        b: val & 0xFF
                    };
                    outmsgs[0] = { payload: value };
                    break;
                }
                case 'hsv':
                    outmsgs[0] = { payload: val };
                    break;
                case 'temperature_k':
                    outmsgs[1] = { payload: val };
                    break;
                case 'scene':
                    outmsgs[2] = { payload: val };
                    break;
            }
            this.send(outmsgs);
            const state = {
                type: ctype,
                state: {
                    instance: newstate.instance,
                    value: val
                }
            };
            if (response) {
                device.updateCapabState(this.id, state)
                    .then(() => {
                    lastValue = JSON.stringify(val);
                    this.status({ fill: "green", shape: "dot", text: "online" });
                })
                    .catch(err => {
                    this.error("Error on update capability state: " + err.message);
                    this.status({ fill: "red", shape: "dot", text: "Error" });
                });
            }
        });
        this.on('input', (msg, _send, done) => {
            let value = msg.payload;
            const state = {};
            switch (typeof value) {
                case 'object': {
                    const obj = value;
                    if (('r' in obj && 'g' in obj && 'b' in obj) || ('h' in obj && 's' in obj && 'v' in obj)) {
                        if (scheme == 'rgb' && 'r' in obj) {
                            value = obj.r << 16 | obj.g << 8 | obj.b;
                        }
                        state.value = value;
                        state.instance = scheme;
                    }
                    else {
                        this.error("Wrong type! For Color, msg.payload must be RGB or HSV Object.");
                        if (done) {
                            done();
                        }
                        return;
                    }
                    break;
                }
                case 'number': {
                    value = Math.round(value);
                    if (value >= temperature_min && value <= temperature_max) {
                        state.value = value;
                        state.instance = 'temperature_k';
                    }
                    else {
                        this.error("Wrong type! For Temperature_k, msg.payload must be >=MIN and <=MAX.");
                        if (done) {
                            done();
                        }
                        return;
                    }
                    break;
                }
                case 'string':
                    if (color_scene.includes(value)) {
                        state.value = value;
                        state.instance = 'scene';
                    }
                    else {
                        this.error("Wrong type! For the Scene, the msg.payload must be set in the settings");
                        if (done) {
                            done();
                        }
                        return;
                    }
                    break;
                default:
                    this.error("Wrong type! Unsupported msg.payload type");
                    if (done) {
                        done();
                    }
                    return;
            }
            if (JSON.stringify(value) === lastValue) {
                this.debug("Value not changed. Cancel update");
                if (done) {
                    done();
                }
                return;
            }
            const upState = {
                type: ctype,
                state: state
            };
            device.updateCapabState(this.id, upState)
                .then(() => {
                lastValue = JSON.stringify(value);
                this.status({ fill: "green", shape: "dot", text: JSON.stringify(msg.payload) });
                if (done) {
                    done();
                }
            })
                .catch(err => {
                this.error("Error on update capability state: " + err.message);
                this.status({ fill: "red", shape: "dot", text: "Error" });
                if (done) {
                    done();
                }
            });
        });
        this.on('close', (removed, done) => {
            if (removed) {
                device.delCapability(this.id)
                    .then(() => { done(); })
                    .catch(err => {
                    this.error("Error on delete capability: " + err.message);
                    done();
                });
            }
            else {
                done();
            }
        });
    }
    RED.nodes.registerType("Color", AliceColor);
};
//# sourceMappingURL=alice-color.js.map