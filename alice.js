const firebase = require('firebase');
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
  //Config node, Alice-Service
  function AliceService(config) {
    RED.nodes.createNode(this,config);
    var fb = firebase.initializeApp(firebaseConfig);
    const email = this.credentials.username;
    const password = this.credentials.password;
    fb.auth().createUserWithEmailAndPassword(email, password)
      .catch(err=>{
        this.error(err.message);
      });
    this.getDb = function(){
      return fb.firestore();
    }
  };

  RED.nodes.registerType("alice-service",AliceService,{
    credentials: {
        email: {type:"text"},
        password: {type:"password"}
    }
  });
};