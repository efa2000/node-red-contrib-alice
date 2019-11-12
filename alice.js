var firebase = require('firebase');
const firebaseConfig = {
    apiKey: "AIzaSyDQUn6EhNOgSAV15do8DKwwx3KHDyvLGJc",
    authDomain: "node-red-alice-4462f.firebaseapp.com",
    databaseURL: "https://node-red-alice-4462f.firebaseio.com",
    projectId: "node-red-alice-4462f",
    storageBucket: "node-red-alice-4462f.appspot.com",
    messagingSenderId: "1049686868440",
    appId: "1:1049686868440:web:e5f5ef6a70ead338b6f2ad",
    measurementId: "G-MD0L6R9N79"
  };

module.exports = function(RED) {
  //Sevice node, Alice-Service (credential)
  function AliceService(config) {
    RED.nodes.createNode(this,config);
    var fb;
    try {
      fb = firebase.initializeApp(firebaseConfig,this.id); 
    } catch (error) {
      if (error.code == 'app/duplicate-app'){
        this.debug("Dublicated firebase app");
        fb = firebase.app(this.id);
      }else{
        this.error(error);
      }
    }
    const email = this.credentials.email;
    const password = this.credentials.password;
    fb.auth().signInWithEmailAndPassword(email, password)
      .then(u=>{
        this.emit("online");
      })
      .catch(err=>{
        this.error(err.message);
      });
    
    this.getRef = function(deviceid){
      var user = fb.auth().currentUser;
      return new Promise((resolve,reject)=>{
        if (user){
          resolve(fb.firestore().collection('users').doc(user.uid).collection('devices').doc(deviceid));
        }else{
          fb.auth().onAuthStateChanged(u=>{
            if (u){
              user = u;
              resolve(fb.firestore().collection('users').doc(user.uid).collection('devices').doc(deviceid));
            }
          })
        }
      })
    };

    this.on('close', function(done) {
      fb.delete().finally(r=>{
        done();
      });
    });
  };
  RED.nodes.registerType("alice-service",AliceService,{
    credentials: {
        email: {type:"text"},
        password: {type:"password"}
    }
  });
  

  function AliceDevice(config){
    RED.nodes.createNode(this,config);
    this.service = RED.nodes.getNode(config.service);
    this.name = config.name;
    this.description = config.description,
    this.room = config.room,
    this.service.getRef(this.id)
      .then(ref=>{
        this.deviceRef = ref;
        return this.deviceRef
      })
      .then(ref=>{
        ref.set({
          name: config.name,
          description: config.description,
          room: config.room
        })
      });

    this.service.on("online",()=>{
      this.emit("online");
    });

    // this.on('close', (removed, done)=>{
    //   if (removed){
    //     console.log("dell start");
    //     this.deviceRef.delete();
    //     done();
    //   }else{
    //     done();
    //   }
    // });
  };
  RED.nodes.registerType("alice-device",AliceDevice);

  function AliceOnOff(config){
    RED.nodes.createNode(this,config);
    this.status({fill:"red",shape:"dot",text:"offline"});
    this.device = RED.nodes.getNode(config.device);
    this.name = config.name;

    this.device.on("online",()=>{
      this.status({fill:"green",shape:"dot",text:"online"});
    })
  }  
  RED.nodes.registerType("On_Off",AliceOnOff);

};