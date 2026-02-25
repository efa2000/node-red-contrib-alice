import { NodeAPI, Node } from "node-red";
import { AliceSensorConfig, AliceDeviceNode, SensorState } from "./types.js";

export = (RED: NodeAPI): void => {
  function AliceSensor(this: Node, config: AliceSensorConfig): void {
    RED.nodes.createNode(this, config);
    const device = RED.nodes.getNode(config.device) as AliceDeviceNode;
    device.setMaxListeners(device.getMaxListeners() + 1);

    const id = JSON.parse(JSON.stringify(this.id));
    const stype = config.stype;
    const unit = config.unit;
    const instance = config.instance;

    const curentState: SensorState = {
      type: stype,
      state: {
        instance: instance,
        value: 0
      }
    };

    let lastUpdateTime = 0;
    const UPDATE_INTERVAL = 10 * 60 * 1000; // 10 минут

    this.status({ fill: "red", shape: "dot", text: "offline" });

    const init = (): void => {
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

    if (device.initState) init();

    device.on("online", () => {
      init();
    });

    device.on("offline", () => {
      this.status({ fill: "red", shape: "dot", text: "offline" });
    });

    this.on('input', (msg, _send, done) => {
      if (typeof msg.payload != 'number') {
        this.error("Wrong type! msg.payload must be number.");
        if (done) { done(); }
        return;
      }
      if (unit == 'unit.temperature.celsius' || unit == 'unit.ampere' || unit == 'unit.pressure.bar') {
        msg.payload = +msg.payload.toFixed(1);
      } else {
        msg.payload = +msg.payload.toFixed(0);
      }
      const timeSinceLastUpdate = Date.now() - lastUpdateTime;
      if (curentState.state.value == msg.payload && timeSinceLastUpdate < UPDATE_INTERVAL) {
        this.debug("Value not changed. Cancel update");
        if (done) { done(); }
        return;
      }
      curentState.state.value = msg.payload;
      lastUpdateTime = Date.now();
      device.updateSensorState(id, curentState)
        .then(() => {
          this.status({ fill: "green", shape: "dot", text: String(msg.payload) });
          if (done) { done(); }
        })
        .catch(err => {
          this.error("Error on update sensor state: " + err.message);
          this.status({ fill: "red", shape: "dot", text: "Error" });
          if (done) { done(); }
        });
    });

    this.on('close', (removed: boolean, done: () => void) => {
      if (removed) {
        device.delSensor(id)
          .then(() => { done(); })
          .catch(err => {
            this.error("Error on delete property: " + err.message);
            done();
          });
      } else {
        device.setMaxListeners(device.getMaxListeners() - 1);
        done();
      }
    });
  }

  RED.nodes.registerType("Sensor", AliceSensor);
};
