import { initializeApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
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

import { getAI, GoogleAIBackend } from "firebase/ai";

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
// Gemini Developer API via Firebase AI Logic (Spark plan compatible once AI Logic is enabled).
export const ai = getAI(app, { backend: new GoogleAIBackend() });

// Enable offline persistence
if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Multiple tabs open, offline persistence can only be enabled in one tab at a time.');
    } else if (err.code === 'unimplemented') {
      console.warn('The current browser does not support all of the features required to enable persistence.');
    }
  });
}
