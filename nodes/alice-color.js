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
    this.value;

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
      this.device.setCapability(this.id,capab)
        .then(res=>{
          this.initState = true;
          this.value = JSON.stringify(capab.state.value);
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
      let state = {
        value: val,
        updatedfrom: "node-red",
        updated: this.device.getTime()
      };
      if (this.response){
        this.device.updateCapabState(this.id,state)
        .then (res=>{
          this.value = JSON.stringify(val);
          this.status({fill:"green",shape:"dot",text:"online"});
        })
        .catch(err=>{
          this.error("Error on update capability state: " + err.message);
          this.status({fill:"red",shape:"dot",text:"Error"});
        })
      };
    })

    this.on('input', (msg, send, done)=>{
      let value = msg.payload;
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
      if (this.needConvert){
        value = value.r << 16 | value.g << 8 | value.b;
      }
      if (JSON.stringify(value) === this.value){
        this.debug("Value not changed. Cancel update");
        if (done) {done();}
        return;
      };

      let state = {
        value: value,
        updatedfrom: "node-red",
        updated: this.device.getTime()
      };

      this.device.updateCapabState(this.id,state)
      .then(ref=>{
        this.value = JSON.stringify(value);
        this.status({fill:"green",shape:"dot",text:JSON.stringify(msg.payload)});
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
  RED.nodes.registerType("Color",AliceColor);
};