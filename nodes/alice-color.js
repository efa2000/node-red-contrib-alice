module.exports = function(RED) {

  // ************** Color  *******************
  function AliceColor(config){
    RED.nodes.createNode(this,config);
    this.device = RED.nodes.getNode(config.device);
    this.name = config.name;
    this.ctype = 'devices.capabilities.color_setting';
    this.instance = 'color_model';
    this.scheme = config.scheme;
    this.response = config.response;
    this.initState = false;
    this.ref = null;

    if (config.response === undefined){
        this.response = true;
    };

    this.init = ()=>{
      this.ref = this.device.getRef(this.id);
      var value = 0;
      if (this.scheme=="hsv"){
        value = {
          h:0,
          s:0,
          v:0
        };
      };
      let capab = {
        type: this.ctype,
        retrievable: true,
        parameters: {
          instance: this.scheme,//this.instance,
          color_model: this.scheme
        },
        state: {
          value: value,
          updatedfrom:"node-red",
          updated: this.device.getTime()
        }
      };
      if (!this.device.isDubCap(this.id,capab.type, null/*capab.parameters.instance*/)){
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
      const value = msg.payload;
      if (typeof value != 'number' && typeof value !='object'){
        this.error("Wrong type! msg.payload must be Integer or Object.");
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
        if (done) {done();}
      }).catch(err=>{
        this.error("err.message");
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
  RED.nodes.registerType("Color",AliceColor);
};