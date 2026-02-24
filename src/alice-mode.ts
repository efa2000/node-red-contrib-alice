import { NodeAPI, Node } from "node-red";
import { AliceModeConfig, AliceDeviceNode, CapabilityState } from "./types.js";

export = (RED: NodeAPI): void => {
  function AliceMode(this: Node, config: AliceModeConfig): void {
    RED.nodes.createNode(this, config);
    const device = RED.nodes.getNode(config.device) as AliceDeviceNode;

    const ctype = 'devices.capabilities.mode';
    const instance = config.instance || '';
    const modes = config.modes;
    let response = config.response;
    let value: string | undefined;

    if (config.response === undefined) {
      response = true;
    }

    const init = (): void => {
      if (modes.length < 1) {
        this.status({ fill: "red", shape: "dot", text: "error" });
        this.error("In the list of supported commands, there must be at least one command");
        return;
      }
      if (!instance) {
        this.status({ fill: "red", shape: "dot", text: "error" });
        this.error("Mode type not selected");
        return;
      }

      const cfgModes = modes.map(v => ({ value: v }));
      const capab = {
        type: ctype,
        retrievable: true,
        reportable: true,
        parameters: {
          instance: instance,
          modes: cfgModes
        }
      };

      device.setCapability(this.id, capab)
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

    device.on(this.id, (val: string) => {
      this.send({ payload: val });
      const state: CapabilityState = {
        type: ctype,
        state: {
          instance: instance,
          value: val
        }
      };
      if (response) {
        device.updateCapabState(this.id, state)
          .then(() => {
            value = val;
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
      if (typeof newValue != 'string') {
        this.error("Wrong type! msg.payload must be String.");
        this.status({ fill: "red", shape: "dot", text: "Error" });
        if (done) { done(); }
        return;
      }
      if (modes.indexOf(newValue) < 0) {
        this.error("Error! Unsupported command.");
        this.status({ fill: "red", shape: "dot", text: "Error" });
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
          this.status({ fill: "green", shape: "dot", text: newValue });
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

  RED.nodes.registerType("Mode", AliceMode);
};
