import { useMemo } from 'react'
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts'
import { SENSOR_CONFIG, calcStats } from '../data/mockData'

export default function SensorCard({ sensorKey, data, rangePoints, active, onClick }) {
  const cfg = SENSOR_CONFIG[sensorKey]

  const sparkData = useMemo(() => data.slice(-12), [data])
  const rangeData  = useMemo(() => data.slice(-rangePoints), [data, rangePoints])
  const stats      = useMemo(() => calcStats(rangeData, sensorKey), [rangeData, sensorKey])

  const current = data[data.length - 1]?.[sensorKey] ?? '—'
  const prev    = data[data.length - 3]?.[sensorKey]
  const delta   = prev != null ? +(current - prev).toFixed(1) : null
  const trendClass = delta == null ? 'trend--flat' : delta > 0.2 ? 'trend--up' : delta < -0.2 ? 'trend--down' : 'trend--flat'
  const trendArrow = delta == null ? '—' : delta > 0.2 ? '↑' : delta < -0.2 ? '↓' : '→'

  const domainPad = (stats.max - stats.min) * 0.2 || 1
  const yDomain  = [stats.min - domainPad, stats.max + domainPad]

  return (
    <div
      className={`sensor-card${active ? ' sensor-card--active' : ''}`}
      style={{ '--card-color': cfg.colorHex }}
      onClick={onClick}
    >
      <div className="sensor-card__header">
        <span className="sensor-card__label">{cfg.label}</span>
        <span className={`sensor-card__trend ${trendClass}`}>
          {trendArrow}
          {delta != null && <span>{Math.abs(delta)}{cfg.unit}</span>}
        </span>
      </div>

      <div className="sensor-card__value-row">
        <span className="sensor-card__value">{current}</span>
        <span className="sensor-card__unit">{cfg.unit}</span>
      </div>

      <div className="sensor-card__sparkline">
        <ResponsiveContainer width="100%" height={44}>
          <AreaChart data={sparkData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`spark-${sensorKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={cfg.colorHex} stopOpacity={0.25} />
                <stop offset="95%" stopColor={cfg.colorHex} stopOpacity={0}    />
              </linearGradient>
            </defs>
            <YAxis domain={yDomain} hide />
            <Area
              type="monotone"
              dataKey={sensorKey}
              stroke={cfg.colorHex}
              strokeWidth={1.5}
              fill={`url(#spark-${sensorKey})`}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="sensor-card__footer">
        <div className="sensor-card__stat">
          <span className="sensor-card__stat-label">mín</span>
          <span className="sensor-card__stat-val">{stats.min}{cfg.unit}</span>
        </div>
        <div className="sensor-card__stat">
          <span className="sensor-card__stat-label">máx</span>
          <span className="sensor-card__stat-val">{stats.max}{cfg.unit}</span>
        </div>
        <div className="sensor-card__stat">
          <span className="sensor-card__stat-label">prom</span>
          <span className="sensor-card__stat-val">{stats.avg}{cfg.unit}</span>
        </div>
      </div>
    </div>
  )
}
