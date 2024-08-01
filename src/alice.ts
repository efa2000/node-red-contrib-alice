import {NodeAPI, Node, NodeDef, NodeCredentials, NodeCredential } from "node-red";
import axios from "axios";
import mqtt from "mqtt";

interface NodeAliceConfig
    extends NodeDef {
    name:string;
};

interface NodeAliceCredentials
  extends NodeCredential {
    email:string;
    id:string;
    password:string;
    token:string;
  };

interface AliceNode
  extends Node {
    credentials: NodeAliceCredentials;
    isOnline:boolean;
    getToken():string;
    send2gate(topic:string,data:any,retain:boolean):void;
    // on(event: 'hello', listener: (name: string) => void): this;
    on(event: string, listener: Function): this;
  };

export = (RED: NodeAPI):void =>{
  function AliceService(this:AliceNode, config:NodeAliceConfig):void {
      RED.nodes.createNode(this,config);
      this.debug("Starting Alice service... ID: "+this.id);

      const email = this.credentials.email;
      const login = this.credentials.id;
      const password = this.credentials.password;
      const token = this.credentials.token;

      //вызов для удаления всех устройств 
      const suburl = Buffer.from(email).toString('base64');
      RED.httpAdmin.get("/noderedhome/"+suburl+"/clearalldevice",(req,res)=>{
        const option = {
          method: 'POST',
          url: 'https://api.nodered-home.ru/gtw/device/clearallconfigs',
          headers: {
            'content-type': 'application/json',
            'Authorization': "Bearer "+this.getToken()
          },
          data: {}
        };
        axios.request(option)
        .then(result=>{
          this.trace("All devices configs deleted on gateway successfully");
          // console.log(result)
          res.sendStatus(200);
        })
        .catch(error=>{
          this.debug("Error when delete All devices configs deleted on gateway: "+error.message);
          res.sendStatus(500);
        });
      });

      RED.httpAdmin.get("/noderedhome/"+this.id+"/getfullconfig",(req,res)=>{
        const option = {
          method: 'GET',
          url: 'https://api.iot.yandex.net/v1.0/user/info',
          headers: {
            'content-type': 'application/json',
            'Authorization': "Bearer "+this.getToken()
          }
        };
        axios.request(option)
        .then(result=>{
          this.trace("Full Alice SmartHome config successfully retrieved");
          // console.log(result)
          res.json(result.data);
        })
        .catch(error=>{
          this.debug("Error when retrieve Alice SmartHome config: "+error.message);
          res.sendStatus(500);
        });
      });

    this.isOnline = false;
    //// проверяем а есть ли токен 
    if (!token){
      this.error("Authentication is required!!!");
      return;
    };
    const mqttClient = mqtt.connect("mqtts://mqtt.cloud.yandex.net",{
      port: 8883,
      clientId: login,
      rejectUnauthorized: false,
      username: login,
      password: password,
      reconnectPeriod: 10000
    });

    mqttClient.on("message",(topic:string, payload:string)=>{
      const arrTopic = topic.split('/');
      const data = JSON.parse(payload);
      this.trace("Incoming:" + topic +" timestamp:"+new Date().getTime());
      if (payload.length && typeof data === 'object'){
        if (arrTopic[3]=='message'){
          this.warn(data.text);
        }else{
          this.emit(arrTopic[3],data);
        };
      }
    });
    mqttClient.on("connect",()=>{
      this.debug("Yandex IOT client connected. ");
      this.emit('online');
      // Подписываемся на получение комманд 
      mqttClient.subscribe("$me/device/commands/+",_=>{
        this.debug("Yandex IOT client subscribed to the command");
      });
    });
    mqttClient.on("offline",()=>{
      this.debug("Yandex IOT client offline. ");
      this.emit('offline');
    });
    mqttClient.on("disconnect",()=>{
      this.debug("Yandex IOT client disconnect.");
      this.emit('offline');
    });
    mqttClient.on("reconnect",()=>{
      this.debug("Yandex IOT client reconnecting ...");
    });
    mqttClient.on("error",(err)=>{
      this.error("Yandex IOT client Error: "+ err.message);
      this.emit('offline');
    });

    this.on('offline', ()=>{
      this.isOnline = false;
    });

    this.on('online', ()=>{
      this.isOnline = true;
    });

    this.on('close',(done:Object)=>{
      this.emit('offline');
      setTimeout(()=>{
        mqttClient.end(false,done);
      },500)
    });

    this.send2gate = (path:string,data:any,retain:boolean)=>{
      // this.debug(path);
      // this.debug(data);
      this.trace("Outgoing: "+path);
      mqttClient.publish(path, data ,{ qos: 0, retain: retain });
    }


    this.getToken = ()=>{
      return JSON.parse(token).access_token; 
    }
  };

  RED.nodes.registerType("alice-service",AliceService,{
        credentials: {
          email: {type: "text"},
          password: {type: "password"},
          token: {type: "password"},
          id:{type:"text"}
        }
      });
}

