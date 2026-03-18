import admin from 'firebase-admin'

let initialized = false

export function initFirebase() {
  if (initialized) return admin
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (json && json.trim()) {
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(json)) })
    initialized = true
    return admin
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp()
    initialized = true
    return admin
  }
  return null
}

export function getAuth() {
  const a = initFirebase()
  if (!a) {
    const e = new Error('Firebase Admin not configured (FIREBASE_SERVICE_ACCOUNT_JSON)')
    e.status = 503
    throw e
  }
  return admin.auth()
}
