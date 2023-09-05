const axios = require('axios');


module.exports = function(RED) {
    // ***************************** Alice DEVICE ****************************
  function AliceDevice(config){
    const pjson = require('../package.json');
    RED.nodes.createNode(this,config);
    const service = RED.nodes.getNode(config.service);
    service.setMaxListeners(service.getMaxListeners() + 1); // увеличиваем лимит для event
    const name = config.name;
    const description = config.description;
    const room = config.room;
    const dtype = config.dtype;
    this.initState = false;
    let updating = false;
    let needSendEvent = false;
    let capabilites = {};
    let sensors = {};
    let deviceconfig = {
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
    let states = {
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
      if (deviceconfig === null || (deviceconfig.capabilities.length==0 && deviceconfig.properties.length==0)){
        data = '';
      }else{
        data = JSON.stringify(deviceconfig);
      };
      if (now){
        this.debug("Updating Device info ...");
        service.send2gate('$me/device/state/'+this.id, data ,true);
        return;
      };
      if (!updating){
        updating = true;
        setTimeout(() => {
          this.debug("Updating Device info ...");
          updating = false;
          let nData = JSON.stringify(deviceconfig);
          if (deviceconfig === null){ nData = ''};
          service.send2gate('$me/device/state/'+this.id, nData ,true);
        }, 300);
      }
    };
// функция обновления состояния устройства (умений и сенсоров) 
    this._updateDeviceState= (event=null)=>{
      // if (states === null || (states.capabilities.length==0 && states.properties.length==0)){
      //   data = '';
      // }else{
      //   data = JSON.stringify(states);
      // };
      // service.send2gate('$me/device/state/'+this.id+'/states', data ,true);
      let data = states;
      if (states === null || (states.capabilities.length==0 && states.properties.length==0)){
        data = null;
      };
      const option = {
        timeout: 2000,
        method: 'POST',
        url: 'https://api.nodered-home.ru/gtw/device/state',
        headers: {
          'content-type': 'application/json',
          'Authorization': "Bearer "+service.getToken()
        },
        data: {
          event: event,
          state: states
        }
      };
      if (states === null || (states.capabilities.length==0 && states.properties.length==0)){
        return;
      };
      axios.request(option)
      .then(res=>{
        this.trace("Device state updated successfully");
      })
      .catch(error=>{
        this.error("Error when update device state: "+error.message);
      })
    };
// отправка эвентов
    this._sendEvent = (event)=>{
      let data = JSON.stringify(event);
      service.send2gate('$me/device/events/'+this.id, data ,false);
    };
// Установка параметров умения 
    this.setCapability = (capId, capab)=>{
      return new Promise((resolve,reject)=>{
        let intsance = capab.parameters.instance || '';
        let capabIndex = capab.type+"."+intsance;
        if (capabilites[capabIndex] && capabilites[capabIndex]!=capId){
          reject(new Error("Dublicated capability on same device!"));
          return;
        };
        // проверям было ли такое умение раньше и удалем перед обновлением
        if (deviceconfig.capabilities.findIndex(a => a.id === capId)>-1){
          this.delCapability(capId);
        };
        capabilites[capabIndex] = capId; // добавляем новое уменя в локальный список
        capab.id = capId;
        deviceconfig.capabilities.push(capab);
        this._updateDeviceInfo();
        resolve(true);     
      })
    };
// Установка параметров сенсора 
    this.setSensor = (sensId, sensor)=>{
      return new Promise((resolve,reject)=>{
        let sensorIndex = sensor.type+"."+sensor.parameters.instance;
        if (sensors[sensorIndex] && sensors[sensorIndex]!=sensId){
          reject(new Error("Dublicated sensor on same device!"));
          return;
        };
        // проверям было ли такое сенсор раньше и удалем перед обновлением
        if (deviceconfig.properties.findIndex(a => a.id === sensId)>-1){
          this.delSensor(sensId);
        };
        sensors[sensorIndex] = sensId; // добавляем новый сенсор в локальный список 
        sensor.id = sensId;
        deviceconfig.properties.push(sensor);
        this._updateDeviceInfo();
        resolve(true);
      })
    };

// обновление текущего state умения
    this.updateCapabState = (capId,state)=>{
      return new Promise((resolve,reject)=>{
        state.id = capId;
        if (needSendEvent){
          this._sendEvent(state);
        };
        const index = states.capabilities.findIndex(a => a.id === capId);
        if (index>-1){
          states.capabilities.splice(index, 1);
        };
        states.capabilities.push(state);
        const currentevent = {
          id: this.id,
          capabilities:[state]
        };
        this._updateDeviceState(currentevent);
        resolve(true);
        //   reject(new Error("Device not ready"));
      })
    };
// обновление текущего state сенсора
    this.updateSensorState = (sensID,state)=>{
      return new Promise((resolve,reject)=>{
        state.id = sensID;
        const index = states.properties.findIndex(a => a.id === sensID);
        if (index>-1){
          states.properties.splice(index, 1);
        };
        states.properties.push(state);
        const currentevent = {
          id: this.id,
          properties:[state]
        };
        this._updateDeviceState(currentevent);
        resolve(true);
        //   reject(new Error("Device not ready"));
      })
    };

// удаление умения 
    this.delCapability=  (capId)=>{
      return new Promise((resolve,reject)=>{
        // удаляем из конфига
        const index = deviceconfig.capabilities.findIndex(a => a.id === capId);
        if (index>-1){
          deviceconfig.capabilities.splice(index, 1);
        };
        // удаляем из карты 
        let capabIndex = Object.keys(capabilites).find(key => capabilites[key] === capId);
        delete capabilites[capabIndex];
        this._updateDeviceInfo();
        // удаляем его текущее состояние 
        const stateindex = states.capabilities.findIndex(a => a.id === capId);
        if (stateindex>-1){
          states.capabilities.splice(stateindex, 1);
        };
        this._updateDeviceState();
        resolve(true);
      })
    };

// удаление сенсора
    this.delSensor= (sensID)=>{
      return new Promise((resolve,reject)=>{
        // удаляем из конфига
        const index = deviceconfig.properties.findIndex(a => a.id === sensID);
        if (index>-1){
          deviceconfig.properties.splice(index, 1);
        }
        // удаляем из карты 
        let sensorIndex = Object.keys(sensors).find(key => sensors[key] === sensID);
        delete sensors[sensorIndex];
        this._updateDeviceInfo();
        // удаляем текущее состояние 
        const stateindex = states.properties.findIndex(a => a.id === sensID);
        if (stateindex>-1){
            states.properties.splice(stateindex, 1);
        };
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
        needSendEvent = false;
      }, 2000);
      needSendEvent = true;
      states.forEach(cap => {
        let capabIndex = cap.type+"."+cap.state.instance;
        if (cap.type==="devices.capabilities.color_setting"){
          capabIndex = cap.type+".";
        };
        const capId = capabilites[capabIndex];
        this.emit(capId,cap.state.value, cap.state);
      });
    })

    this.on('close', (removed, done)=>{
      this.emit('offline');
      if (removed){
        deviceconfig = null;
        states = null;
        this._updateDeviceState();
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