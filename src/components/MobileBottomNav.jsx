import { Link } from 'react-router-dom'
import { useState } from 'react'
import { ScanLine } from 'lucide-react'
import AppIcon from './AppIcon'
import './MobileBottomNav.css'

const DEFAULT_NAV_ITEMS = [
  { to: '/app/home', label: 'Beranda', icon: 'home', key: 'home' },
  { to: '/app/history', label: 'Transaksi', icon: 'history', key: 'history' },
  { to: '/app/transfer', label: 'Belanja', icon: 'store', key: 'transfer' },
  { to: '/app/account', label: 'Akun', icon: 'person_outline', key: 'account' },
]

export default function MobileBottomNav({ currentTab, navItems = DEFAULT_NAV_ITEMS }) {
  const [isQrisActive, setIsQrisActive] = useState(false)
  const activeMenuKey = isQrisActive ? 'qris' : (currentTab || 'home')

  return (
    <nav className="mobile-bottom-nav fixed bottom-0 left-0 right-0 mx-auto max-w-md z-20">
      <div className="mobile-bottom-nav__inner">
        <div className="mobile-bottom-nav__side mobile-bottom-nav__side--left">
          {navItems.slice(0, 2).map((item) => {
            const isActive = activeMenuKey === item.key

            return (
              <Link
                key={item.key}
                to={item.to}
                onClick={() => setIsQrisActive(false)}
                className={`mobile-bottom-nav__link ${isActive ? 'is-active' : ''}`}
              >
                <AppIcon name={item.icon} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>

        <div className="mobile-bottom-nav__center">
          <button
            type="button"
            aria-label="Scan QRIS"
            onClick={() => setIsQrisActive(true)}
            className="mobile-bottom-nav__scan-button"
          >
            <ScanLine aria-hidden="true" />
          </button>
          <span className={`mobile-bottom-nav__center-label ${activeMenuKey === 'qris' ? 'is-active' : ''}`}>Scan</span>
        </div>

        <div className="mobile-bottom-nav__side mobile-bottom-nav__side--right">
          {navItems.slice(2).map((item) => {
            const isActive = activeMenuKey === item.key

            return (
              <Link
                key={item.key}
                to={item.to}
                onClick={() => setIsQrisActive(false)}
                className={`mobile-bottom-nav__link ${isActive ? 'is-active' : ''}`}
              >
                <AppIcon name={item.icon} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
