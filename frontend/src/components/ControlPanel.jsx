import { useState } from 'react'
import { useDeviceState } from '../hooks/useDeviceState'
import { toggleActuator, allOff, ACTUATOR_CONFIG } from '../services/deviceControl'

export default function ControlPanel({ lastReading }) {
  const { state, loading } = useDeviceState()
  const [pending, setPending] = useState({})

  async function handleToggle(key) {
    setPending(p => ({ ...p, [key]: true }))
    try {
      await toggleActuator(key, !state[key])
    } finally {
      setPending(p => ({ ...p, [key]: false }))
    }
  }

  async function handleAllOff() {
    setPending({ light: true, fan: true, pump: true, aux: true })
    try {
      await allOff()
    } finally {
      setPending({})
    }
  }

  const anyOn = Object.values(state).some(v => v === true)

  return (
    <div className="control-panel">

      <div className="control-header">
        <div>
          <div className="section-label">Control de actuadores</div>
          <p className="control-subtitle">
            Los cambios se envían al ESP32 en ~3 s vía Firestore
          </p>
        </div>
        {anyOn && (
          <button className="btn-all-off" onClick={handleAllOff}>
            Apagar todo
          </button>
        )}
      </div>

      <div className="actuator-grid">
        {Object.entries(ACTUATOR_CONFIG).map(([key, cfg]) => (
          <ActuatorCard
            key={key}
            id={key}
            cfg={cfg}
            active={!!state[key]}
            pending={!!pending[key]}
            loading={loading}
            onToggle={() => handleToggle(key)}
          />
        ))}
      </div>

      <div className="control-footer">
        <div className="connection-status">
          <span className="status-dot status-dot--online" />
          <span>Conectado a Firestore — cambios en tiempo real</span>
        </div>
        {lastReading && (
          <span className="control-reading">
            Temp actual: <strong>{lastReading.t} °C</strong>
            &nbsp;·&nbsp;
            Hum: <strong>{lastReading.h} %</strong>
          </span>
        )}
      </div>

    </div>
  )
}

function ActuatorCard({ id, cfg, active, pending, loading, onToggle }) {
  return (
    <div
      className={`actuator-card${active ? ' actuator-card--on' : ''}${pending ? ' actuator-card--pending' : ''}`}
      style={{ '--actuator-color': cfg.color }}
    >
      <div className="actuator-card__top">
        <div className="actuator-icon">
          <ActuatorIcon type={cfg.icon} active={active} color={cfg.color} />
        </div>
        <Toggle
          checked={active}
          disabled={loading || pending}
          color={cfg.color}
          onChange={onToggle}
        />
      </div>

      <div className="actuator-card__label">{cfg.label}</div>

      <div className={`actuator-status ${active ? 'actuator-status--on' : ''}`}>
        {pending ? 'Enviando…' : active ? 'Encendido' : 'Apagado'}
      </div>
    </div>
  )
}

function Toggle({ checked, disabled, color, onChange }) {
  return (
    <button
      className={`toggle${checked ? ' toggle--on' : ''}`}
      style={{ '--toggle-color': color }}
      disabled={disabled}
      onClick={onChange}
      aria-pressed={checked}
    >
      <span className="toggle__thumb" />
    </button>
  )
}

function ActuatorIcon({ type, active, color }) {
  const c = active ? color : 'currentColor'
  const icons = {
    light: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" strokeLinecap="round" />
      </svg>
    ),
    fan: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5">
        <circle cx="12" cy="12" r="2" />
        <path d="M12 2C8 2 6 6 8 9c-3-1-7 1-6 5 1 3 5 3 7 1-1 3 1 7 5 6 3-1 3-5 1-7 3 1 7-1 6-5-1-3-5-3-7-1 1-3-1-7-5-6z" />
      </svg>
    ),
    pump: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5">
        <path d="M12 2C12 2 7 8 7 13a5 5 0 0 0 10 0C17 8 12 2 12 2z" />
        <path d="M9 13.5a3 3 0 0 0 6 0" strokeLinecap="round" />
      </svg>
    ),
    aux: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" strokeLinecap="round" />
      </svg>
    ),
  }
  return icons[type] ?? null
}
