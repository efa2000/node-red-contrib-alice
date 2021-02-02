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

    if (config.response === undefined){
        this.response = true;
    };
    if (config.retrievable === undefined){
      this.retrievable = true;
    };
    if (!this.retrievable){
      this.split = true;
    };

    this.status({fill:"red",shape:"dot",text:"offline"});

    this.init = ()=>{
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
      this.device.setCapability(this.id,capab)
        .then(res=>{
          this.status({fill:"green",shape:"dot",text:"online"});
          this.initState = true;
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
      this.send({
        payload: val
      });
      if (this.response){
          this.device.updateCapabState(this.id,{
            value: val,
            updatedfrom: "node-red",
            updated: this.device.getTime()
          })
          .then (res=>{
            this.status({fill:"green",shape:"dot",text:"online"});
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
      this.device.updateCapabState(this.id,{
        value: msg.payload,
        updatedfrom: "node-red",
        updated: this.device.getTime()
      })
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
  RED.nodes.registerType("On_Off",AliceOnOff);
};