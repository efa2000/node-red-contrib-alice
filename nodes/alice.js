module.exports = function(RED) {
  //Sevice node, Alice-Service (credential)
  function AliceService(config) {
    RED.nodes.createNode(this,config);
    var firebase = require('firebase/app');
    require('firebase/auth');
    require('firebase/firestore');
    var mqtt = require('mqtt');
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
    this._mqttClient;
    this._mqttPath;
    this._mqttQueue=[];
    this._mqttSending=false;

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
        // this._startClient(u.user.uid);
      })
      .catch(err=>{
        this.error(err.message);
        this.emit('offline');
      });
    }

    this.signIn();

    this._startClient= (uid)=>{
      fb.firestore().collection('users').doc(uid).get()
          .then(doc=>{
            let data = doc.data();
            if (!data.yiot){return};
            this._mqttPath = '$devices/' + data.yiot.id;
            this._mqttClient = mqtt.connect(data.yiot.url,{
              port: 8883,
              clientId: uid,
              rejectUnauthorized: false,
              username: data.yiot.id,
              password: data.yiot.p,
              reconnectPeriod: 30000
            });
            this._mqttClient.on("connect",()=>{
              console.log("Connect");
            })
            this._mqttClient.on("offline",()=>{
              console.log("offline");
            })
            this._mqttClient.on("disconnect",()=>{
              console.log("disconnect");
            })
            this._mqttClient.on("error",(err)=>{
              console.log("error",err.message);
            })
          })
          .catch(err=>{
            this.error("Error on start mqtt client: " + err.message)
          })
    }
    this.getRef = (deviceid)=>{
      var user = fb.auth().currentUser;
      return fb.firestore().collection('users').doc(user.uid).collection('devices').doc(deviceid)
    };

    this.getTime = ()=>{
      return firebase.firestore.Timestamp.now();
    }

    this.send = (path,data)=>{
      this._mqttQueue.push({
        path: this._mqttPath+path,
        data: JSON.stringify(data)
      });
      if (!this._mqttSending){
        this._mqttSend()
      };
    };

    this._mqttSend=()=>{
      this._mqttSending = true;
      let packet = this._mqttQueue[0];
      if (packet && this._mqttClient){
        console.log("send",packet.path,packet.data);
        this._mqttClient.publish(packet.path,packet.data);
      };
      this._mqttQueue.shift();
      if (this._mqttQueue.length>0){
        setTimeout(_=>{
          this._mqttSend()
        },1000);
      }else{
        this._mqttSending = false;
      }
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
    var pjson = require('../package.json');
    RED.nodes.createNode(this,config);
    this.service = RED.nodes.getNode(config.service);
    this.service.setMaxListeners(this.service.getMaxListeners() + 1); // увеличиваем лимит для event
    this.name = config.name;
    this.description = config.description,
    this.room = config.room;
    this.dtype = config.dtype;
    this.initState = false;
    this.ref;
    this.capabilites = {};
    this.sensors = {};

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

    this._updateSensorList = _=>{
      this.sensors = {};
      return this.ref.collection('properties').get()
      .then(snapshot=>{
        snapshot.forEach(doc=>{
          let d = doc.data();
          let sensor = d.type + "." + d.parameters.instance
          this.sensors[sensor] = doc.id;
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
        type: config.dtype,
        device_info:{
          manufacturer: "NodeRed Home",
          model: "virtual device",
          sw_version: pjson.version
        }
      })
      .then(ref=>{
        return this._updateCapabList() // обновляем уже заведенные в базе умения 
      })
      .then(ref=>{
        return this._updateSensorList() // обновляем уже заведенные в базе сенсоры 
      })
      .then(ref=>{
        this.status({fill:"green",shape:"dot",text:"online"});
        this.emit("online");
        this.initState = true;
      })
      .catch(err=>{
        this.error(err.message);
      });
    }
    // проверяем а сервис уже онлайн 
    if (this.service.isOnline)this.init();

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
          this.capabilites[capabIndex] = capId; // добавляем новое уменя в локальный список
          this.setMaxListeners(this.getMaxListeners() + 1); // увеличиваем количество слушателей  
          resolve(this.ref.collection('capabilities').doc(capId).set(capab));
        }
      })
    };
// Установка параметров сенсора 
    this.setSensor = (sensId, sensor)=>{
      return new Promise((resolve,reject)=>{
        let sensorIndex = sensor.type+"."+sensor.parameters.instance;
        if (this.sensors[sensorIndex] && this.sensors[sensorIndex]!=sensId){
          reject(new Error("Dublicated sensor on same device!"))
        }else{
          this.sensors[sensorIndex] = sensId; // добавляем новый сенсор в локальный список 
          this.setMaxListeners(this.getMaxListeners() + 1); // увеличиваем количество слушателей 
          resolve(this.ref.collection('properties').doc(sensId).set(sensor));
        }
      })
    };

// обновление текущего state умения
    this.updateCapabState=(capId,state)=>{
      return this.ref.collection('capabilities').doc(capId).update({
        state: state
      });
    };
// обновление текущего state сенсора
    this.updateSensorState=(sensID,state)=>{
      this.service.send('/events/'+this.id,state);
      return this.ref.collection('properties').doc(sensID).update({
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

// удаление сенсора
    this.delSensor=(sensID)=>{
      return this.ref.collection('properties').doc(sensID).delete()
        .then(res=>{
          this._updateSensorList()
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
      // this.ref = null;
      if (this.observer)this.observer();
      this.observer = null;
      this.status({fill:"red",shape:"dot",text:"offline"});
    })

    this.on('close', (removed, done)=>{
      if (this.observer)this.observer();
      setTimeout(()=>{
        this.emit('offline');
        if (removed && this.ref){this.ref.delete()};
        done();
      },400)
    });
  };
  RED.nodes.registerType("alice-device",AliceDevice);
};

