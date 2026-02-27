import { NodeAPI, Node } from "node-red";
import { AliceOnOffConfig, AliceDeviceNode, CapabilityState } from "./types.js";

export = (RED: NodeAPI): void => {
  function AliceOnOff(this: Node, config: AliceOnOffConfig): void {
    RED.nodes.createNode(this, config);
    const device = RED.nodes.getNode(config.device) as AliceDeviceNode;
    device.setMaxListeners(device.getMaxListeners() + 1);

    const id = JSON.parse(JSON.stringify(this.id));
    const ctype = 'devices.capabilities.on_off';
    const instance = 'on';
    let response = config.response;
    let split = config.split;

    const curentState: CapabilityState = {
      type: ctype,
      state: {
        instance: instance,
        value: false
      }
    };

    if (config.response === undefined) {
      response = true;
    }
    if (config.split === undefined) {
      split = false;
    }

    this.status({ fill: "red", shape: "dot", text: "offline" });

    const init = (): void => {
      this.debug("Starting capability initilization ...");
      const capab = {
        type: ctype,
        retrievable: true,
        reportable: true,
        parameters: {
          instance: instance,
          split: split
        }
      };

      device.setCapability(id, capab)
        .then(() => {
          this.debug("Capability initilization - success!");
          this.status({ fill: "green", shape: "dot", text: "online" });
        })
        .catch(err => {
          this.error("Error on create capability: " + err.message);
          this.status({ fill: "red", shape: "dot", text: "error" });
        });

      device.updateCapabState(id, curentState)
        .then(() => {
          this.status({ fill: "green", shape: "dot", text: "online" });
        })
        .catch(err => {
          this.error("Error on update capability state: " + err.message);
          this.status({ fill: "red", shape: "dot", text: "Error" });
        });
    };

    if (device.initState) init();

    device.on("online", () => {
      init();
    });

    device.on("offline", () => {
      this.status({ fill: "red", shape: "dot", text: "offline" });
    });

    device.on(id, (val: boolean) => {
      this.send({ payload: val });
      if (response) {
        curentState.state.value = val;
        device.updateCapabState(id, curentState)
          .then(() => {
            this.status({ fill: "green", shape: "dot", text: val.toString() });
          })
          .catch(err => {
            this.error("Error on update capability state: " + err.message);
            this.status({ fill: "red", shape: "dot", text: "Error" });
          });
      }
    });

    this.on('input', (msg, _send, done) => {
      if (typeof msg.payload != 'boolean') {
        this.error("Wrong type! msg.payload must be boolean.");
        if (done) { done(); }
        return;
      }
      if (msg.payload === curentState.state.value) {
        this.debug("Value not changed. Cancel update");
        if (done) { done(); }
        return;
      }
      curentState.state.value = msg.payload;
      device.updateCapabState(id, curentState)
        .then(() => {
          this.status({ fill: "green", shape: "dot", text: String(msg.payload) });
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
        device.delCapability(id)
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

  RED.nodes.registerType("On_Off", AliceOnOff);
};
