module.exports = function(RED) {
      // ************** Modes  *******************
  function AliceMode(config){
    RED.nodes.createNode(this,config);
    this.device = RED.nodes.getNode(config.device);
    this.name = config.name;
    this.ctype = 'devices.capabilities.mode';
    this.retrievable = true;
    this.random_access = true;
    this.response = config.response;
    this.instance = config.instance;
    this.modes = config.modes;
    let initState = false;
    let currentValue;

    if (config.response === undefined){
      this.response = true;
    }

    init = _=>{
      if (this.modes.length<1){
        this.status({fill:"red",shape:"dot",text:"error"});
        this.error("In the list of supported commands, there must be at least one command");
        return;
      };
      if (!this.instance){
        this.status({fill:"red",shape:"dot",text:"error"});
        this.error("Mode type not selected");
        return;
      };
      var cfgModes = [];
      this.modes.forEach(v=>{
        cfgModes.push({value:v});
      });
      let capab = {
        type: this.ctype,
        retrievable: this.retrievable,
        parameters: {
          instance: this.instance,
          modes: cfgModes
        }
      };
      this.device.setCapability(this.id,capab)
      .then(res=>{
        initState = true;
        this.status({fill:"green",shape:"dot",text:"online"});
      })
      .catch(err=>{
        this.error("Error on create capability: " + err.message);
        this.status({fill:"red",shape:"dot",text:"error"});
      });
    };

    // Проверяем сам девайс уже инициирован 
    if (this.device.initState) init();

    this.device.on("online",()=>{
      if (initState){
        this.status({fill:"green",shape:"dot",text:currentValue});
      }else{
        init();
      }
    });

    this.device.on("offline",()=>{
      this.status({fill:"red",shape:"dot",text:"offline"});
    });

    this.device.on(this.id,(val,fullstate)=>{
      let value = val;
      this.send({
        payload: value
      });
      let state= {
        type:this.ctype,
        state:{
          instance: this.instance,
          value: value
        }
      };
      if (this.response){
        this.device.updateCapabState(this.id,state)
        .then (res=>{
          currentValue = value;
          this.status({fill:"green",shape:"dot",text:"online"});
        })
        .catch(err=>{
          this.error("Error on update capability state: " + err.message);
          this.status({fill:"red",shape:"dot",text:"Error"});
        })
      };
    })

    this.on('input', (msg, send, done)=>{
      const value = msg.payload;
      if (typeof value != 'string'){
        this.error("Wrong type! msg.payload must be String.");
        this.status({fill:"red",shape:"dot",text:"Error"});
        if (done) {done();}
        return;
      };
      if (this.modes.indexOf(value)<0){
        this.error("Error! Unsupported command.");
        this.status({fill:"red",shape:"dot",text:"Error"});
        if (done) {done();}
        return;
      };
      if (value === currentValue){
        this.debug("Value not changed. Cancel update");
        if (done) {done();}
        return;
      };
      let state= {
        type:this.ctype,
        state:{
          instance: this.instance,
          value: value
        }
      };
      this.device.updateCapabState(this.id,state)
      .then(ref=>{
        currentValue = value;
        this.status({fill:"green",shape:"dot",text:currentValue});
        if (done) {done();}
      })
      .catch(err=>{
        this.error("Error on update capability state: " + err.message);
        this.status({fill:"red",shape:"dot",text:"Error"});
        if (done) {done();}
      });
    });

    this.on('close', function(removed, done) {
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
  RED.nodes.registerType("Mode",AliceMode);
};