module.exports = function(RED) {
  //Sevice node, Alice-Service (credential)
  function AliceService(config) {
    RED.nodes.createNode(this,config);
    var firebase = require('firebase/app');
    require('firebase/auth');
    require('firebase/firestore');
    var fb;
    const email = this.credentials.email;
    const password = this.credentials.password;
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

    this.isOnline = false;
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
  
    this.signIn = ()=>{
      fb.auth().signInWithEmailAndPassword(email, password)
      .then(u=>{
        this.emit('online');
      })
      .catch(err=>{
        this.error(err.message);
        this.emit('offline');
      });
    }

    this.signIn();
    
    this.getRef = function(deviceid){
      var user = fb.auth().currentUser;
      return fb.firestore().collection('users').doc(user.uid).collection('devices').doc(deviceid)
    };

    this.getTime = ()=>{
      return firebase.firestore.Timestamp.now();
    }

    this.on('offline', ()=>{
      this.isOnline = false;
    })

    this.on('online', ()=>{
      this.isOnline = true;
    })

    this.on('close',(done)=>{
      setTimeout(()=>{
        this.emit('offline');
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
    this.service.setMaxListeners(this.service.getMaxListeners() + 1); // увеличиваем лимит для event
    this.name = config.name;
    this.description = config.description,
    this.room = config.room;
    this.dtype = config.dtype;
    this.initState = false;
    this.ref = null;
    this.capabilites = {};

    this._updateCapabList = _=>{
      this.capabilites = {};
      return this.ref.collection('capabilities').get()
      .then(snapshot=>{
        snapshot.forEach(doc=>{
          let d = doc.data();
          let capab = d.type + "." + d.parameters.instance
          this.capabilites[capab] = doc.id;
        })
        return this.ref;
      })
    };

    this.init = ()=>{
      this.ref = this.service.getRef(this.id);
      this.ref.set({
        name: config.name,
        description: config.description,
        room: config.room,
        type: config.dtype
      })
      .then(ref=>{
        return this._updateCapabList() // обновляем уже заведенные в базе умения 
      })
      .then(ref=>{
        this.initState = true;
        this.status({fill:"green",shape:"dot",text:"online"});
        this.emit("online");
      });
    }

    this.startObserver = ()=>{
      if (this.observer) this.observer();
      this.observer = null;
      this.observer = this.ref.collection('capabilities')
      .where('state.updated', '>', new Date())
      .onSnapshot(querySnapshot=>{
        querySnapshot.docChanges().forEach(change => {
          let doc = change.doc.data();
          if ((change.type === 'added' || change.type === 'modified') && doc.state.updatedfrom != "node-red") {
            this.emit(change.doc.id,doc.state.value, doc.state)
          }
        });
      }, (err)=>{
        this.error(err.message);
      })
    };

    this.getRef=(capId)=>{
      return this.ref.collection('capabilities').doc(capId);
    };

    this.getTime=()=>{
      return this.service.getTime();
    };
    
    this.isDubCap=(capId,type,instance)=>{
      let capab = type+"."+instance;
      if (this.capabilites[capab] && this.capabilites[capab]!=capId){
        return true;
      }else{
        this.capabilites[capab] = capId;
        return false
      }
    };

// Установка параметров умения 
    this.setCapability = (capId, capab)=>{
      return new Promise((resolve,reject)=>{
        let capabIndex = capab.type+"."+capab.parameters.instance;
        if (this.capabilites[capabIndex] && this.capabilites[capabIndex]!=capId){
          reject(new Error("Dublicated capability on same device!"))
        }else{
          this.capabilites[capab] = capId; // добавляем новое уменя в локальный список 
          resolve(this.ref.collection('capabilities').doc(capId).set(capab))
        }
      })
    };

// обновление текущего state умения
    this.updateState=(capId,state)=>{
      return this.ref.collection('capabilities').doc(capId).update({
        state: state
      });
    };

// удаление умения 
    this.delCapability=(capId)=>{
      return this.ref.collection('capabilities').doc(capId).delete()
        .then(res=>{
          this._updateCapabList()
          return res;
        })
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
      this.observer = null;
      this.status({fill:"red",shape:"dot",text:"offline"});
    })

    this.on('close', (removed, done)=>{
      if (this.observer)this.observer();
      setTimeout(()=>{
        this.emit('offline');
        if (removed){this.ref.delete()};
        done();
      },400)
    });
  };
  RED.nodes.registerType("alice-device",AliceDevice);
};

