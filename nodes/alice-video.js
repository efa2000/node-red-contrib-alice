module.exports = function(RED) {
// ************** ON/OFF *******************
function AliceVideo(config){
    RED.nodes.createNode(this,config);
    const device = RED.nodes.getNode(config.device);
    device.setMaxListeners(device.getMaxListeners() + 1); // увеличиваем лимит для event
    const id =this.id;
    const name = config.name;
    const ctype = 'devices.capabilities.video_stream';
    const instance = 'on';
    let response = config.response;
    let retrievable = config.retrievable;
    let split = false;
    let initState = false;
    let curentState = {
      type:ctype,
      state:{
        instance: instance,
        value: false
      }
    };

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
      device.updateCapabState(id,curentState)
      .then (res=>{
        this.status({fill:"green",shape:"dot",text:"online"});
      })
      .catch(err=>{
        this.error("Error on update capability state: " + err.message);
        this.status({fill:"red",shape:"dot",text:"Error"});
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
      if (response){
          curentState.state.value = val;
          device.updateCapabState(id,curentState)
          .then (res=>{
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
      if (msg.payload === curentState.state.value){
        this.debug("Value not changed. Cancel update");
        if (done) {done();}
        return;
      };
      curentState.state.value = msg.payload;
      device.updateCapabState(id,curentState)
      .then(ref=>{
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
  RED.nodes.registerType("Video",AliceVideo);
};