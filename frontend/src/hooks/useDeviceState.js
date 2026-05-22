import { useState, useEffect } from 'react'
import { subscribeToDeviceState, DEFAULT_STATE } from '../services/deviceControl'

export function useDeviceState() {
  const [state,   setState]   = useState(DEFAULT_STATE)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = subscribeToDeviceState(s => {
      setState(s)
      setLoading(false)
    })
    return unsub
  }, [])

  return { state, loading }
}
