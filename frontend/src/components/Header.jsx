export default function Header({ lastReading, live }) {
  const timeStr = lastReading
    ? new Date(lastReading.epoch).toLocaleString('es-AR', {
        day: '2-digit', month: 'short',
        hour: '2-digit', minute: '2-digit',
      })
    : '—'

  return (
    <header className="header">
      <div className="header-brand">
        <span className="header-logo">XLIMAX</span>
        <span className="header-device">ESP32-01 · Junín BA</span>
      </div>

      <div className="header-meta">
        <span className="header-last">Última lectura: {timeStr} ART</span>
        {live ? (
          <div className="status-badge">
            <span className="status-dot status-dot--online" />
            LIVE
          </div>
        ) : (
          <div className="status-badge status-badge--offline">
            <span className="status-dot" />
            MOCK
          </div>
        )}
      </div>
    </header>
  )
}
