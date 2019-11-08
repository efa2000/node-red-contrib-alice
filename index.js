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
const fb = firebase.initializeApp(firebaseConfig);