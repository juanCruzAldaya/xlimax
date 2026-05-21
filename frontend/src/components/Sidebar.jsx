const NAV = [
  {
    section: 'Monitoreo',
    items: [
      { id: 'overview',    label: 'Overview',      icon: <OverviewIcon /> },
      { id: 't',           label: 'Temperatura',   icon: <TempIcon />,   dot: '#f59e0b' },
      { id: 'h',           label: 'Humedad',       icon: <HumIcon />,    dot: '#38bdf8' },
      { id: 'l',           label: 'Luminosidad',   icon: <LightIcon />,  dot: '#a3e635' },
    ],
  },
  {
    section: 'Control',
    items: [
      { id: 'automation',  label: 'Automatización', icon: <AutoIcon /> },
    ],
  },
]

export default function Sidebar({ activeView, onNavigate }) {
  return (
    <nav className="sidebar">
      {NAV.map(section => (
        <div key={section.section}>
          <div className="nav-section-label">{section.section}</div>
          {section.items.map(item => (
            <div
              key={item.id}
              className={`nav-item${activeView === item.id ? ' nav-item--active' : ''}`}
              onClick={() => onNavigate(item.id)}
            >
              <span className="nav-item__icon">{item.icon}</span>
              <span className="nav-item__label">{item.label}</span>
              {item.dot && (
                <span
                  className="nav-item__indicator"
                  style={{ background: item.dot }}
                />
              )}
            </div>
          ))}
        </div>
      ))}
    </nav>
  )
}

function OverviewIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="1" width="5" height="5" rx="1" />
      <rect x="8" y="1" width="5" height="5" rx="1" />
      <rect x="1" y="8" width="5" height="5" rx="1" />
      <rect x="8" y="8" width="5" height="5" rx="1" />
    </svg>
  )
}

function TempIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M7 1v7.2" strokeLinecap="round" />
      <circle cx="7" cy="10.5" r="2" />
      <path d="M5 3h1M5 5h1M5 7h1" strokeLinecap="round" />
    </svg>
  )
}

function HumIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M7 2 C7 2 2 7 2 9.5a5 5 0 0 0 10 0C12 7 7 2 7 2z" />
    </svg>
  )
}

function LightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="7" cy="7" r="2.5" />
      <path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.93 2.93l1.06 1.06M9.01 9.01l1.06 1.06M2.93 11.07l1.06-1.06M9.01 4.99l1.06-1.06" strokeLinecap="round" />
    </svg>
  )
}

function AutoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M7 1l1.5 3.5L13 5l-3 2.9.7 4.1L7 10.5 3.3 12l.7-4.1L1 5l4.5-.5z" />
    </svg>
  )
}
