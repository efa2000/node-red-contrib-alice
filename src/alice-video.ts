import { NodeAPI, Node } from "node-red";
import { AliceVideoConfig, AliceDeviceNode, CapabilityState } from "./types.js";

export = (RED: NodeAPI): void => {
  function AliceVideo(this: Node, config: AliceVideoConfig): void {
    RED.nodes.createNode(this, config);
    const device = RED.nodes.getNode(config.device) as AliceDeviceNode;
    device.setMaxListeners(device.getMaxListeners() + 1);

    const id = this.id;
    const ctype = 'devices.capabilities.video_stream';
    const instance = 'get_stream';
    const stream_url = config.stream_url;
    const protocol = config.protocol;

    const curentState: CapabilityState = {
      type: ctype,
      state: {
        instance: instance,
        value: {
          stream_url: stream_url,
          protocol: protocol
        }
      }
    };

    this.status({ fill: "red", shape: "dot", text: "offline" });

    const init = (): void => {
      this.debug("Starting capability initilization ...");
      const capab = {
        type: ctype,
        retrievable: false,
        reportable: false,
        parameters: {
          instance: instance,
          protocols: [protocol]
        }
      };

      device.setCapability(id, capab)
        .then(() => {
          this.debug("Capability initilization - success!");
          this.status({ fill: "green", shape: "dot", text: "online" });
        })
        .catch(err => {
          this.error("Error on create capability: " + err.message);
          this.status({ fill: "red", shape: "dot", text: "Error" });
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

    device.on(id, () => {
      device.updateCapabState(id, curentState)
        .then(() => {
          const str_url = stream_url.slice(0, 25) + "...";
          this.status({ fill: "green", shape: "dot", text: str_url });
        })
        .catch(err => {
          this.error("Error on update capability state: " + err.message);
          this.status({ fill: "red", shape: "dot", text: "Error" });
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

  RED.nodes.registerType("Video", AliceVideo);
};
