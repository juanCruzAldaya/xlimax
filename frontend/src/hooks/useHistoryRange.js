import { useState, useEffect } from 'react'
import { fetchHistory } from '../services/history'

/**
 * Trae datos históricos downsampled (bucket horario) del backend para los
 * rangos que el stream en vivo no cubre (el onSnapshot solo tiene ~pocas horas).
 * Fetch on-demand: solo dispara cuando `enabled` es true y cambia el rango.
 *
 * @returns {{ points: [{epoch,count,nodes}], loading: boolean, error: string|null }}
 */
export function useHistoryRange(rangeHours, enabled) {
  const [state, setState] = useState({ points: [], loading: false, error: null })

  useEffect(() => {
    if (!enabled) {
      setState({ points: [], loading: false, error: null })
      return
    }
    let active = true
    setState(s => ({ points: s.points, loading: true, error: null }))

    const to   = Date.now()
    const from = to - rangeHours * 60 * 60 * 1000

    fetchHistory(from, to, 'hour')
      .then(res => { if (active) setState({ points: res.points, loading: false, error: null }) })
      .catch(e  => { if (active) setState({ points: [], loading: false, error: e.message || 'error' }) })

    return () => { active = false }
  }, [rangeHours, enabled])

  return state
}
