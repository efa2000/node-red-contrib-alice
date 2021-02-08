module.exports = function(RED) {
      // ************** Range  *******************
  function AliceRange(config){
    RED.nodes.createNode(this,config);
    this.device = RED.nodes.getNode(config.device);
    this.name = config.name;
    this.ctype = 'devices.capabilities.range';
    this.retrievable = config.retrievable;
    this.instance = config.instance;
    this.unit = config.unit;
    this.random_access = true;
    this.min = parseFloat(config.min) || 0;
    this.max = parseFloat(config.max) || 100;
    this.precision = parseFloat(config.precision) || 1;
    this.response = config.response;
    this.initState = false;
    this.value = null;

    if (config.response === undefined){
      this.response = true;
    }

    this.status({fill:"red",shape:"dot",text:"offline"});

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

    this.device.on(this.id,(val, fullstate)=>{
      let value = val;
      //проверка является ли значение относительным и нужно ли отдавать полное значение
      if (fullstate.relative && this.retrievable){
        value = this.value + val;
        if (val<0 && value<this.min) value=this.min;
        if (val>0 && value>this.max) value=this.max;
      };
      this.send({
        payload: value
      });
//      this.value = value;
      let state = {
        value: value,
        updatedfrom: "node-red",
        updated: this.device.getTime()
      };
      // если установлено требование немедленно отвечать, отвечаем
      if (this.response){
        this.device.updateCapabState(this.id,state)
        .then (res=>{
          this.value = value;
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
      if (typeof value != 'number'){
        this.error("Wrong type! msg.payload must be Number.");
        if (done) {done();}
        return;
      }
      if (value === this.value){
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
        this.value = value;
        this.status({fill:"green",shape:"dot",text:value});
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
  RED.nodes.registerType("Range",AliceRange);
};