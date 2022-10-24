module.exports = function(RED) {
 // ************** Toggle *******************
  function AliceToggle(config){
    RED.nodes.createNode(this,config);
    this.device = RED.nodes.getNode(config.device);
    this.device.setMaxListeners(this.device.getMaxListeners() + 1); // увеличиваем лимит для event
    this.name = config.name;
    this.ctype = 'devices.capabilities.toggle';
    this.instance = config.instance;
    this.response = config.response;
    this.initState = false;
    this.value = false;

    if (config.response === undefined){
        this.response = true;
    }

    this.status({fill:"red",shape:"dot",text:"offline"});

    this.init = ()=>{
      this.debug("Starting capability initilization ...");
      let capab = {
        type: this.ctype,
        retrievable: true,
        reportable: true,
        parameters: {
          instance: this.instance,
        }
      };
      this.device.setCapability(this.id,capab)
        .then(res=>{
          this.initState = true;
          // this.value = capab.state.value;
          this.debug("Capability initilization - success!");
          this.status({fill:"green",shape:"dot",text:"online"});
        })
        .catch(err=>{
          this.error("Error on create capability: " + err.message);
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

    this.device.on(this.id,(val)=>{
      this.debug("Received a new value from Yandex...");
      this.send({
        payload: val
      });
      let state= {
        type:this.ctype,
        state:{
          instance: this.instance,
          value: val
        }
      };
      if (this.response){
        this.debug("Automatic confirmation is true, sending confirmation to Yandex ...");
        this.device.updateCapabState(this.id,state)
        .then (res=>{
          this.value = val;
          this.status({fill:"green",shape:"dot",text:val});
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
      if (msg.payload === this.value){
        this.debug("Value not changed. Cancel update");
        if (done) {done();}
        return;
      };
      let state= {
        type:this.ctype,
        state:{
          instance: this.instance,
          value: msg.payload
        }
      };
      this.device.updateCapabState(this.id,state)
      .then(ref=>{
        this.value = msg.payload;
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
      if (removed) {
        this.device.delCapability(this.id)
        .then(res=>{
          done()
        })
        .catch(err=>{
          this.error("Error on delete capability: " + err.message);
          done();
        })
      }else{
        done();
      }
    });
  }  
  RED.nodes.registerType("Toggle",AliceToggle);
};