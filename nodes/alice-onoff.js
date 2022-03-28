module.exports = function(RED) {
// ************** ON/OFF *******************
function AliceOnOff(config){
    RED.nodes.createNode(this,config);
    const device = RED.nodes.getNode(config.device);
    device.setMaxListeners(device.getMaxListeners() + 1); // увеличиваем лимит для event
    const id =JSON.parse(JSON.stringify(this.id));
    const name = config.name;
    const ctype = 'devices.capabilities.on_off';
    const instance = 'on';
    let response = config.response;
    let retrievable = config.retrievable;
    let split = false;
    let value;
    let initState = false;

    if (config.response === undefined){
        response = true;
    };
    if (config.retrievable === undefined){
      retrievable = true;
    };
    if (!retrievable){
      split = true;
    };

    this.status({fill:"red",shape:"dot",text:"offline"});

    this.init = ()=>{
      this.debug("Starting capability initilization ...");
      let capab = {
        type: ctype,
        retrievable: retrievable,
        parameters: {
          instance: instance,
          split: split
        }
      };

      device.setCapability(id,capab)
      .then(res=>{
        this.debug("Capability initilization - success!");
        initState = true;
        this.status({fill:"green",shape:"dot",text:"online"});
      })
      .catch(err=>{
        this.error("Error on create capability: " + err.message);
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

    device.on(id,(val)=>{
      this.send({
        payload: val
      });
      let state= {
        type:ctype,
        state:{
          instance: instance,
          value: val
        }
      };
      if (response){
          device.updateCapabState(id,state)
          .then (res=>{
            value = val;
            this.status({fill:"green",shape:"dot",text:val.toString()});
          })
          .catch(err=>{
            this.error("Error on update capability state: " + err.message);
            this.status({fill:"red",shape:"dot",text:"Error"});
          })
      };
    })

    this.on('input', (msg, send, done)=>{
      if (typeof msg.payload != 'boolean'){
        this.error("Wrong type! msg.payload must be boolean.");
        if (done) {done();}
        return;
      };
      if (msg.payload === value){
        this.debug("Value not changed. Cancel update");
        if (done) {done();}
        return;
      };
      let state= {
        type:ctype,
        state:{
          instance: instance,
          value: msg.payload
        }
      };
      device.updateCapabState(id,state)
      .then(ref=>{
        value = msg.payload;
        this.status({fill:"green",shape:"dot",text:msg.payload.toString()});
        if (done) {done();}
      })
      .catch(err=>{
        this.error("Error on update capability state: " + err.message);
        this.status({fill:"red",shape:"dot",text:"Error"});
        if (done) {done();}
      })
    });

    this.on('close', (removed, done)=>{
      device.setMaxListeners(device.getMaxListeners() - 1);
      if (removed) {
        device.delCapability(id)
        .then(res=>{
          done()
        })
        .catch(err=>{
          this.error("Error on delete capability: " + err.message);
          done();
        })
      };
      done();
      return;
    });
  }  
  RED.nodes.registerType("On_Off",AliceOnOff);
};