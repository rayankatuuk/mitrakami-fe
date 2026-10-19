import { Link } from 'react-router-dom'
import { useState } from 'react'
import AppIcon from './AppIcon'

const DEFAULT_NAV_ITEMS = [
  { to: '/app/home', label: 'Beranda', icon: 'home', key: 'home' },
  { to: '/app/history', label: 'Riwayat', icon: 'history', key: 'history' },
  { to: '/app/transfer', label: 'Mitra Store', icon: 'store', key: 'transfer' },
  { to: '/app/account', label: 'Akun', icon: 'person_outline', key: 'account' },
]

export default function MobileBottomNav({ currentTab, navItems = DEFAULT_NAV_ITEMS }) {
  const [isQrisActive, setIsQrisActive] = useState(false)
  const activeMenuKey = isQrisActive ? 'qris' : (currentTab || 'home')

  return (
    <nav className="fixed bottom-0 left-0 right-0 mx-auto max-w-md bg-white border-t border-black/5 px-6 h-17.5 z-20 shadow-[0_-4px_24px_rgba(0,0,0,0.02)]">
      <div className="relative h-full flex items-center justify-between">
        <div className="flex w-[40%] justify-between">
          {navItems.slice(0, 2).map((item) => {
            const isActive = activeMenuKey === item.key

            return (
              <Link
                key={item.key}
                to={item.to}
                onClick={() => setIsQrisActive(false)}
                className={`flex flex-col items-center gap-1 min-w-16 ${isActive ? 'text-primary' : 'text-text-secondary'}`}
              >
                <AppIcon name={item.icon} className="size-6" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            )
          })}
        </div>

        <div className="absolute left-1/2 -translate-x-1/2 -top-3.5 flex flex-col items-center z-10">
          <button
            type="button"
            aria-label="QRIS"
            onClick={() => setIsQrisActive(true)}
            className="size-14 rounded-full bg-primary border-4 border-white flex items-center justify-center transition-transform active:scale-95 overflow-hidden p-2"
          >
            <img src="/icons/logo_qris.png" alt="QRIS Logo" className="w-full h-full object-contain" />
          </button>
          <span className={`text-[10px] font-bold gap-1 ${activeMenuKey === 'qris' ? 'text-primary' : 'text-text-secondary'}`}>QRIS</span>
        </div>

        <div className="flex w-[40%] justify-between">
          {navItems.slice(2).map((item) => {
            const isActive = activeMenuKey === item.key

            return (
              <Link
                key={item.key}
                to={item.to}
                onClick={() => setIsQrisActive(false)}
                className={`flex flex-col items-center gap-1 min-w-16 ${isActive ? 'text-primary' : 'text-text-secondary'}`}
              >
                <AppIcon name={item.icon} className="size-6" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}