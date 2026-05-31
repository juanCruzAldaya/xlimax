import { AlertTriangle, Leaf, CheckCircle, Clock } from 'lucide-react'

const RULES = [
  {
    id: 1, name: 'Calefactor',
    condition: 'temp < 8°C por 30 min → activar calefactor',
    getStatus: r => r?.t < 8 ? 'trigger' : 'ok',
    getCurrent: r => `Temp: ${r?.t ?? '—'} °C`,
    lastTriggered: '18/05 06:14',
  },
  {
    id: 2, name: 'Extractor',
    condition: 'hum > 85% → activar extractor',
    getStatus: r => r?.h > 85 ? 'trigger' : 'ok',
    getCurrent: r => `Hum: ${r?.h ?? '—'} %`,
    lastTriggered: '19/05 09:20',
  },
  {
    id: 3, name: 'LED Grow',
    condition: 'luz < 20% entre 08:00–18:00 → activar panel',
    getStatus: r => r?.l < 20 ? 'trigger' : 'ok',
    getCurrent: r => `Luz: ${r?.l ?? '—'} %`,
    lastTriggered: '19/05 08:00',
  },
  {
    id: 4, name: 'Alerta humedad',
    condition: 'hum > 90% por 60 min → notificar',
    getStatus: r => r?.h > 90 ? 'trigger' : 'ok',
    getCurrent: r => `Hum: ${r?.h ?? '—'} %`,
    lastTriggered: '19/05 11:30',
  },
]

const LOG = [
  { type: 'ok',      msg: 'Sistema iniciado — ESP32 conectado',          time: '20/05 18:12' },
  { type: 'info',    msg: 'LED grow apagado — luminosidad recuperada',    time: '19/05 16:45' },
  { type: 'warning', msg: 'Alerta: humedad 91.2% notificada',            time: '19/05 11:30' },
  { type: 'info',    msg: 'LED grow encendido — luz 12% < 20%',          time: '19/05 08:00' },
  { type: 'warning', msg: 'Calefactor encendido — temp 6.9°C < 8°C',     time: '18/05 06:14' },
]

export default function AutomationPanel({ lastReading, compact }) {
  const alerts = RULES.filter(r => r.getStatus(lastReading) === 'trigger')

  if (compact) {
    return (
      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-slate-800">Alertas Recientes</h3>
          {alerts.length > 0 && (
            <span className="text-xs font-bold bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full">
              {alerts.length} activa{alerts.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="space-y-3">
          {LOG.slice(0, 3).map((entry, i) => (
            <AlertItem key={i} {...entry} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Rules */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <h3 className="font-bold text-slate-800 mb-4">Reglas de automatización</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {RULES.map(rule => {
            const status  = rule.getStatus(lastReading)
            const current = rule.getCurrent(lastReading)
            return (
              <div key={rule.id} className={`p-4 rounded-2xl border ${
                status === 'trigger'
                  ? 'bg-amber-50 border-amber-100'
                  : 'bg-slate-50 border-slate-100'
              }`}>
                <div className="flex justify-between items-start mb-2">
                  <p className="font-semibold text-slate-800 text-sm">{rule.name}</p>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    status === 'trigger'
                      ? 'bg-amber-200 text-amber-800'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {status === 'trigger' ? 'ACTIVA' : 'OK'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mb-2">{rule.condition}</p>
                <div className="flex justify-between text-xs text-slate-400">
                  <span className="font-mono">{current}</span>
                  <span>último: {rule.lastTriggered}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Log */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <h3 className="font-bold text-slate-800 mb-4">Log de actividad</h3>
        <div className="space-y-3">
          {LOG.map((entry, i) => (
            <AlertItem key={i} {...entry} />
          ))}
        </div>
      </div>
    </div>
  )
}

function AlertItem({ type, msg, time }) {
  const styles = {
    warning: { bg: 'bg-amber-50 border-amber-100', text: 'text-amber-800', icon: <AlertTriangle size={15} className="text-amber-500 mt-0.5" /> },
    ok:      { bg: 'bg-emerald-50 border-emerald-100', text: 'text-emerald-800', icon: <CheckCircle size={15} className="text-emerald-500 mt-0.5" /> },
    info:    { bg: 'bg-blue-50 border-blue-100', text: 'text-blue-800', icon: <Leaf size={15} className="text-blue-500 mt-0.5" /> },
  }
  const s = styles[type] ?? styles.info

  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl border ${s.bg}`}>
      {s.icon}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${s.text}`}>{msg}</p>
        <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
          <Clock size={10} /> {time}
        </p>
      </div>
    </div>
  )
}
