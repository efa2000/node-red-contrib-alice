"use strict";
module.exports = (RED) => {
    function AliceEvent(config) {
        RED.nodes.createNode(this, config);
        const device = RED.nodes.getNode(config.device);
        device.setMaxListeners(device.getMaxListeners() + 1);
        const id = JSON.parse(JSON.stringify(this.id));
        const stype = 'devices.properties.event';
        const instance = config.instance;
        const events = config.events;
        let initState = false;
        const curentState = {
            type: stype,
            state: {
                instance: instance,
                value: ''
            }
        };
        this.status({ fill: "red", shape: "dot", text: "offline" });
        const init = () => {
            this.debug("Starting sensor initilization ...");
            const objEvents = events.map(v => ({ value: v }));
            const sensor = {
                type: stype,
                reportable: true,
                retrievable: false,
                parameters: {
                    instance: instance,
                    events: objEvents
                }
            };
            device.setSensor(id, sensor)
                .then(() => {
                this.debug("Sensor initilization - success!");
                this.status({ fill: "green", shape: "dot", text: "online" });
                initState = true;
            })
                .catch(err => {
                this.error("Error on create sensor: " + err.message);
                this.status({ fill: "red", shape: "dot", text: "error" });
            });
        };
        if (device.initState)
            init();
        device.on("online", () => {
            if (!initState) {
                init();
            }
            else {
                this.status({ fill: "green", shape: "dot", text: curentState.state.value });
            }
        });
        device.on("offline", () => {
            this.status({ fill: "red", shape: "dot", text: "offline" });
        });
        this.on('input', (msg, _send, done) => {
            if (!events.includes(msg.payload)) {
                this.error("Wrong type! msg.payload must be from the list of allowed events.");
                if (done) {
                    done();
                }
                return;
            }
            if (curentState.state.value == msg.payload) {
                this.debug("Value not changed. Cancel update");
                if (done) {
                    done();
                }
                return;
            }
            else {
                curentState.state.value = msg.payload;
            }
            if (instance == 'button') {
                setTimeout(() => {
                    curentState.state.value = null;
                    this.status({ fill: "green", shape: "dot", text: "" });
                }, 1000);
            }
            device.updateSensorState(id, curentState)
                .then(() => {
                this.status({ fill: "green", shape: "dot", text: curentState.state.value });
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
                done();
            }
        });
    }
    RED.nodes.registerType("Event", AliceEvent);
};
//# sourceMappingURL=alice-event.js.map