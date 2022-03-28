
module.exports = function(RED) {
  //Sevice node, Alice-Service (credential)
  function AliceService(config) {
    RED.nodes.createNode(this,config);
    this.debug("Starting Alice service...");
    var mqtt = require('mqtt');

    const email = this.credentials.email;
    const login = this.credentials.id;
    const password = this.credentials.password;
    const token = this.credentials.token;

    this.isOnline = false;
    this.mqttClient;
    if (!token){
      this.error("Authentication is required!!!");
      return;
    };
    this.mqttClient = mqtt.connect("mqtts://mqtt.cloud.yandex.net",{
      port: 8883,
      clientId: login,
      rejectUnauthorized: false,
      username: login,
      password: password,
      reconnectPeriod: 10000
    });
    this.mqttClient.on("message",(topic, payload)=>{
      const arrTopic = topic.split('/');
      const data = JSON.parse(payload);
      if (payload.length && typeof data === 'object'){
        this.emit(arrTopic[3],data);
      }
    });
    this.mqttClient.on("connect",()=>{
      this.debug("Yandex IOT client connected. ");
      this.emit('online');
      // Подписываемся на получение комманд 
      this.mqttClient.subscribe("$me/device/commands/+",_=>{
        this.debug("Yandex IOT client subscribed to the command");
      }); 
    });
    this.mqttClient.on("offline",()=>{
      this.debug("Yandex IOT client offline. ");
      this.emit('offline');
    });
    this.mqttClient.on("disconnect",()=>{
      this.debug("Yandex IOT client disconnect.");
      this.emit('offline');
    });
    this.mqttClient.on("reconnect",(err)=>{
      this.debug("Yandex IOT client reconnecting ...");
    });
    this.mqttClient.on("error",(err)=>{
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
        this.mqttClient.end(false,done);
      },500)
    });

  };
  RED.nodes.registerType("alice-service",AliceService,{
    credentials: {
      email: {type: "text"},
      password: {type: "password"},
      token: {type: "password"},
      id:{type:"text"}
    }
  });
  
