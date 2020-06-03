module.exports = function(RED) {
// ************** ON/OFF *******************
function AliceOnOff(config){
    RED.nodes.createNode(this,config);
    this.device = RED.nodes.getNode(config.device);
    this.name = config.name;
    this.response = config.response;
    this.ctype = 'devices.capabilities.on_off';
    this.retrievable = config.retrievable;
    this.split = false;
    this.instance = 'on';
    this.initState = false;
    this.ref = null;

    if (config.response === undefined){
        this.response = true;
    }
    if (config.retrievable === undefined){
      this.retrievable = true;
    }
    
    if (!this.retrievable){
      this.split = true;
    }

    this.init = ()=>{
      this.ref = this.device.getRef(this.id);
      let capab = {
        type: this.ctype,
        retrievable: this.retrievable,
        parameters: {
          instance: this.instance,
          split: this.split
        },
        state: {
          value: false,
          updatedfrom:"node-red",
          updated: this.device.getTime()
        }
      };
      if (!this.device.isDubCap(this.id,capab.type, capab.parameters.instance)){
        this.ref.set(capab)
          .then(ref=>{
            this.status({fill:"green",shape:"dot",text:"online"});
            this.initState = true;
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

    this.device.on(this.id,(val)=>{
      this.send({
        payload: val
      });
      if (this.response){
          this.ref.update({
            state:{
                value: val,
                updatedfrom: "node-red",
                updated: this.device.getTime()
            }
          }).catch(err=>{
            this.error("Response Errror: "+err.message);
          })
      };
    })

    this.on('input', (msg, send, done)=>{
      if (typeof msg.payload != 'boolean'){
        this.error("Wrong type! msg.payload must be boolean.");
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
          value: msg.payload,
          updatedfrom: "node-red",
          updated: this.device.getTime()
        }
      }).then(ref=>{
        if (done) {done();}
      }).catch(err=>{
        this.error(err.message);
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
  RED.nodes.registerType("On_Off",AliceOnOff);
};