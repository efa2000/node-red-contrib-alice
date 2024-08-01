module.exports = function(RED) {
// ************** ON/OFF *******************
function AliceSensor(config){
    RED.nodes.createNode(this,config);
    const device = RED.nodes.getNode(config.device);
    device.setMaxListeners(device.getMaxListeners() + 1); // увеличиваем лимит для event
    const id =JSON.parse(JSON.stringify(this.id));
    const name = config.name;
    const stype = config.stype;
    const reportable = true;
    const retrievable = true;
    const unit = config.unit;
    const instance = config.instance;
    let initState = false;
    // this.value;
    let curentState= {
      type:stype,
      state:{
        instance: instance,
        value: 0
      }
    };

    this.status({fill:"red",shape:"dot",text:"offline"});

    this.init = ()=>{
      this.debug("Starting sensor initilization ...");
      let sensor = {
        type: stype,
        reportable: reportable,
        retrievable: retrievable,
        parameters: {
          instance: instance,
          unit: unit
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
      if (typeof msg.payload != 'number'){
        this.error("Wrong type! msg.payload must be number.");
        if (done) {done();}
        return;
      };
      if (unit == 'unit.temperature.celsius' || unit == 'unit.ampere'){
        msg.payload = +msg.payload.toFixed(1);
      }else {
        msg.payload = +msg.payload.toFixed(0);
      };
      if (curentState.state.value == msg.payload){
        this.debug("Value not changed. Cancel update");
        if (done) {done();}
        return;
      };
      curentState.state.value = msg.payload;
      device.updateSensorState(id,curentState)
      .then(ref=>{
        this.status({fill:"green",shape:"dot",text: msg.payload});
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
        device.setMaxListeners(device.getMaxListeners() - 1);
        done();
      }
    });
  }  
  RED.nodes.registerType("Sensor",AliceSensor);
};