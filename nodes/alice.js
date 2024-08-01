"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const axios_1 = __importDefault(require("axios"));
const mqtt_1 = __importDefault(require("mqtt"));
;
;
;
module.exports = (RED) => {
    function AliceService(config) {
        RED.nodes.createNode(this, config);
        this.debug("Starting Alice service... ID: " + this.id);
        const email = this.credentials.email;
        const login = this.credentials.id;
        const password = this.credentials.password;
        const token = this.credentials.token;
        const suburl = Buffer.from(email).toString('base64');
        RED.httpAdmin.get("/noderedhome/" + suburl + "/clearalldevice", (req, res) => {
            const option = {
                method: 'POST',
                url: 'https://api.nodered-home.ru/gtw/device/clearallconfigs',
                headers: {
                    'content-type': 'application/json',
                    'Authorization': "Bearer " + this.getToken()
                },
                data: {}
            };
            axios_1.default.request(option)
                .then(result => {
                this.trace("All devices configs deleted on gateway successfully");
                res.sendStatus(200);
            })
                .catch(error => {
                this.debug("Error when delete All devices configs deleted on gateway: " + error.message);
                res.sendStatus(500);
            });
        });
        RED.httpAdmin.get("/noderedhome/" + this.id + "/getfullconfig", (req, res) => {
            const option = {
                method: 'GET',
                url: 'https://api.iot.yandex.net/v1.0/user/info',
                headers: {
                    'content-type': 'application/json',
                    'Authorization': "Bearer " + this.getToken()
                }
            };
            axios_1.default.request(option)
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
        ;
        const mqttClient = mqtt_1.default.connect("mqtts://mqtt.cloud.yandex.net", {
            port: 8883,
            clientId: login,
            rejectUnauthorized: false,
            username: login,
            password: password,
            reconnectPeriod: 10000
        });
        mqttClient.on("message", (topic, payload) => {
            const arrTopic = topic.split('/');
            const data = JSON.parse(payload);
            this.trace("Incoming:" + topic + " timestamp:" + new Date().getTime());
            if (payload.length && typeof data === 'object') {
                if (arrTopic[3] == 'message') {
                    this.warn(data.text);
                }
                else {
                    this.emit(arrTopic[3], data);
                }
                ;
            }
        });
        mqttClient.on("connect", () => {
            this.debug("Yandex IOT client connected. ");
            this.emit('online');
            mqttClient.subscribe("$me/device/commands/+", _ => {
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
        this.on('close', (done) => {
            this.emit('offline');
            setTimeout(() => {
                mqttClient.end(false, done);
            }, 500);
        });
        this.send2gate = (path, data, retain) => {
            this.trace("Outgoing: " + path);
            mqttClient.publish(path, data, { qos: 0, retain: retain });
        };
        this.getToken = () => {
            return JSON.parse(token).access_token;
        };
    }
    ;
    RED.nodes.registerType("alice-service", AliceService, {
        credentials: {
            email: { type: "text" },
            password: { type: "password" },
            token: { type: "password" },
            id: { type: "text" }
        }
    });
};
