module.exports = function(RED) {

  // ************** Color  *******************
  function AliceColor(config){
    RED.nodes.createNode(this,config);
    this.device = RED.nodes.getNode(config.device);
    this.name = config.name;
    this.ctype = 'devices.capabilities.color_setting';
    this.instance = 'color_model';
    this.scheme = config.scheme;
    this.needConvert = false;
    this.response = config.response;
    this.initState = false;
    this.ref = null;

    if (this.scheme == "rgb_normal"){
      this.scheme = "rgb";
      this.needConvert = true;
    };

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
        var value = val;
        if (this.needConvert){
          value = {
            r: val >> 16,
            g: val >> 8 & 0xFF,
            b: val & 0xFF
          }
        };
        this.send({
            payload: value
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
      var value = msg.payload;
      if (this.scheme=='rgb' && !this.needConvert && typeof value !='number' ){
        this.error("Wrong type! msg.payload must be Integer.");
        if (done) {done();}
        return;
      };
      if (this.scheme=='rgb' && this.needConvert && typeof value !='object' ){
        this.error("Wrong type! msg.payload must be RGB Object.");
        if (done) {done();}
        return;
      };
      if (this.scheme=='hsv' && typeof value !='object' ){
        this.error("Wrong type! msg.payload must be HSV Object.");
        if (done) {done();}
        return;
      };
      if (!this.ref){
        this.error("Device offline");
        this.status({fill:"red",shape:"dot",text:"offline"});
        if (done) {done();}
        return;
      };
      if (this.needConvert){
        value = value.r << 16 | value.g << 8 | value.b;
      }
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