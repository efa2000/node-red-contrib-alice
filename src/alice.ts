import { NodeAPI } from "node-red";
import axios from "axios";
import mqtt from "mqtt";
import { AliceServiceConfig, AliceServiceNode } from "./types.js";

export = (RED: NodeAPI): void => {
  function AliceService(this: AliceServiceNode, config: AliceServiceConfig): void {
    RED.nodes.createNode(this, config);
    this.debug("Starting Alice service... ID: " + this.id);

    const email = this.credentials.email;
    const login = this.credentials.id;
    const password = this.credentials.password;
    const token = this.credentials.token;

    //вызов для удаления всех устройств
    const suburl = Buffer.from(email).toString('base64');
    RED.httpAdmin.get("/noderedhome/" + suburl + "/clearalldevice", (_req, res) => {
      axios.request({
        method: 'POST',
        url: 'https://api.nodered-home.ru/gtw/device/clearallconfigs',
        headers: {
          'content-type': 'application/json',
          'Authorization': "Bearer " + this.getToken()
        },
        data: {}
      })
      .then(() => {
        this.trace("All devices configs deleted on gateway successfully");
        res.sendStatus(200);
      })
      .catch(error => {
        this.debug("Error when delete All devices configs deleted on gateway: " + error.message);
        res.sendStatus(500);
      });
    });

    RED.httpAdmin.get("/noderedhome/" + this.id + "/getfullconfig", (_req, res) => {
      axios.request({
        method: 'GET',
        url: 'https://api.iot.yandex.net/v1.0/user/info',
        headers: {
          'content-type': 'application/json',
          'Authorization': "Bearer " + this.getToken()
        }
      })
      .then(result => {
        this.trace("Full Alice SmartHome config successfully retrieved");
        res.json(result.data);
      })
      .catch(error => {
        this.debug("Error when retrieve Alice SmartHome config: " + error.message);
        res.sendStatus(500);
      });
    });

    this.isOnline = false;

    if (!token) {
      this.error("Authentication is required!!!");
      return;
    }

    const mqttClient = mqtt.connect("mqtts://mqtt.cloud.yandex.net", {
      port: 8883,
      clientId: login,
      rejectUnauthorized: false,
      username: login,
      password: password,
      reconnectPeriod: 10000
    });

    mqttClient.on("message", (topic: string, payload: Buffer) => {
      const arrTopic = topic.split('/');
      const data = JSON.parse(payload.toString());
      this.trace("Incoming:" + topic + " timestamp:" + new Date().getTime());
      if (payload.length && typeof data === 'object') {
        if (arrTopic[3] == 'message') {
          this.warn(data.text);
        } else {
          this.emit(arrTopic[3], data);
        }
      }
    });

    mqttClient.on("connect", () => {
      this.debug("Yandex IOT client connected. ");
      this.emit('online');
      mqttClient.subscribe("$me/device/commands/+", () => {
        this.debug("Yandex IOT client subscribed to the command");
      });
    });

    mqttClient.on("offline", () => {
      this.debug("Yandex IOT client offline. ");
      this.emit('offline');
    });

    mqttClient.on("disconnect", () => {
      this.debug("Yandex IOT client disconnect.");
      this.emit('offline');
    });

    mqttClient.on("reconnect", () => {
      this.debug("Yandex IOT client reconnecting ...");
    });

    mqttClient.on("error", (err) => {
      this.error("Yandex IOT client Error: " + err.message);
      this.emit('offline');
    });

    this.on('offline', () => {
      this.isOnline = false;
    });

    this.on('online', () => {
      this.isOnline = true;
    });

    this.on('close', (done: () => void) => {
      this.emit('offline');
      setTimeout(() => {
        mqttClient.end(false, {}, done);
      }, 500);
    });

    this.send2gate = (path: string, data: string, retain: boolean) => {
      this.trace("Outgoing: " + path);
      mqttClient.publish(path, data, { qos: 0, retain: retain });
    };

    this.getToken = () => {
      return JSON.parse(token).access_token;
    };
  }

  RED.nodes.registerType("alice-service", AliceService, {
    credentials: {
      email: { type: "text" },
      password: { type: "password" },
      token: { type: "password" },
      id: { type: "text" }
    }
  });
};
