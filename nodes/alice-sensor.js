module.exports = function(RED) {
// ************** ON/OFF *******************
function AliceSensor(config){
    RED.nodes.createNode(this,config);
    this.device = RED.nodes.getNode(config.device);
    this.device.setMaxListeners(this.device.getMaxListeners() + 1); // увеличиваем лимит для event
    this.name = config.name;
    this.stype = config.stype;
    this.reportable = true;
    this.retrievable = true;
    this.unit = config.unit;
    this.instance = config.instance;
    this.initState = false;
    this.value;
    let curentState= {
      type:this.stype,
      state:{
        instance: this.instance,
        value: 0
      }
    };

    this.status({fill:"red",shape:"dot",text:"offline"});

    this.init = ()=>{
      this.debug("Starting sensor initilization ...");
      let sensor = {
        type: this.stype,
        reportable: this.reportable,
        retrievable: this.retrievable,
        parameters: {
          instance: this.instance,
          unit: this.unit
        }
      };

      this.device.setSensor(this.id,sensor)
        .then(res=>{
          this.debug("Sensor initilization - success!");
          this.status({fill:"green",shape:"dot",text:"online"});
          this.initState = true;
        })
        .catch(err=>{
          this.error("Error on create sensor: " +err.message);
          this.status({fill:"red",shape:"dot",text:"error"});
        });
    };

// Проверяем сам девайс уже инициирован 
    if (this.device.initState) this.init();

    this.device.on("online",()=>{
      this.init();
    });

    this.device.on("offline",()=>{
      this.status({fill:"red",shape:"dot",text:"offline"});
    });

    this.on('input', (msg, send, done)=>{
      if (this.stype =='devices.properties.float' && typeof msg.payload != 'number'){
        this.error("Wrong type! msg.payload must be number.");
        if (done) {done();}
        return;
      };
      if (this.unit == 'unit.percent'){
        msg.payload = +msg.payload.toFixed(0);
      }else {
        msg.payload = +msg.payload.toFixed(2);
      };
      if (msg.payload === this.value){
        this.debug("Value not changed. Cancel update");
        if (done) {done();}
        return;
      };
      let state= {
        type:this.stype,
        state:{
          instance: this.instance,
          value: msg.payload
        }
      };
      this.device.updateSensorState(this.id,state)
      .then(ref=>{
        this.value = msg.payload;
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
        this.device.delSensor(this.id)
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
  RED.nodes.registerType("Sensor",AliceSensor);
};