import { useState } from 'react'
import { Sun, Wind, Droplets, Zap, PowerOff } from 'lucide-react'
import { useDeviceState } from '../hooks/useDeviceState'
import { toggleActuator, allOff, ACTUATOR_CONFIG } from '../services/deviceControl'

const ICONS = { light: Sun, fan: Wind, pump: Droplets, aux: Zap }

export default function ControlPanel({ lastReading, compact }) {
  const { state, loading } = useDeviceState()
  const [pending, setPending] = useState({})

  async function handleToggle(key) {
    setPending(p => ({ ...p, [key]: true }))
    try { await toggleActuator(key, !state[key]) }
    finally { setPending(p => ({ ...p, [key]: false })) }
  }

  async function handleAllOff() {
    setPending({ light: true, fan: true, pump: true, aux: true })
    try { await allOff() }
    finally { setPending({}) }
  }

  const anyOn = Object.values(state).some(v => v === true)
  const entries = compact
    ? Object.entries(ACTUATOR_CONFIG).slice(0, 3)
    : Object.entries(ACTUATOR_CONFIG)

  return (
    <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-slate-800">Controles Manuales</h3>
        {anyOn && !compact && (
          <button
            onClick={handleAllOff}
            className="flex items-center gap-1.5 text-xs font-semibold text-rose-500 hover:text-rose-600 transition-colors"
          >
            <PowerOff size={13} /> Apagar todo
          </button>
        )}
      </div>

      <div className="space-y-3">
        {entries.map(([key, cfg]) => {
          const Icon   = ICONS[key] ?? Zap
          const active = !!state[key]
          const isPending = !!pending[key]

          return (
            <div
              key={key}
              onClick={() => !loading && !isPending && handleToggle(key)}
              className="flex items-center justify-between p-3 border border-slate-100 rounded-2xl hover:bg-slate-50 transition cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${active ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                  <Icon size={18} />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">{cfg.label}</p>
                  <p className="text-xs text-slate-400">{isPending ? 'Enviando…' : active ? 'Encendido' : 'Apagado'}</p>
                </div>
              </div>

              {/* Toggle */}
              <div className={`w-11 h-6 rounded-full flex items-center p-0.5 transition-colors ${active ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${active ? 'translate-x-5' : 'translate-x-0'}`} />
              </div>
            </div>
          )
        })}
      </div>

      {compact && (
        <p className="text-xs text-slate-400 mt-3 text-center">
          Cambios via Firestore · ~3s latencia
        </p>
      )}
    </div>
  )
}