// const mqtt = require('mqtt');
// const axios = require('axios');

// module.exports = function(RED) {
//   //Sevice node, Alice-Service (credential)
//   function AliceService(config) {
//     RED.nodes.createNode(this,config);
//     this.debug("Starting Alice service...");

//     const email = this.credentials.email;
//     const login = this.credentials.id;
//     const password = this.credentials.password;
//     const token = this.credentials.token;

//     const suburl = Buffer.from(email).toString('base64');
//     RED.httpAdmin.get("/noderedhome/"+suburl+"/clearalldevice",(req,res)=>{
//       const option = {
//         method: 'POST',
//         url: 'https://api.nodered-home.ru/gtw/device/clearallconfigs',
//         headers: {
//           'content-type': 'application/json',
//           'Authorization': "Bearer "+this.getToken()
//         },
//         data: {}
//       };
//       axios.request(option)
//       .then(result=>{
//         this.trace("All devices configs deleted on gateway successfully");
//         // console.log(result)
//         res.sendStatus(200);
//       })
//       .catch(error=>{
//         this.debug("Error when delete All devices configs deleted on gateway: "+error.message);
//         res.sendStatus(500);
//       });
//     });

//     this.isOnline = false;
//     if (!token){
//       this.error("Authentication is required!!!");
//       return;
//     };
    // const mqttClient = mqtt.connect("mqtts://mqtt.cloud.yandex.net",{
    //   port: 8883,
    //   clientId: login,
    //   rejectUnauthorized: false,
    //   username: login,
    //   password: password,
    //   reconnectPeriod: 10000
    // });
    // mqttClient.on("message",(topic, payload)=>{
    //   const arrTopic = topic.split('/');
    //   const data = JSON.parse(payload);
    //   this.trace("Incoming:" + topic +" timestamp:"+new Date().getTime());
    //   if (payload.length && typeof data === 'object'){
    //     if (arrTopic[3]=='message'){
    //       this.warn(data.text);
    //     }else{
    //       this.emit(arrTopic[3],data);
    //     };
    //   }
    // });
    // mqttClient.on("connect",()=>{
    //   this.debug("Yandex IOT client connected. ");
    //   this.emit('online');
    //   // Подписываемся на получение комманд 
    //   mqttClient.subscribe("$me/device/commands/+",_=>{
    //     this.debug("Yandex IOT client subscribed to the command");
    //   });
    // });
    // mqttClient.on("offline",()=>{
    //   this.debug("Yandex IOT client offline. ");
    //   this.emit('offline');
    // });
    // mqttClient.on("disconnect",()=>{
    //   this.debug("Yandex IOT client disconnect.");
    //   this.emit('offline');
    // });
    // mqttClient.on("reconnect",(err)=>{
    //   this.debug("Yandex IOT client reconnecting ...");
    // });
    // mqttClient.on("error",(err)=>{
    //   this.error("Yandex IOT client Error: "+ err.message);
    //   this.emit('offline');
    // });

    // this.on('offline', ()=>{
    //   this.isOnline = false;
    // })

    // this.on('online', ()=>{
    //   this.isOnline = true;
    // })

    // this.on('close',(done)=>{
    //   this.emit('offline');
    //   setTimeout(()=>{
    //     mqttClient.end(false,done);
    //   },500)
    // });

    // this.send2gate= (path,data,retain)=>{
    //   // this.debug(path);
    //   // this.debug(data);
    //   this.trace("Outgoing: "+path);
    //   mqttClient.publish(path, data ,{ qos: 0, retain: retain });
    // }

    // this.getToken = ()=>{
    //   return JSON.parse(token).access_token; 
    // }

//   };
//   RED.nodes.registerType("alice-service",AliceService,{
//     credentials: {
//       email: {type: "text"},
//       password: {type: "password"},
//       token: {type: "password"},
//       id:{type:"text"}
//     }
//   });
// };



