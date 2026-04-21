import { initializeApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  measurementId: (import.meta.env.VITE_FIREBASE_MEASUREMENT_ID as string | undefined) || '',
};

const firestoreDatabaseId = (import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID as string | undefined) || '(default)';

export const firebaseInitError =
  !firebaseConfig.projectId ||
  !firebaseConfig.appId ||
  !firebaseConfig.apiKey ||
  !firebaseConfig.authDomain ||
  !firebaseConfig.storageBucket ||
  !firebaseConfig.messagingSenderId
    ? 'Missing Firebase client environment variables.'
    : null;

let auth: Auth | null = null;
let db: Firestore | null = null;

if (!firebaseInitError) {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app, firestoreDatabaseId);
  auth = getAuth(app);
}

export { auth, db };
