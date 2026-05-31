import { LayoutDashboard, Thermometer, Droplets, Sun, Zap, Star } from 'lucide-react'

const NAV = [
  { id: 'overview',    label: 'Inicio',   Icon: LayoutDashboard },
  { id: 't',           label: 'Temp',     Icon: Thermometer,  dot: '#f97316' },
  { id: 'h',           label: 'Humedad',  Icon: Droplets,     dot: '#3b82f6' },
  { id: 'l',           label: 'Luz',      Icon: Sun,          dot: '#f59e0b' },
  { id: 'control',     label: 'Control',  Icon: Zap },
  { id: 'automation',  label: 'Auto',     Icon: Star },
]

export default function BottomNav({ activeView, onNavigate }) {
  return (
    <nav className="bottom-nav">
      {NAV.map(({ id, label, Icon, dot }) => {
        const active = activeView === id
        return (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors relative
              ${active ? 'text-emerald-600' : 'text-slate-400'}`}
          >
            {dot && active && (
              <span className="absolute top-2 right-1/4 w-1.5 h-1.5 rounded-full" style={{ background: dot }} />
            )}
            <Icon size={20} />
            <span className="text-[9px] font-semibold">{label}</span>
          </button>
        )
      })}
    </nav>
  )
}
