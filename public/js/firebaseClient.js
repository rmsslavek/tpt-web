import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  where,
  writeBatch,
  connectFirestoreEmulator,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD2i5bZ3OPxAcxQN9NlqP0Ycy2JzBgHHuY",
  authDomain: "tpt-web-4825b.firebaseapp.com",
  projectId: "tpt-web-4825b",
  storageBucket: "tpt-web-4825b.firebasestorage.app",
  messagingSenderId: "644290484820",
  appId: "1:644290484820:web:66f56e341d3c28060c6bc1",
  measurementId: "G-ZM7MG4NHED",
};

export const app = initializeApp(firebaseConfig);
export const firestore = getFirestore(app);

// Lokalni rad sa Firestore emulatorom ako je pokrenuto na localhost/127.0.0.1
if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
  try {
    connectFirestoreEmulator(firestore, "127.0.0.1", 8080);
    console.info("[firebase] povezano na Firestore emulator (127.0.0.1:8080)");
  } catch (e) {
    console.warn("[firebase] nije uspelo povezivanje na emulator", e);
  }
}

export {
  collection,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  where,
  writeBatch,
};
