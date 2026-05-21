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
    <div className="stats-panel">
      <div className="stats-panel__title">Estadísticas del período</div>

      <div className="stats-grid">
        <StatBlock label="Mínimo"  value={stats.min}  unit={cfg.unit} color={cfg.colorHex} />
        <StatBlock label="Máximo"  value={stats.max}  unit={cfg.unit} color={cfg.colorHex} />
        <StatBlock label="Promedio" value={stats.avg} unit={cfg.unit} />
        <StatBlock label="Std Dev" value={stats.std}  unit={cfg.unit} />
      </div>

      {showDays && dayStats && (
        <>
          <div className="stats-panel__title" style={{ marginTop: 'var(--s5)' }}>
            Comparativo por día
          </div>
          <div className="stats-days">
            {dayStats.map(d => (
              <div key={d.label} className="stat-day">
                <div className="stat-day__name">{d.label}</div>
                <div className="stat-day__weather">{d.weather}</div>
                <div className="stat-day__row">
                  <span className="stat-day__range" style={{ color: cfg.colorHex }}>
                    {d.stats.min} – {d.stats.max}{cfg.unit}
                  </span>
                  <span className="stat-day__avg">ø {d.stats.avg}{cfg.unit}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function StatBlock({ label, value, unit, color }) {
  return (
    <div className="stat-block">
      <div className="stat-block__label">{label}</div>
      <div>
        <span className="stat-block__value" style={color ? { color } : undefined}>
          {value}
        </span>
        <span className="stat-block__unit">{unit}</span>
      </div>
    </div>
  )
}
