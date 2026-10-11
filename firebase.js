
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDdXnSzOKa9L4wF4phNBNDufX9P6gM2P_4",
  authDomain: "e-ride-80dd7.firebaseapp.com",
  projectId: "e-ride-80dd7",
  storageBucket: "e-ride-80dd7.firebasestorage.app",
  messagingSenderId: "772115042389",
  appId: "1:772115042389:web:82270e87f10c61bc3204dc",
  measurementId: "G-RLQVY5TR2C"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
