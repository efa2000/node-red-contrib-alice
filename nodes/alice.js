const mqtt = require('mqtt');

module.exports = function(RED) {
  //Sevice node, Alice-Service (credential)
  function AliceService(config) {
    RED.nodes.createNode(this,config);
    this.debug("Starting Alice service...");

    const email = this.credentials.email;
    const login = this.credentials.id;
    const password = this.credentials.password;
    const token = this.credentials.token;

    this.isOnline = false;
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
    mqttClient.on("message",(topic, payload)=>{
      const arrTopic = topic.split('/');
      const data = JSON.parse(payload);
      if (payload.length && typeof data === 'object'){
        this.emit(arrTopic[3],data);
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
    mqttClient.on("reconnect",(err)=>{
      this.debug("Yandex IOT client reconnecting ...");
    });
    mqttClient.on("error",(err)=>{
      this.debug("Yandex IOT client Error: "+ err.message);
      this.emit('offline');
    });

    this.on('offline', ()=>{
      this.isOnline = false;
    })

    this.on('online', ()=>{
      this.isOnline = true;
    })

    this.on('close',(done)=>{
      this.emit('offline');
      setTimeout(()=>{
        mqttClient.end(false,done);
      },500)
    });

    this.send2gate= (path,data,retain)=>{
      // this.debug(path);
      // this.debug(data);
      mqttClient.publish(path, data ,{ qos: 0, retain: retain });
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
};

