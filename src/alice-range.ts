import { NodeAPI, Node } from "node-red";
import { AliceRangeConfig, AliceDeviceNode, CapabilityState } from "./types.js";

export = (RED: NodeAPI): void => {
  function AliceRange(this: Node, config: AliceRangeConfig): void {
    RED.nodes.createNode(this, config);
    const device = RED.nodes.getNode(config.device) as AliceDeviceNode;
    device.setMaxListeners(device.getMaxListeners() + 1);

    const ctype = 'devices.capabilities.range';
    const retrievable = config.retrievable;
    const instance = config.instance || '';
    const unit = config.unit;
    const random_access = true;
    let min = parseFloat(config.min);
    let max = parseFloat(config.max);
    let precision = parseFloat(config.precision);
    let response = config.response;
    let value: number | null = null;

    if (config.response === undefined) {
      response = true;
    }
    if (typeof min != 'number' || isNaN(min)) { min = 0; }
    if (typeof max != 'number' || isNaN(max)) { max = 100; }
    if (typeof precision != 'number' || isNaN(precision)) { precision = 1; }

    this.status({ fill: "red", shape: "dot", text: "offline" });

    const init = (): void => {
      const parameters: Record<string, any> = {
        instance: instance,
        unit: unit,
        random_access: random_access,
        range: { min, max, precision }
      };
      // если unit не применим к параметру, то нужно удалить
      if (unit == "unit.number") {
        delete parameters.unit;
      }

      device.setCapability(this.id, {
        type: ctype,
        retrievable: retrievable,
        reportable: true,
        parameters: parameters
      })
        .then(() => {
          this.status({ fill: "green", shape: "dot", text: "online" });
        })
        .catch(err => {
          this.error("Error on create capability: " + err.message);
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

    device.on(this.id, (val: number, fullstate: { relative?: boolean }) => {
      let newValue = val;
      //проверка является ли значение относительным и нужно ли отдавать полное значение
      if (fullstate.relative && retrievable && value !== null) {
        newValue = value + val;
        if (val < 0 && newValue < min) newValue = min;
        if (val > 0 && newValue > max) newValue = max;
      }
      this.send({ payload: newValue });
      const state: CapabilityState = {
        type: ctype,
        state: {
          instance: instance,
          value: newValue
        }
      };
      if (response) {
        device.updateCapabState(this.id, state)
          .then(() => {
            value = newValue;
            this.status({ fill: "green", shape: "dot", text: "online" });
          })
          .catch(err => {
            this.error("Error on update capability state: " + err.message);
            this.status({ fill: "red", shape: "dot", text: "Error" });
          });
      }
    });

    this.on('input', (msg, _send, done) => {
      const newValue = msg.payload;
      if (typeof newValue != 'number') {
        this.error("Wrong type! msg.payload must be Number.");
        if (done) { done(); }
        return;
      }
      if (newValue === value) {
        this.debug("Value not changed. Cancel update");
        if (done) { done(); }
        return;
      }
      const state: CapabilityState = {
        type: ctype,
        state: {
          instance: instance,
          value: newValue
        }
      };
      device.updateCapabState(this.id, state)
        .then(() => {
          value = newValue;
          this.status({ fill: "green", shape: "dot", text: String(newValue) });
          if (done) { done(); }
        })
        .catch(err => {
          this.error("Error on update capability state: " + err.message);
          this.status({ fill: "red", shape: "dot", text: "Error" });
          if (done) { done(); }
        });
    });

    this.on('close', (removed: boolean, done: () => void) => {
      device.setMaxListeners(device.getMaxListeners() - 1);
      if (removed) {
        device.delCapability(this.id)
          .then(() => { done(); })
          .catch(err => {
            this.error("Error on delete capability: " + err.message);
            done();
          });
      } else {
        done();
      }
    });
  }

  RED.nodes.registerType("Range", AliceRange);
};