// ***************************** Alice DEVICE ****************************
  function AliceDevice(config){
    var pjson = require('../package.json');
    RED.nodes.createNode(this,config);
    service = RED.nodes.getNode(config.service);
    service.setMaxListeners(service.getMaxListeners() + 1); // увеличиваем лимит для event
    this.name = config.name;
    this.description = config.description,
    this.room = config.room;
    this.dtype = config.dtype;
    this.initState = false;
    this.updating = false;
    this.needSendEvent = false;
    this.capabilites = {};
    this.sensors = {};
    this.deviceconfig = {
        id: this.id,
        name: config.name,
        description: config.description,
        room: config.room,
        type: config.dtype,
        device_info:{
          manufacturer: "NodeRed Home",
          model: "virtual device",
          sw_version: pjson.version
        },
        capabilities:[],
        properties:[]
      };
    this.states = {
        id: this.id,
        capabilities: [],
        properties: []
      };
    
    if (service.isOnline){
      this.emit("online");
      this.initState = true;
    };
// функция обновления информации об устройстве    
    this._updateDeviceInfo= (now)=>{
      let data;
      if (this.deviceconfig === null){
        data = '';
      }else{
        data = JSON.stringify(this.deviceconfig);
      };
      if (now){
        this.debug("Updating Device info ...");
        service.mqttClient.publish('$me/device/state/'+this.id, data ,{ qos: 0, retain: true });
        return;
      };
      if (!this.updating){
        this.updating = true;
        setTimeout(() => {
          this.debug("Updating Device info ...");
          this.updating = false;
          let nData = JSON.stringify(this.deviceconfig);
          if (this.deviceconfig === null){ nData = ''};
          service.mqttClient.publish('$me/device/state/'+this.id, nData ,{ qos: 0, retain: true });
        }, 300);
      }
    };
// функция обновления состояния умений и сервисов об устройстве  
    this._updateDeviceState= ()=>{
      let data;
      if (this.states === null){
        data = '';
      }else{
        data = JSON.stringify(this.states);
      };
      service.mqttClient.publish('$me/device/state/'+this.id+'/states', data ,{ qos: 0, retain: true });
    };
// отправка эвентов
    this._sendEvent = (event)=>{
      let data = JSON.stringify(event);
      service.mqttClient.publish('$me/device/events/'+this.id, data ,{ qos: 0, retain: false });
    };
// Установка параметров умения 
    this.setCapability = (capId, capab)=>{
      return new Promise((resolve,reject)=>{
        let intsance = capab.parameters.instance || '';
        let capabIndex = capab.type+"."+intsance;
        if (this.capabilites[capabIndex] && this.capabilites[capabIndex]!=capId){
          reject(new Error("Dublicated capability on same device!"));
          return;
        };
        // проверям было ли такое умение раньше и удалем перед обновлением
        if (this.deviceconfig.capabilities.findIndex(a => a.id === capId)>-1){
          this.delCapability(capId);
        };
        this.capabilites[capabIndex] = capId; // добавляем новое уменя в локальный список
        capab.id = capId;
        this.deviceconfig.capabilities.push(capab);
        this._updateDeviceInfo();
        resolve(true);     
      })
    };
// Установка параметров сенсора 
    this.setSensor = (sensId, sensor)=>{
      return new Promise((resolve,reject)=>{
        let sensorIndex = sensor.type+"."+sensor.parameters.instance;
        if (this.sensors[sensorIndex] && this.sensors[sensorIndex]!=sensId){
          reject(new Error("Dublicated sensor on same device!"));
          return;
        };
        // проверям было ли такое сенсор раньше и удалем перед обновлением
        if (this.deviceconfig.properties.findIndex(a => a.id === sensId)>-1){
          this.delSensor(sensId);
        };
        this.sensors[sensorIndex] = sensId; // добавляем новый сенсор в локальный список 
        sensor.id = sensId;
        this.deviceconfig.properties.push(sensor);
        this._updateDeviceInfo()
        resolve(true);
      })
    };

// обновление текущего state умения
    this.updateCapabState = (capId,state)=>{
      return new Promise((resolve,reject)=>{
        state.id = capId;
        if (this.needSendEvent){
          this._sendEvent(state);
        };
        const index = this.states.capabilities.findIndex(a => a.id === capId);
        if (index>-1){
          this.states.capabilities.splice(index, 1);
        };
        this.states.capabilities.push(state);
        this._updateDeviceState();
        resolve(true);
        //   reject(new Error("Device not ready"));
      })
    };
// обновление текущего state сенсора
    this.updateSensorState=  (sensID,state)=>{
      return new Promise((resolve,reject)=>{
        state.id = sensID;
        const index = this.states.properties.findIndex(a => a.id === sensID);
        if (index>-1){
          this.states.properties.splice(index, 1);
        };
        this.states.properties.push(state);
        this._updateDeviceState();
        resolve(true);
        //   reject(new Error("Device not ready"));
      })
    };

// удаление умения 
    this.delCapability=  (capId)=>{
      return new Promise((resolve,reject)=>{
        // удаляем из конфига
        const index = this.deviceconfig.capabilities.findIndex(a => a.id === capId);
        if (index>-1){
          this.deviceconfig.capabilities.splice(index, 1);
        }
        // удаляем из карты 
        let capabIndex = Object.keys(this.capabilites).find(key => this.capabilites[key] === capId);
        delete this.capabilites[capabIndex];
        this._updateDeviceInfo();
        resolve(true);
      })
    };

// удаление сенсора
    this.delSensor= (sensID)=>{
      return new Promise((resolve,reject)=>{
         // удаляем из конфига
         const index = this.deviceconfig.properties.findIndex(a => a.id === sensID);
         if (index>-1){
          this.deviceconfig.properties.splice(index, 1);
         }
         // удаляем из карты 
         let sensorIndex = Object.keys(this.sensors).find(key => this.sensors[key] === sensID);
         delete this.sensors[sensorIndex];
         this._updateDeviceInfo();
         resolve(true);
      })
    };

    service.on("online",()=>{
      this.debug("Received a signal online from the service");
      this.emit("online");
      this.initState = true;
    });
    
    service.on("offline",()=>{
      this.debug("Received a signal offline from the service");
      this.emit("offline");
      this.initState = false;
      this.status({fill:"red",shape:"dot",text:"offline"});
    });

    service.on(this.id,(states)=>{
      setTimeout(() => {
        this.needSendEvent = false;
      }, 2000);
      this.needSendEvent = true;
      states.forEach(cap => {
        let capabIndex = cap.type+"."+cap.state.instance;
        if (cap.type==="devices.capabilities.color_setting"){
          capabIndex = cap.type+".";
        };
        const capId = this.capabilites[capabIndex];
        // console.log("Emit",capId);
        this.emit(capId,cap.state.value, cap.state);
      });
    })

    this.on('close', (removed, done)=>{
      this.emit('offline');
      if (removed){
        this.deviceconfig = null;
        this._updateDeviceInfo(true);
      };
      setTimeout(()=>{
        // this.emit('offline');
        done();
      },300)
    });
  };
  RED.nodes.registerType("alice-device",AliceDevice);
};

