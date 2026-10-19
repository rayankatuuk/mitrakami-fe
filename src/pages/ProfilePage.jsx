import { useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import { clearAuthSession, getAuthSession, updateAuthSession } from '../utils/authStorage'
import { mitrakamiApi } from '../services/mitrakamiApi'
import { buildApiUrl } from '../services/apiClient'
import MobileBottomNav from '../components/MobileBottomNav'
import { resolvePackageAvatarPath } from '../utils/memberPackageAvatar'
import AppIcon from '../components/AppIcon'
import { Bell, Settings } from 'lucide-react'
import './ProfilePage.css'

const isLocalDevHost = () => {
  if (typeof window === 'undefined') return false
  const host = window.location.hostname
  return host === 'localhost' || host === '127.0.0.1'
}

const resolveAvatarUrl = (avatar, packageName) => {
  if (!avatar) return resolvePackageAvatarPath(packageName)
  if (/^https?:\/\//i.test(avatar)) return avatar

  return buildApiUrl(avatar)
}

const formatCurrency = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`

const getPackageDisplay = (packageName) => {
  if (!packageName) return 'Prime Member'
  if (/^prime\s+/i.test(packageName)) return packageName
  return `Prime ${packageName}`
}

const isTopPackage = (packageName) => /titanium/i.test(packageName || '')

const toDisplayValue = (value) => (value ? String(value) : '-')

const mapSessionToProfile = (session) => ({
  memberId: session?.memberId ?? '-',
  username: session?.username ?? '-',
  memberName: session?.memberName ?? session?.memberId ?? 'Member Prime',
  email: session?.email ?? '-',
  phone: session?.phone ?? '-',
  city: session?.city ?? '-',
  province: session?.province ?? '-',
  address: session?.address ?? '-',
  packageName: session?.packageName ?? 'Member',
  avatar: session?.avatar ?? null,
  walletBalance: Number(session?.walletBalance ?? 0),
  totalPv: Number(session?.totalPv ?? 0),
  status: session?.status ?? '-',
})

const mapApiProfileToState = (profile) => ({
  memberId: profile?.member_id ?? '-',
  username: profile?.username ?? '-',
  memberName: profile?.name ?? profile?.username ?? profile?.member_id ?? 'Member Prime',
  email: profile?.email ?? '-',
  phone: profile?.phone ?? '-',
  city: profile?.city ?? '-',
  province: profile?.province ?? '-',
  address: profile?.contact_address ?? '-',
  packageName: profile?.package?.name ?? 'Member',
  avatar: profile?.avatar ?? null,
  walletBalance: Number(profile?.wallet_balance ?? 0),
  totalPv: Number(profile?.total_pv ?? 0),
  status: profile?.status ?? '-',
})

const PROFILE_INFO_FIELDS = [
  { key: 'memberName', label: 'Nama Lengkap', icon: 'badge' },
  { key: 'memberId', label: 'Member ID', icon: 'id_card' },
  { key: 'username', label: 'Username', icon: 'alternate_email' },
  { key: 'email', label: 'Email', icon: 'mail' },
  { key: 'phone', label: 'No. Telepon', icon: 'call' },
  { key: 'city', label: 'Kota', icon: 'location_city' },
  { key: 'province', label: 'Provinsi', icon: 'map' },
  { key: 'address', label: 'Alamat', icon: 'home' },
]

export default function ProfilePage() {
  const navigate = useNavigate()
  const hasTriedRealtimeSync = useRef(false)

  const [profile, setProfile] = useState(() => mapSessionToProfile(getAuthSession()))
  const [showPersonalInfo, setShowPersonalInfo] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  useEffect(() => {
    let isMounted = true

    const currentSession = getAuthSession() ?? {}
    const shouldSkipRealtimeSync =
      isLocalDevHost() ||
      currentSession?.serverAuthUnavailable ||
      hasTriedRealtimeSync.current

    if (shouldSkipRealtimeSync) {
      return () => {
        isMounted = false
      }
    }

    hasTriedRealtimeSync.current = true

    const syncProfile = async () => {
      try {
        const apiProfile = await mitrakamiApi.getCurrentMember()
        if (!isMounted || !apiProfile) return

        const mapped = mapApiProfileToState(apiProfile)

        setProfile(mapped)
        updateAuthSession({
          memberId: mapped.memberId,
          memberName: mapped.memberName,
          username: mapped.username,
          email: mapped.email,
          phone: mapped.phone,
          city: mapped.city,
          province: mapped.province,
          address: mapped.address,
          packageName: mapped.packageName,
          avatar: mapped.avatar,
          walletBalance: mapped.walletBalance,
          totalPv: mapped.totalPv,
          status: mapped.status,
          serverAuthUnavailable: false,
        })
      } catch (error) {
        const status = error?.response?.status ?? error?.status
        if (status === 401) {
          updateAuthSession({ serverAuthUnavailable: true })
        }
      }
    }

    syncProfile()

    return () => {
      isMounted = false
    }
  }, [])

  const packageDisplay = useMemo(() => getPackageDisplay(profile?.packageName), [profile])
  const avatarDisplay = useMemo(() => resolveAvatarUrl(profile?.avatar, profile?.packageName), [profile])
  const canUpgrade = useMemo(() => !isTopPackage(profile?.packageName), [profile])

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true)
      await mitrakamiApi.logoutMember()
    } catch {
      // Ignore logout API error and clear local session regardless.
    } finally {
      clearAuthSession()
      navigate('/login', { replace: true })
      setIsLoggingOut(false)
    }
  }

  return (
    <main className="profile-page">
      <div className="profile-shell">
        <header className="profile-header">
          <div className="profile-header-sweep" aria-hidden="true" />
          <div className="profile-brand" aria-label="MitraKami SuperApp">
            <span className="profile-brand-mark">MK</span>
            <span className="profile-brand-name">mitra<span>Kami</span><small>SUPERAPP</small></span>
          </div>
          <div className="profile-header-tools" aria-hidden="true">
            <span><Bell /></span><span><Settings /></span>
          </div>
          <p className="profile-motto">Bersama MitraKami,<br />Membangun Indonesia.</p>
          <div className="profile-heading">
            <h1>Profil</h1>
            <p>Kelola informasi akun Anda</p>
          </div>
        </header>

        <div className="profile-content">
          <section className="profile-member-card" aria-label="Profil member">
            <div className="profile-member-main">
              <img src={avatarDisplay} alt="Profile member" className="profile-avatar" />
              <div className="profile-member-details">
                <h2>{toDisplayValue(profile.memberName)}</h2>
                <span className="profile-package-badge"><AppIcon name="badge" />{packageDisplay}</span>
                <p className="profile-member-id-label">Member ID</p>
                <p className="profile-member-id">{toDisplayValue(profile.memberId)}</p>
              </div>
              <AppIcon name="chevron_right" className="profile-member-chevron" />
            </div>

            <div className="profile-member-stats">
              <div className="profile-stat">
                <AppIcon name="badge" />
                <div><strong>{canUpgrade ? packageDisplay : 'Tertinggi'}</strong><span>Status Keanggotaan</span></div>
              </div>
              <div className="profile-stat">
                <AppIcon name="favorite_border" />
                <div><strong>{Number(profile.totalPv || 0).toLocaleString('id-ID')}</strong><span>MitraPoints</span></div>
              </div>
              <div className="profile-stat">
                <AppIcon name="account_balance_wallet" />
                <div><strong>{formatCurrency(profile.walletBalance)}</strong><span>Saldo</span></div>
              </div>
            </div>
          </section>

          <section className="profile-menu-card" aria-label="Pengaturan akun">
            <button type="button" onClick={() => setShowPersonalInfo((prev) => !prev)} className="profile-menu-row">
              <AppIcon name="person" className="profile-menu-icon" />
              <span className="profile-menu-copy"><strong>Informasi Pribadi</strong><small>Nama, email, nomor telepon</small></span>
              <AppIcon name={showPersonalInfo ? 'expand_less' : 'chevron_right'} className="profile-menu-chevron" />
            </button>
            {showPersonalInfo && (
              <div className="profile-info-grid">
                {PROFILE_INFO_FIELDS.map((field) => (
                  <div key={field.key} className="profile-info-item">
                    <div><AppIcon name={field.icon} /><span>{field.label}</span></div>
                    <strong>{toDisplayValue(profile[field.key])}</strong>
                  </div>
                ))}
              </div>
            )}

            <button type="button" className="profile-menu-row">
              <AppIcon name="privacy_tip" className="profile-menu-icon" />
              <span className="profile-menu-copy"><strong>Keamanan Akun</strong><small>Ubah kata sandi, verifikasi dua langkah</small></span>
              <AppIcon name="chevron_right" className="profile-menu-chevron" />
            </button>

            <button type="button" className="profile-menu-row">
              <AppIcon name="account_balance_wallet" className="profile-menu-icon" />
              <span className="profile-menu-copy"><strong>Metode Pembayaran</strong><small>Rekening bank, e-wallet, kartu</small></span>
              <AppIcon name="chevron_right" className="profile-menu-chevron" />
            </button>

            <button type="button" className="profile-menu-row">
              <AppIcon name="home" className="profile-menu-icon" />
              <span className="profile-menu-copy"><strong>Data & Privasi</strong><small>Atur penggunaan data Anda</small></span>
              <AppIcon name="chevron_right" className="profile-menu-chevron" />
            </button>
          </section>

          <section className="profile-menu-card profile-other-card" aria-label="Bantuan dan akun">
            <button type="button" className="profile-menu-row">
              <AppIcon name="help" className="profile-menu-icon" />
              <span className="profile-menu-copy"><strong>Pusat Bantuan</strong><small>FAQ, hubungi kami</small></span>
              <AppIcon name="chevron_right" className="profile-menu-chevron" />
            </button>

            <div className="profile-menu-row profile-about-row">
              <AppIcon name="id_card" className="profile-menu-icon" />
              <span className="profile-menu-copy"><strong>Tentang MitraKami</strong><small>Versi aplikasi 1.0.0</small></span>
              <AppIcon name="chevron_right" className="profile-menu-chevron" />
            </div>

            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="profile-menu-row profile-logout-row"
            >
              <AppIcon name="logout" className="profile-menu-icon" />
              <span className="profile-menu-copy"><strong>{isLoggingOut ? 'Keluar...' : 'Keluar'}</strong><small>Keluar dari akun ini</small></span>
              <AppIcon name="chevron_right" className="profile-menu-chevron" />
            </button>
          </section>

        </div>

        <MobileBottomNav currentTab="account" />
      </div>
    </main>
  )
}
