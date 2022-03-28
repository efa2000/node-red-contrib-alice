module.exports = function(RED) {

  // ************** Color  *******************
  function AliceColor(config){
    RED.nodes.createNode(this,config);
    this.device = RED.nodes.getNode(config.device);
    this.device.setMaxListeners(this.device.getMaxListeners() + 1); // увеличиваем лимит для event
    this.name = config.name;
    this.ctype = 'devices.capabilities.color_setting';
    this.instance = 'color_model';
    this.color_support = config.color_support;
    this.scheme = config.scheme;
    this.temperature_k = config.temperature_k;
    this.temperature_min = parseInt(config.temperature_min);
    this.temperature_max = parseInt(config.temperature_max);
    this.color_scene = config.color_scene || [];
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
    if (config.color_support === undefined){
      this.color_support = true
    };

    this.init = ()=>{
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
        reportable: true,
        parameters: {
          // instance: this.scheme,//this.instance,
          // color_model: this.scheme
        }
      };
      if (!this.color_support && !this.temperature_k && this.color_scene.length<1){
          this.error("Error on create capability: " + "At least one parameter must be enabled");
          this.status({fill:"red",shape:"dot",text:"error"});
          return;
      };
      if (this.color_scene.length>0){
        let scenes = [];
        this.color_scene.forEach(s=>{
          scenes.push({id:s});
        });
        capab.parameters.color_scene = {
          scenes:scenes
        };
        // capab.state.instance = 'scene';
        // capab.state.value = this.color_scene[0];
      };
      if (this.color_support){
        capab.parameters.color_model = this.scheme;
        // capab.state.instance = this.scheme;
        // if (this.scheme=="hsv"){
        //   capab.state.value = {h:0,s:0,v:0};
        // }else{
        //   capab.state.value = 0;
        // }
      };
      if (this.temperature_k){
        capab.parameters.temperature_k = {
          min: this.temperature_min,
          max: this.temperature_max
        };
        // capab.state.instance = 'temperature_k';
        // capab.state.value = this.temperature_min;
      };

      this.device.setCapability(this.id,capab)
        .then(res=>{
          this.initState = true;
          // this.value = JSON.stringify(capab.state.value);
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

    this.device.on(this.id,(val,newstate)=>{
// отправляем данные на выход
      let outmsgs=[null,null,null];
      switch (newstate.instance) {
        case 'rgb':
          let value = val;
          value = {
            r: val >> 16,
            g: val >> 8 & 0xFF,
            b: val & 0xFF
          };
          outmsgs[0]={ payload: value };
          break;
        case 'hsv':
          outmsgs[0]={ payload: val };
          break;
        case 'temperature_k':
          outmsgs[1]={ payload: val };
          break;
        case 'scene':
          outmsgs[2]={ payload: val };
          break;
      }
      this.send(outmsgs);
// возвращаем подтверждение в базу
      let state= {
        type:this.ctype,
        state:{
          instance:  newstate.instance,
          value: val
        }
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
      let state = {};
      switch (typeof value) {
        case 'object':
          if ((value.r>-1 && value.g>-1 && value.b>-1) || (value.h>-1 && value.s>-1 && value.v>-1)){
            if (this.scheme == 'rgb'){
              value = value.r << 16 | value.g << 8 | value.b;
            };
            state.value = value;
            state.instance = this.scheme
          }else{
            this.error("Wrong type! For Color, msg.payload must be RGB or HSV Object.");
            if (done) {done();}
            return;
          }
          break;
        case 'number':
          if (value>=this.temperature_min && value<=this.temperature_max){
            state.value = value;
            state.instance = 'temperature_k';
          }else{
            this.error("Wrong type! For Temperature_k, msg.payload must be >=MIN and <=MAX.");
            if (done) {done();}
            return;
          }
          break;
        case 'string':
          if (this.color_scene.includes(value)){
            state.value = value;
            state.instance = 'scene';
          }else{
            this.error("Wrong type! For the Scene, the msg.payload must be set in the settings");
            if (done) {done();}
            return;
          }
          break;
        default:
          this.error("Wrong type! Unsupported msg.payload type");
          if (done) {done();}
          return;
      }
      
      if (JSON.stringify(value) === this.value){
        this.debug("Value not changed. Cancel update");
        if (done) {done();}
        return;
      };
      let upState= {
        type:this.ctype,
        state:state
      };
      this.device.updateCapabState(this.id,upState)
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