import { initializeApp, getApps } from 'firebase/app'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
}

let app
let auth

/**
 * Returns null if VITE_FIREBASE_API_KEY is not set — avoids crashing the whole app.
 */
export function getFirebaseApp() {
  if (!firebaseConfig.apiKey) return null
  if (!app) {
    if (getApps().length) {
      app = getApps()[0]
    } else {
      app = initializeApp(firebaseConfig)
    }
  }
  return app
}

export function getFirebaseAuth() {
  const a = getFirebaseApp()
  if (!a) return null
  if (!auth) auth = getAuth(a)
  return auth
}

export function isFirebaseConfigured() {
  return Boolean(firebaseConfig.apiKey)
}
