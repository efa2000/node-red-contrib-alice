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

    this.initState = false;
    this.ref = null;
    this.value = null;

    if (config.response === undefined){
      this.response = true;
    }

    this.init = ()=>{
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
      this.ref = this.device.getRef(this.id);
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
        },
        state: {
          value: this.modes[0],
          updatedfrom:"node-red",
          updated: this.device.getTime()
        }
      };

      if (!this.device.isDubCap(this.id, capab.type, capab.parameters.instance)){
        this.ref.set(capab)
          .then(ref=>{
            this.initState = true;
            this.value = capab.state.value;
            this.status({fill:"green",shape:"dot",text:"online"});
          });
      }else{
        this.status({fill:"red",shape:"dot",text:"error"});
        this.error("Dublicated capability on same device!");
      }
    };

    this.device.on("online",()=>{
      if (!this.initState){
        this.init();
      }else{
        this.ref = this.device.getRef(this.id);
        this.status({fill:"green",shape:"dot",text:"online"});
      }
    });

    this.device.on("offline",()=>{
      this.ref = null;
      this.status({fill:"red",shape:"dot",text:"offline"});
    });

    this.device.on(this.id,(val,state)=>{
      let value = val;
      this.send({
        payload: value
      });
      this.value = value;
      // если установлено требование немедленно отвечать, отвечаем
      if (this.response){
        this.ref.update({
          state:{
              value: value,
              updatedfrom: "node-red",
              updated: this.device.getTime()
          }
        }).catch(err=>{
          this.error("Response Errror: "+err.message);
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
      }
      if (!this.ref){
        this.error("Device offline");
        this.status({fill:"red",shape:"dot",text:"offline"});
        if (done) {done();}
        return;
      };
      this.ref.update({
        state:{
          value: value,
          updatedfrom: "node-red",
          updated: this.device.getTime()
        }
      }).then(ref=>{
        this.value = value;
        this.status({fill:"green",shape:"dot",text:value});
        if (done) {done();}
      }).catch(err=>{
        this.error("Error on update capability state:",err.message);
        this.status({fill:"red",shape:"dot",text:"Error"});
      })
    });

    this.on('close', function(removed, done) {
      if (removed) {
        this.ref.delete().then(res=>{
                done()
              }).catch(err=>{
                this.error(err.message);
                done();
              })
      }else{
        done();
      }
    });
  }  
  RED.nodes.registerType("Mode",AliceMode);
};