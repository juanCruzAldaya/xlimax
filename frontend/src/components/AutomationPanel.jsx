const RULES = [
  {
    id: 1,
    name: 'Calefactor',
    condition: 'temp < 8 °C\ndurante ≥ 30 min → activar calefactor',
    status: 'inactive',
    lastTriggered: '18/05 06:14',
    getStatus: r => r.t < 8 ? 'trigger' : 'inactive',
    getCurrent: r => `Temp actual: ${r.t} °C`,
  },
  {
    id: 2,
    name: 'Extractor',
    condition: 'hum > 85 %\n→ activar extractor de aire',
    status: 'inactive',
    lastTriggered: '19/05 09:20',
    getStatus: r => r.h > 85 ? 'trigger' : 'inactive',
    getCurrent: r => `Humedad actual: ${r.h} %`,
  },
  {
    id: 3,
    name: 'Iluminación LED grow',
    condition: 'lux < 2 000\nentre 08:00–18:00 → activar panel LED',
    status: 'inactive',
    lastTriggered: '19/05 08:00–16:45',
    getStatus: r => r.l < 2000 ? 'trigger' : 'inactive',
    getCurrent: r => `Lux actual: ${r.l.toLocaleString()} lx`,
  },
  {
    id: 4,
    name: 'Alerta humedad crítica',
    condition: 'hum > 90 %\ndurante ≥ 60 min → notificar',
    status: 'inactive',
    lastTriggered: '19/05 11:30',
    getStatus: r => r.h > 90 ? 'trigger' : 'inactive',
    getCurrent: r => `Humedad actual: ${r.h} %`,
  },
]

const LOG = [
  { time: '20/05 18:12', text: 'Sistema iniciado — ESP32-01 conectado', color: '#22c55e' },
  { time: '19/05 16:45', text: 'LED grow apagado — luminosidad recuperada (3 200 lx)', color: '#475569' },
  { time: '19/05 11:30', text: 'ALERTA: humedad 91.2 % notificada', color: '#f59e0b' },
  { time: '19/05 08:00', text: 'LED grow encendido — lux 980 < 2 000', color: '#818cf8' },
  { time: '18/05 06:14', text: 'Calefactor encendido — temp 6.9 °C < 8 °C', color: '#f59e0b' },
  { time: '18/05 09:02', text: 'Calefactor apagado — temp 9.1 °C', color: '#475569' },
]

const BADGE = {
  active:   { cls: 'rule-badge--active',   label: 'ACTIVA'   },
  inactive: { cls: 'rule-badge--inactive', label: 'INACTIVA' },
  trigger:  { cls: 'rule-badge--trigger',  label: 'ACTIVA'   },
}

export default function AutomationPanel({ lastReading }) {
  return (
    <div className="automation-panel">
      <div>
        <div className="section-label">Reglas de automatización</div>
        <div className="rules-grid">
          {RULES.map(rule => {
            const statusKey = lastReading ? rule.getStatus(lastReading) : 'inactive'
            const badge     = BADGE[statusKey]
            const current   = lastReading ? rule.getCurrent(lastReading) : '—'

            return (
              <div key={rule.id} className="rule-card">
                <div className="rule-card__header">
                  <span className="rule-card__name">{rule.name}</span>
                  <span className={`rule-badge ${badge.cls}`}>{badge.label}</span>
                </div>

                <pre className="rule-card__condition">{rule.condition}</pre>

                <div className="rule-card__footer">
                  <span className="rule-card__current">{current}</span>
                  <span className="rule-card__last">último disparo: {rule.lastTriggered}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="activity-log">
        <div className="section-label">Log de actividad</div>
        <div className="log-list">
          {LOG.map((entry, i) => (
            <div key={i} className="log-entry">
              <span className="log-entry__time">{entry.time}</span>
              <span
                className="log-entry__dot"
                style={{ background: entry.color }}
              />
              <span className="log-entry__text">{entry.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
