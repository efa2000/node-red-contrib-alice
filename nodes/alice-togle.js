module.exports = function(RED) {
 // ************** Toggle *******************
  function AliceToggle(config){
    RED.nodes.createNode(this,config);
    this.device = RED.nodes.getNode(config.device);
    this.name = config.name;
    this.ctype = 'devices.capabilities.toggle';
    this.instance = config.instance;
    this.response = config.response;
    this.initState = false;
    this.value;

    if (config.response === undefined){
        this.response = true;
    }

    this.status({fill:"red",shape:"dot",text:"offline"});

    this.init = ()=>{
      this.ref = this.device.getRef(this.id);
      let capab = {
        type: this.ctype,
        retrievable: true,
        reportable: true,
        parameters: {
          instance: this.instance,
        },
        state: {
          value: false,
          updatedfrom:"node-red",
          updated: this.device.getTime()
        }
      };
      this.device.setCapability(this.id,capab)
        .then(res=>{
          this.initState = true;
          this.value = capab.state.value;
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
      let state={
          value: val,
          updatedfrom: "node-red",
          updated: this.device.getTime()
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
      let state = {
        value: msg.payload,
        updatedfrom: "node-red",
        updated: this.device.getTime()
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