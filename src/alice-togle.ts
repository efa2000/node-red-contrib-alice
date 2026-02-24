import { NodeAPI, Node } from "node-red";
import { AliceCapabilityConfig, AliceDeviceNode, CapabilityState } from "./types.js";

export = (RED: NodeAPI): void => {
  function AliceToggle(this: Node, config: AliceCapabilityConfig): void {
    RED.nodes.createNode(this, config);
    const device = RED.nodes.getNode(config.device) as AliceDeviceNode;
    device.setMaxListeners(device.getMaxListeners() + 1);

    const ctype = 'devices.capabilities.toggle';
    const instance = config.instance || '';
    let response = config.response;
    let value = false;

    if (config.response === undefined) {
      response = true;
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
        }
      };
      device.setCapability(this.id, capab)
        .then(() => {
          this.debug("Capability initilization - success!");
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

    device.on(this.id, (val: boolean) => {
      this.debug("Received a new value from Yandex...");
      this.send({ payload: val });
      const state: CapabilityState = {
        type: ctype,
        state: {
          instance: instance,
          value: val
        }
      };
      if (response) {
        this.debug("Automatic confirmation is true, sending confirmation to Yandex ...");
        device.updateCapabState(this.id, state)
          .then(() => {
            value = val;
            this.status({ fill: "green", shape: "dot", text: String(val) });
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
      if (msg.payload === value) {
        this.debug("Value not changed. Cancel update");
        if (done) { done(); }
        return;
      }
      const state: CapabilityState = {
        type: ctype,
        state: {
          instance: instance,
          value: msg.payload
        }
      };
      device.updateCapabState(this.id, state)
        .then(() => {
          value = msg.payload as boolean;
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

  RED.nodes.registerType("Toggle", AliceToggle);
};
