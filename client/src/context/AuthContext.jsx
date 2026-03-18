import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback
} from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth'
import { getFirebaseAuth, isFirebaseConfigured } from '@/lib/firebase'
import api from '@/lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const refreshProfile = useCallback(async (firebaseUser) => {
    if (!firebaseUser) {
      setProfile(null)
      return
    }
    try {
      const { data } = await api.post('/auth/bootstrap')
      setProfile(data.user)
    } catch {
      setProfile(null)
    }
  }, [])

  useEffect(() => {
    const auth = getFirebaseAuth()
    if (!auth) {
      setUser(null)
      setProfile(null)
      setLoading(false)
      return
    }
    return onAuthStateChanged(auth, async (u) => {
      setUser(u)
      setLoading(true)
      if (u) await refreshProfile(u)
      else setProfile(null)
      setLoading(false)
    })
  }, [refreshProfile])

  const login = async (email, password) => {
    const auth = getFirebaseAuth()
    if (!auth) throw new Error('Firebase is not configured. Add VITE_FIREBASE_* to .env.local')
    await signInWithEmailAndPassword(auth, email, password)
  }

  const loginGoogle = async () => {
    const auth = getFirebaseAuth()
    if (!auth) throw new Error('Firebase is not configured')
    const p = new GoogleAuthProvider()
    await signInWithPopup(auth, p)
  }

  const logout = async () => {
    const auth = getFirebaseAuth()
    if (auth) await signOut(auth)
    setProfile(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        login,
        loginGoogle,
        logout,
        refreshProfile,
        firebaseReady: isFirebaseConfigured()
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth outside AuthProvider')
  return ctx
}
