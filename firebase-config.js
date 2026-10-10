```js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBKuGjmLBUbPCEAQglZK7PcfXh1bnh7OF4",
  authDomain: "e-ride-70342.firebaseapp.com",
  projectId: "e-ride-70342",
  storageBucket: "e-ride-70342.firebasestorage.app",
  messagingSenderId: "946431084655",
  appId: "1:946431084655:web:eddcb4fffe883d4fdf659a",
  measurementId: "G-WZ5YPZ4YZD"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
```
