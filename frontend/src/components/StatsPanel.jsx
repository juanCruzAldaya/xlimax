import { useMemo } from 'react'
import { readings, SENSOR_CONFIG, calcStats, weatherProfiles } from '../data/mockData'

const DAY_LABELS = ['Dom 18/05', 'Lun 19/05', 'Mar 20/05']

export default function StatsPanel({ data, sensorKey, showDays }) {
  const cfg   = SENSOR_CONFIG[sensorKey]
  const stats = useMemo(() => calcStats(data, sensorKey), [data, sensorKey])

  const dayStats = useMemo(() => {
    if (!showDays) return null
    return [0, 1, 2].map(d => ({
      label:   DAY_LABELS[d],
      weather: weatherProfiles[d].name,
      stats:   calcStats(readings.slice(d * 288, (d + 1) * 288), sensorKey),
    }))
  }, [sensorKey, showDays])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Mínimo',   value: stats.min, colored: true },
          { label: 'Máximo',   value: stats.max, colored: true },
          { label: 'Promedio', value: stats.avg },
          { label: 'Std Dev',  value: stats.std },
        ].map(s => (
          <div key={s.label} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-2">{s.label}</p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold" style={s.colored ? { color: cfg.colorHex } : { color: '#1e293b' }}>
                {s.value}
              </span>
              <span className="text-slate-400 text-sm">{cfg.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {showDays && dayStats && (
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4">Comparativo por día</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {dayStats.map(d => (
              <div key={d.label} className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <p className="text-sm font-semibold text-slate-700">{d.label}</p>
                <p className="text-xs text-slate-400 italic mb-2">{d.weather}</p>
                <div className="flex justify-between items-baseline">
                  <span className="font-mono text-sm font-semibold" style={{ color: cfg.colorHex }}>
                    {d.stats.min} – {d.stats.max}{cfg.unit}
                  </span>
                  <span className="text-xs text-slate-400">ø {d.stats.avg}{cfg.unit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
