import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDfEUGX3n7Bi71M1erbsQOMmc22fdXoYgs",
  authDomain: "control-fin-741b3.firebaseapp.com",
  projectId: "control-fin-741b3",
  storageBucket: "control-fin-741b3.firebasestorage.app",
  messagingSenderId: "849921402043",
  appId: "1:849921402043:web:ac5aa44e0c508e14a8f59e",
  measurementId: "G-8EYY8SHGFS"
};

if (!firebaseConfig.apiKey) {
    console.error(
        "Firebase API key not found. Please set the FIREBASE_API_KEY environment variable."
    );
}

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
