"use strict";
function checkRange(instance, unit, value) {
    if (unit == 'unit.percent') {
        return value >= 0 && value <= 100 ? null : "expected 0..100 (percent)";
    }
    if (instance == 'temperature') {
        if (unit == 'unit.temperature.kelvin')
            return value >= 0 ? null : "expected >= 0 K";
        return value >= -273.15 ? null : "expected >= -273.15 °C";
    }
    return value >= 0 ? null : "expected >= 0";
}
const register = (RED) => {
    function AliceSensor(config) {
        RED.nodes.createNode(this, config);
        const device = RED.nodes.getNode(config.device);
        device.setMaxListeners(device.getMaxListeners() + 1);
        const id = JSON.parse(JSON.stringify(this.id));
        const stype = config.stype;
        const unit = config.unit;
        const instance = config.instance;
        const curentState = {
            type: stype,
            state: {
                instance: instance,
                value: 0
            }
        };
        let lastUpdateTime = 0;
        const UPDATE_INTERVAL = 10 * 60 * 1000;
        this.status({ fill: "red", shape: "dot", text: "offline" });
        const init = () => {
            this.debug("Starting sensor initilization ...");
            const sensor = {
                type: stype,
                reportable: true,
                retrievable: true,
                parameters: {
                    instance: instance,
                    unit: unit
                }
            };
            device.setSensor(id, sensor)
                .then(() => {
                this.debug("Sensor initilization - success!");
                this.status({ fill: "green", shape: "dot", text: "online" });
            })
                .catch(err => {
                this.error("Error on create sensor: " + err.message);
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
        this.on('input', (msg, _send, done) => {
            if (typeof msg.payload != 'number' || !Number.isFinite(msg.payload)) {
                this.error("Wrong type! msg.payload must be a finite number.");
                this.status({ fill: "red", shape: "dot", text: "not a number" });
                if (done) {
                    done();
                }
                return;
            }
            let value = msg.payload;
            if (unit == 'unit.temperature.celsius' || unit == 'unit.ampere' || unit == 'unit.pressure.bar') {
                value = +value.toFixed(1);
            }
            else {
                value = +value.toFixed(0);
            }
            msg.payload = value;
            const rangeError = checkRange(instance, unit, value);
            if (rangeError) {
                this.error("Invalid value " + value + " for " + instance + ": " + rangeError + ". Value not sent.");
                this.status({ fill: "red", shape: "dot", text: "invalid: " + String(value) });
                if (done) {
                    done();
                }
                return;
            }
            const timeSinceLastUpdate = Date.now() - lastUpdateTime;
            if (curentState.state.value == msg.payload && timeSinceLastUpdate < UPDATE_INTERVAL) {
                this.debug("Value not changed. Cancel update");
                if (done) {
                    done();
                }
                return;
            }
            curentState.state.value = msg.payload;
            lastUpdateTime = Date.now();
            device.updateSensorState(id, curentState)
                .then(() => {
                this.status({ fill: "green", shape: "dot", text: String(msg.payload) });
                if (done) {
                    done();
                }
            })
                .catch(err => {
                this.error("Error on update sensor state: " + err.message);
                this.status({ fill: "red", shape: "dot", text: "Error" });
                if (done) {
                    done();
                }
            });
        });
        this.on('close', (removed, done) => {
            if (removed) {
                device.delSensor(id)
                    .then(() => { done(); })
                    .catch(err => {
                    this.error("Error on delete property: " + err.message);
                    done();
                });
            }
            else {
                device.setMaxListeners(device.getMaxListeners() - 1);
                done();
            }
        });
    }
    RED.nodes.registerType("Sensor", AliceSensor);
};
register.checkRange = checkRange;
module.exports = register;
//# sourceMappingURL=alice-sensor.js.map