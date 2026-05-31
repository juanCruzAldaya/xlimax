import { useState, useEffect } from 'react'
import { readings as mockReadings } from '../data/mockData'
import { subscribeToReadings } from '../services/firestore'

/**
 * Devuelve datos de lecturas y si está conectado a Firestore en vivo.
 *
 * - Si Firestore tiene ≥ 10 documentos, los usa y `live = true`.
 * - Si Firestore está vacío o falla, cae al mock data y `live = false`.
 *
 * El array siempre tiene la misma forma: [{ epoch, t, h, l }, ...]
 */
export function useReadings() {
  const [data, setData] = useState(mockReadings)
  const [live, setLive] = useState(false)

  useEffect(() => {
    let active = true

    const unsub = subscribeToReadings(incoming => {
      if (!active) return
      if (incoming.length >= 1 && incoming.some(r => r.t !== null)) {
        setData(incoming)
        setLive(true)
      }
    }, 864)

    return () => {
      active = false
      unsub()
    }
  }, [])

  return { data, live }
}
