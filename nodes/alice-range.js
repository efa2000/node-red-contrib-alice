module.exports = function(RED) {
      // ************** Range  *******************
  function AliceRange(config){
    RED.nodes.createNode(this,config);
    this.device = RED.nodes.getNode(config.device);
    this.device.setMaxListeners(this.device.getMaxListeners() + 1); // увеличиваем лимит для event
    this.name = config.name;
    this.ctype = 'devices.capabilities.range';
    this.retrievable = config.retrievable;
    this.instance = config.instance;
    this.unit = config.unit;
    this.random_access = true;
    this.min = parseFloat(config.min);
    this.max = parseFloat(config.max);
    this.precision = parseFloat(config.precision);
    this.response = config.response;
    this.initState = false;
    this.value = null;

    if (config.response === undefined){
      this.response = true;
    };
    if (typeof this.min != 'number'){this.min = 0};
    if (typeof this.max != 'number'){this.max = 100};
    if (typeof this.precision != 'number'){this.precision = 1};

    this.status({fill:"red",shape:"dot",text:"offline"});

    this.init = ()=>{
      let capab = {
        type: this.ctype,
        retrievable: this.retrievable,
        reportable: true,
        parameters: {
          instance: this.instance,
          unit: this.unit,
          random_access: this.random_access,
          range: {
              min: this.min,
              max: this.max,
              precision: this.precision
          }
        }
      };
      // если unit не пременим к параметру, то нужно удалить 
      if (this.unit == "unit.number"){
        delete capab.parameters.unit;
      };

      this.device.setCapability(this.id,capab)
      .then(res=>{
        this.initState = true;
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
      let state= {
        type:this.ctype,
        state:{
          instance: this.instance,
          value: value
        }
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
      let state= {
        type:this.ctype,
        state:{
          instance: this.instance,
          value: value
        }
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

    this.on('close', (removed, done)=>{
      this.device.setMaxListeners(this.device.getMaxListeners() - 1); // уменьшаем лимит для event
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