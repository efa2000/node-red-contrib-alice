module.exports = function(RED) {
      // ************** Range  *******************
  function AliceRange(config){
    RED.nodes.createNode(this,config);
    this.device = RED.nodes.getNode(config.device);
    this.name = config.name;
    this.ctype = 'devices.capabilities.range';
    this.retrievable = true;
    this.instance = config.instance;
    this.unit = config.unit;
    this.random_access = true;
    this.min = parseFloat(config.min) || 0;
    this.max = parseFloat(config.max) || 100;
    this.precision = parseFloat(config.precision) || 1;
    this.response = config.response;
    this.initState = false;
    this.ref = null;
    this.value = null;

    if (config.response === undefined){
      this.response = true;
    }

    this.init = ()=>{
      this.ref = this.device.getRef(this.id);
      let capab = {
        type: this.ctype,
        retrievable: this.retrievable,
        parameters: {
          instance: this.instance,
          unit: this.unit,
          random_access: this.random_access,
          range: {
              min: this.min,
              max: this.max,
              precision: this.precision
          }
        },
        state: {
          value: this.min,
          updatedfrom:"node-red",
          updated: this.device.getTime()
        }
      };
      // если unit не пременим к параметру, то нужно удалить 
      if (this.unit == "unit.number"){
        delete capab.parameters.unit;
      };

      if (!this.device.isDubCap(this.id,capab.type, capab.parameters.instance)){
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
      //проверка является ли значение относительным
      if (state.relative){
        value = this.value + val;
        if (val<0 && value<this.min) value=this.min;
        if (val>0 && value>this.max) value=this.max;
      };
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
      if (typeof value != 'number'){
        this.error("Wrong type! msg.payload must be Integer or Float.");
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
  RED.nodes.registerType("Range",AliceRange);
};