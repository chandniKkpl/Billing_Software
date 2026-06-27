import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBUdvGPOoC8EMgh2hV2LKBE1AMazz_mlno",
  authDomain: "wt-billing-software.firebaseapp.com",
  projectId: "wt-billing-software",
  storageBucket: "wt-billing-software.firebasestorage.app",
  messagingSenderId: "689681091040",
  appId: "1:689681091040:web:df207b1923f6d967a24385",
  measurementId: "G-N6QT2E9FXF"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
