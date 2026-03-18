import axios from 'axios'
import { getFirebaseAuth } from './firebase'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' }
})

api.interceptors.request.use(async (config) => {
  const auth = getFirebaseAuth()
  const user = auth?.currentUser
  if (user) {
    const token = await user.getIdToken()
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export default api
