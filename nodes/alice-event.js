module.exports = function(RED) {
// ************** ON/OFF *******************
function AliceEvent(config){
    RED.nodes.createNode(this,config);
    const device = RED.nodes.getNode(config.device);
    device.setMaxListeners(device.getMaxListeners() + 1); // увеличиваем лимит для event
    const id =JSON.parse(JSON.stringify(this.id));
    const name = config.name;
    const stype = 'devices.properties.event';
    const instance = config.instance;
    const reportable = true;
    const retrievable = true;
    const events = config.events;
    let initState = false;
    let curentState = {
      type:stype,
      state:{
        instance: instance,
        value: ''
      }
    };
    this.status({fill:"red",shape:"dot",text:"offline"});

    this.init = ()=>{
      this.debug("Starting sensor initilization ...");
      let objEvents=[]
      events.forEach(v => {
        objEvents.push({value:v})
      });
      let sensor = {
        type: stype,
        reportable: reportable,
        retrievable: retrievable,
        parameters: {
          instance: instance,
          events: objEvents
        }
      };

      device.setSensor(id,sensor)
        .then(res=>{
          this.debug("Sensor initilization - success!");
          this.status({fill:"green",shape:"dot",text:"online"});
          initState = true;
        })
        .catch(err=>{
          this.error("Error on create sensor: " +err.message);
          this.status({fill:"red",shape:"dot",text:"error"});
        });
    };

// Проверяем сам девайс уже инициирован 
    if (device.initState) this.init();

    device.on("online",()=>{
      this.init();
    });

    device.on("offline",()=>{
      this.status({fill:"red",shape:"dot",text:"offline"});
    });

    this.on('input', (msg, send, done)=>{
      if (!events.includes(msg.payload)){
        this.error("Wrong type! msg.payload must be from the list of allowed events.");
        if (done) {done();}
        return;
      };
      if (curentState.state.value==msg.payload){
        this.debug("Value not changed. Cancel update");
        if (done) {done();}
        return;
      }else{
        curentState.state.value = msg.payload;
      };
      // для кнопок обнуляем значение через 1 сек
      if (instance=='button'){
        setTimeout(() => {
          curentState.state.value = null;
          this.status({fill:"green",shape:"dot",text:""});
        }, 1000);
      };
      device.updateSensorState(id,curentState)
      .then(ref=>{
        this.status({fill:"green",shape:"dot",text: curentState.state.value});
        if (done) {done();}
      })
      .catch(err=>{
        this.error("Error on update sensor state: " +err.message);
        this.status({fill:"red",shape:"dot",text:"Error"});
        if (done) {done();}
      })
    });

    this.on('close', function(removed, done) {
      if (removed) {
        device.delSensor(id)
        .then(res=>{
          done()
        })
        .catch(err=>{
          this.error("Error on delete property: " +err.message);
          done();
        })
      }else{
        done();
      }
    });
  }  
  RED.nodes.registerType("Event",AliceEvent);
};