import { useState, useEffect } from 'react'
import { Sun, Wind, Thermometer, PowerOff, Loader } from 'lucide-react'

const BACKEND = import.meta.env.VITE_BACKEND_URL ?? 'https://xlimax.onrender.com'

const CHANNEL_META = {
  switch_1: { label: 'Extractor',  Icon: Wind        },
  switch_2: { label: 'Luces',      Icon: Sun         },
  switch_3: { label: 'Ventilador', Icon: Thermometer },
}

export default function ControlPanel({ compact }) {
  const [state,   setState]   = useState({})   // { switch_1: bool, ... }
  const [pending, setPending] = useState({})
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  async function fetchStatus() {
    try {
      const r = await fetch(`${BACKEND}/tuya/status`)
      if (!r.ok) throw new Error(await r.text())
      const { state: s } = await r.json()
      setState(s)
      setError(null)
    } catch (e) {
      setError('Sin conexión con el switch')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
    const iv = setInterval(fetchStatus, 15000)   // refresca cada 15s
    return () => clearInterval(iv)
  }, [])

  async function toggle(channel) {
    const next = !state[channel]
    setPending(p => ({ ...p, [channel]: true }))
    setState(s  => ({ ...s,  [channel]: next }))   // optimistic update
    try {
      const r = await fetch(`${BACKEND}/tuya/control`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ channel, value: next }),
      })
      if (!r.ok) throw new Error(await r.text())
    } catch {
      setState(s => ({ ...s, [channel]: !next }))   // revert on error
    } finally {
      setPending(p => ({ ...p, [channel]: false }))
    }
  }

  async function allOff() {
    for (const ch of Object.keys(CHANNEL_META)) {
      if (state[ch]) await toggle(ch)
    }
  }

  const anyOn = Object.values(state).some(v => v === true)
  const entries = compact
    ? Object.entries(CHANNEL_META).slice(0, 3)
    : Object.entries(CHANNEL_META)

  return (
    <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-slate-800">Controles</h3>
        {anyOn && !compact && (
          <button
            onClick={allOff}
            className="flex items-center gap-1.5 text-xs font-semibold text-rose-500 hover:text-rose-600 transition-colors"
          >
            <PowerOff size={13} /> Apagar todo
          </button>
        )}
      </div>

      {error && (
        <p className="text-xs text-rose-500 mb-3 text-center">{error}</p>
      )}

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader size={20} className="text-slate-400 animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map(([channel, { label, Icon }]) => {
            const active     = !!state[channel]
            const isPending  = !!pending[channel]
            return (
              <div
                key={channel}
                onClick={() => !isPending && toggle(channel)}
                className="flex items-center justify-between p-3 border border-slate-100 rounded-2xl hover:bg-slate-50 transition cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${active ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                    <Icon size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">{label}</p>
                    <p className="text-xs text-slate-400">
                      {isPending ? 'Enviando…' : active ? 'Encendido' : 'Apagado'}
                    </p>
                  </div>
                </div>

                <div className={`w-11 h-6 rounded-full flex items-center p-0.5 transition-colors ${active ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                  <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${active ? 'translate-x-5' : 'translate-x-0'}`} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {compact && !loading && (
        <p className="text-xs text-slate-400 mt-3 text-center">
          Tuya Smart Switch · 3 canales
        </p>
      )}
    </div>
  )
}
