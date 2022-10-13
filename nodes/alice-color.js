module.exports = function(RED) {

  // ************** Color  *******************
  function AliceColor(config){
    RED.nodes.createNode(this,config);
    const device = RED.nodes.getNode(config.device);
    device.setMaxListeners(device.getMaxListeners() + 1); // увеличиваем лимит для event
    const name = config.name;
    const ctype = 'devices.capabilities.color_setting';
    const instance = 'color_model';
    let color_support = config.color_support;
    let scheme = config.scheme;
    const temperature_k = config.temperature_k;
    const temperature_min = parseInt(config.temperature_min);
    const temperature_max = parseInt(config.temperature_max);
    const color_scene = config.color_scene || [];
    let needConvert = false;
    let response = config.response;
    let initState = false;
    let curentValue;

    if (scheme == "rgb_normal"){
      scheme = "rgb";
      needConvert = true;
    };
    if (config.response === undefined){
        response = true;
    };
    if (config.color_support === undefined){
      color_support = true
    };

    init = ()=>{
      var value = 0;
      if (scheme=="hsv"){
        value = {
          h:0,
          s:0,
          v:0
        };
      };
      let capab = {
        type: ctype,
        retrievable: true,
        reportable: true,
        parameters: {
          // instance: scheme,//instance,
          // color_model: scheme
        }
      };
      if (!color_support && !temperature_k && color_scene.length<1){
          this.error("Error on create capability: " + "At least one parameter must be enabled");
          this.status({fill:"red",shape:"dot",text:"error"});
          return;
      };
      if (color_scene.length>0){
        let scenes = [];
        color_scene.forEach(s=>{
          scenes.push({id:s});
        });
        capab.parameters.color_scene = {
          scenes:scenes
        };
        // capab.state.instance = 'scene';
        // capab.state.value = color_scene[0];
      };
      if (color_support){
        capab.parameters.color_model = scheme;
        // capab.state.instance = scheme;
        // if (scheme=="hsv"){
        //   capab.state.value = {h:0,s:0,v:0};
        // }else{
        //   capab.state.value = 0;
        // }
      };
      if (temperature_k){
        capab.parameters.temperature_k = {
          min: temperature_min,
          max: temperature_max
        };
        // capab.state.instance = 'temperature_k';
        // capab.state.value = temperature_min;
      };

      device.setCapability(this.id,capab)
        .then(res=>{
          initState = true;
          // curentValue = JSON.stringify(capab.state.value);
          this.status({fill:"green",shape:"dot",text:"online"});
        })
        .catch(err=>{
          this.error("Error on create capability: " + err.message);
          this.status({fill:"red",shape:"dot",text:"error"});
        });
    };

    // Проверяем сам девайс уже инициирован 
    if (device.initState) init();

    device.on("online",()=>{
      if (initState){
        this.status({fill:"green",shape:"dot",text:JSON.stringify(curentValue)});
      }else{
        init();
      }
    });

    device.on("offline",()=>{
      this.status({fill:"red",shape:"dot",text:"offline"});
    });

    device.on(this.id,(val,newstate)=>{
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
        type:ctype,
        state:{
          instance:  newstate.instance,
          value: val
        }
      };
      if (response){
        device.updateCapabState(this.id,state)
        .then (res=>{
          curentValue = JSON.stringify(val);
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
            if (scheme == 'rgb'){
              value = value.r << 16 | value.g << 8 | value.b;
            };
            state.value = value;
            state.instance = scheme
          }else{
            this.error("Wrong type! For Color, msg.payload must be RGB or HSV Object.");
            if (done) {done();}
            return;
          }
          break;
        case 'number':
          if (value>=temperature_min && value<=temperature_max){
            state.value = value;
            state.instance = 'temperature_k';
          }else{
            this.error("Wrong type! For Temperature_k, msg.payload must be >=MIN and <=MAX.");
            if (done) {done();}
            return;
          }
          break;
        case 'string':
          if (color_scene.includes(value)){
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
      
      if (JSON.stringify(value) === curentValue){
        this.debug("Value not changed. Cancel update");
        if (done) {done();}
        return;
      };
      let upState= {
        type:ctype,
        state:state
      };
      device.updateCapabState(this.id,upState)
      .then(ref=>{
        curentValue = JSON.stringify(value);
        this.status({fill:"green",shape:"dot",text:JSON.stringify(curentValue)});
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
        device.delCapability(this.id)
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