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
    
    this.authStateSubs =  fb.auth().onAuthStateChanged(u=>{
      if (u){
        this.emit("online");
      }else{
        this.emit("offline");
      }
    });

    fb.auth().signInWithEmailAndPassword(email, password)
      .catch(err=>{
        this.error(err.message);
      });
    
    this.getRef = function(deviceid){
      var user = fb.auth().currentUser;
      return fb.firestore().collection('users').doc(user.uid).collection('devices').doc(deviceid)
    };

    this.on('close',(done)=>{
      setTimeout(()=>{
        fb.auth().signOut();
        fb.delete().finally(r=>{done()});
      },500)
    });

  };
  RED.nodes.registerType("alice-service",AliceService,{
    credentials: {
        email: {type:"text"},
        password: {type:"password"}
    }
  });
  
// ***************************** Alice DEVICE ****************************
  function AliceDevice(config){
    RED.nodes.createNode(this,config);
    this.service = RED.nodes.getNode(config.service);
    this.name = config.name;
    this.description = config.description,
    this.room = config.room;
    this.dtype = config.dtype;
    this.initState = false;
    this.ref = null;
    this.capabilites = {};

    this.init = ()=>{
      this.ref = this.service.getRef(this.id);
      this.ref.set({
        name: config.name,
        description: config.description,
        room: config.room,
        type: config.dtype
      })
      .then(ref=>{
        return this.ref.collection('capabilities').get()
          .then(snapshot=>{
            snapshot.forEach(doc=>{
              let d = doc.data();
              let capab = d.type + "." + d.parametrs.instance
              this.capabilites[capab] = doc.id;
            })
            return this.ref;
          })
      })
      .then(ref=>{
        this.initState = true;
        this.status({fill:"green",shape:"dot",text:"online"});
        this.emit("online");
      });
    }

    this.startObserver = ()=>{
      this.observer = this.ref.collection('capabilities')
      .where('state.updated', '>', new Date())
      .onSnapshot(querySnapshot=>{
        querySnapshot.docChanges().forEach(change => {
          let doc = change.doc.data();
          if ((change.type === 'added' || change.type === 'modified') && doc.state.updatedfrom != "node-red") {
            this.emit(change.doc.id,doc.state.value)
          }
        });
        
      })
    };

    this.getRef=(capId)=>{
      return this.ref.collection('capabilities').doc(capId);
    }
    
    this.isDubCap=(capId,type,instance)=>{
      let capab = type+"."+instance;
      if (this.capabilites[capab] && this.capabilites[capab]!=capId){
        return true;
      }else{
        this.capabilites[capab] = capId;
        return false
      }
    };

    this.service.on("online",()=>{
      if (!this.initState){
        this.init()
      }else{
        this.ref = this.service.getRef(this.id);
        this.emit("online");
      }
      this.startObserver();
    });
    
    this.service.on("offline",()=>{
      this.emit("offline");
      this.ref = null;
      if (this.observer)this.observer();
      this.status({fill:"red",shape:"dot",text:"offline"});
    })

    this.on('close', (removed, done)=>{
      this.observer();
      if (removed){
        this.ref.delete();
        done();
      }else{
        done();
      }
    });
  };
  RED.nodes.registerType("alice-device",AliceDevice);


// *********************** Alice capabilites ***********************************

  function AliceOnOff(config){
    RED.nodes.createNode(this,config);
    this.device = RED.nodes.getNode(config.device);
    this.name = config.name;
    this.initState = false;
    this.ref = null;

    this.init = ()=>{
      this.ref = this.device.getRef(this.id);
      let capab = {
        type: "devices.capabilities.on_off",
        retrievable: true,
        parametrs: {
          instance: "on",
        },
        state: {
          value: false,
          updatedfrom:"node-red",
          updated: firebase.firestore.Timestamp.now()
        }
      };
      if (!this.device.isDubCap(this.id,capab.type, capab.parametrs.instance)){
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
      if (typeof msg.payload != 'boolean'){
        this.error("Wrong type! msg.payload must be boolean.");
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
          value: msg.payload,
          updatedfrom: "node-red",
          updated: firebase.firestore.Timestamp.now()
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
  RED.nodes.registerType("On_Off",AliceOnOff);

};