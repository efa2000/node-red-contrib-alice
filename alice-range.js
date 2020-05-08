module.exports = function(RED) {
      // ************** Range  *******************
  function AliceRange(config){
    RED.nodes.createNode(this,config);
    this.device = RED.nodes.getNode(config.device);
    this.name = config.name;
    this.ctype = 'devices.capabilities.range';
    this.retrievable = config.retrievable || true;
    this.instance = config.instance;
    this.unit = config.unit;
    this.random_access = config.random_access || true;
    this.min = parseFloat(config.min) || 0;
    this.max = parseFloat(config.max) || 100;
    this.precision = parseFloat(config.precision) || 1;
    this.initState = false;
    this.ref = null;

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