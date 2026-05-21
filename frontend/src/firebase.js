import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAnalytics, isSupported } from 'firebase/analytics'

const firebaseConfig = {
  apiKey:            'AIzaSyD6KRCSFTlHxwuXrQwpJ_Vah5jIIFBlSIw',
  authDomain:        'xlimax-c8bb4.firebaseapp.com',
  projectId:         'xlimax-c8bb4',
  storageBucket:     'xlimax-c8bb4.firebasestorage.app',
  messagingSenderId: '546870385888',
  appId:             '1:546870385888:web:8ffc841777673ed6a1c485',
  measurementId:     'G-V8NDNS2S2F',
}

export const app = initializeApp(firebaseConfig)
export const db  = getFirestore(app)

/* Analytics solo funciona en browsers reales, no en SSR/preview */
isSupported().then(ok => { if (ok) getAnalytics(app) })
