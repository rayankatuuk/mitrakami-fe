import { useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import { clearAuthSession, getAuthSession, updateAuthSession } from '../utils/authStorage'
import { mitrakamiApi } from '../services/mitrakamiApi'
import { buildApiUrl } from '../services/apiClient'
import MobileBottomNav from '../components/MobileBottomNav'
import { resolvePackageAvatarPath } from '../utils/memberPackageAvatar'
import AppIcon from '../components/AppIcon'

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
    <div className="min-h-screen bg-background-app text-text-primary">
      <div className="mx-auto w-full max-w-md min-h-screen bg-background-app relative overflow-hidden pb-24">
        <header className="px-6 pt-10 pb-6 flex justify-between items-center border-b border-black/5 bg-background-app sticky top-0 z-10">
          <h1 className="text-2xl font-bold">Profile</h1>
          
        </header>

        <main className="px-5 pt-6 pb-8 space-y-5">
          <section className="bg-white rounded-3xl p-6 shadow-soft border border-black/5">
            <div className="flex flex-col items-center">
              <div className="relative mb-3">
                <img src={avatarDisplay} alt="Profile member" className="size-24 rounded-full object-cover border-4 border-background-app" />
                
              </div>

              <h2 className="text-md font-bold leading-tight text-center">{toDisplayValue(profile.memberName)}</h2>
              <p className="text-text-secondary text-md text-center mb-5">{toDisplayValue(profile.email)}</p>

              <div className="w-full">
                <div className="bg-background-app rounded-xl p-4 text-center">
                  <p className="text-text-secondary text-sm mb-1">Total Saldo</p>
                  <p className="text-primary text-xl font-bold">{formatCurrency(profile.walletBalance)}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl px-5 py-4 bg-linear-to-r from-primary to-[#f2b632] text-white shadow-soft">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">{packageDisplay}</h3>
                <p className="text-sm text-white/90">{canUpgrade ? 'Unlock exclusive features & limits' : 'Paket tertinggi Anda aktif'}</p>
              </div>
              {canUpgrade ? (
                <button type="button" className="bg-white text-primary rounded-full px-4 py-2 text-sm font-bold">
                  Upgrade
                </button>
              ) : (
                <span className="bg-white/20 rounded-full px-3 py-2 text-xs font-bold uppercase tracking-wider">Tertinggi</span>
              )}
            </div>
          </section>

          <section className="bg-white rounded-3xl p-2 shadow-soft border border-black/5">
            <p className="px-4 pt-3 pb-2 text-xs font-bold text-text-secondary uppercase tracking-[0.12em]">Akun</p>
            <button
              type="button"
              onClick={() => setShowPersonalInfo((prev) => !prev)}
              className="w-full flex items-center justify-between p-4 rounded-3xl hover:bg-background-app transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="size-10 rounded-full bg-blue-100 text-blue-600 grid place-items-center">
                  <AppIcon name="person" className="size-5" />
                </span>
                <div className="text-left">
                  <p className="font-bold">Informasi Pribadi</p>
                  <p className="text-sm text-text-secondary">Data akun pengguna</p>
                </div>
              </div>
              <AppIcon
                name={showPersonalInfo ? 'expand_less' : 'chevron_right'}
                className="size-4 text-text-secondary"
              />
            </button>

            <button type="button" className="w-full flex items-center justify-between p-4 rounded-3xl hover:bg-background-app transition-colors">
              <div className="flex items-center gap-3">
                <span className="size-10 rounded-full bg-green-100 text-green-600 grid place-items-center">
                  <AppIcon name="account_balance_wallet" className="size-5" />
                </span>
                <div className="text-left">
                  <p className="font-bold">Metode Pembayaran</p>
                  <p className="text-sm text-text-secondary">Rekening bank</p>
                </div>
              </div>
              <AppIcon name="chevron_right" className="size-4 text-text-secondary" />
            </button>

            {showPersonalInfo && (
              <div className="px-4 pb-4 grid grid-cols-1 gap-3">
                {PROFILE_INFO_FIELDS.map((field) => (
                  <div key={field.key} className="bg-background-app rounded-2xl p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <AppIcon name={field.icon} className="size-4 text-text-secondary" />
                      <p className="text-xs text-text-secondary uppercase tracking-wider">{field.label}</p>
                    </div>
                    <p className="text-sm font-bold wrap-break-word">{toDisplayValue(profile[field.key])}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-white rounded-4xl p-2 shadow-soft border border-black/5">
            <p className="px-4 pt-3 pb-2 text-xs font-bold text-text-secondary uppercase tracking-[0.12em]">Security</p>
            <button type="button" className="w-full flex items-center justify-between p-4 rounded-3xl hover:bg-background-app transition-colors">
              <div className="flex items-center gap-3">
                <span className="size-10 rounded-full bg-orange-100 text-orange-600 grid place-items-center">
                  <AppIcon name="lock" className="size-5" />
                </span>
                <div className="text-left">
                  <p className="font-bold">Pengaturan Keamanan</p>
                  <p className="text-sm text-text-secondary">PIN, FaceID, Kata Sandi</p>
                </div>
              </div>
              <AppIcon name="chevron_right" className="size-4 text-text-secondary" />
            </button>

            <button type="button" className="w-full flex items-center justify-between p-4 rounded-3xl hover:bg-background-app transition-colors">
              <div className="flex items-center gap-3">
                <span className="size-10 rounded-full bg-purple-100 text-purple-600 grid place-items-center">
                  <AppIcon name="privacy_tip" className="size-5" />
                </span>
                <div className="text-left">
                  <p className="font-bold">Data & Privasi</p>
                  <p className="text-sm text-text-secondary">Atur penggunaan data Anda</p>
                </div>
              </div>
              <AppIcon name="chevron_right" className="size-4 text-text-secondary" />
            </button>
          </section>

          <section className="bg-white rounded-4xl p-2 shadow-soft border border-black/5">
            <p className="px-4 pt-3 pb-2 text-xs font-bold text-text-secondary uppercase tracking-[0.12em]">Lainnya</p>
            <button type="button" className="w-full flex items-center justify-between p-4 rounded-3xl hover:bg-background-app transition-colors">
              <div className="flex items-center gap-3">
                <span className="size-10 rounded-full bg-gray-100 text-gray-600 grid place-items-center">
                  <AppIcon name="help" className="size-5" />
                </span>
                <div className="text-left">
                  <p className="font-bold">Pusat Bantuan</p>
                  <p className="text-sm text-text-secondary">FAQ, Hubungi Dukungan</p>
                </div>
              </div>
              <AppIcon name="chevron_right" className="size-4 text-text-secondary" />
            </button>

            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full flex items-center justify-between p-4 rounded-3xl hover:bg-red-50 transition-colors disabled:opacity-60"
            >
              <div className="flex items-center gap-3">
                <span className="size-10 rounded-full bg-red-100 text-red-600 grid place-items-center">
                  <AppIcon name="logout" className="size-5" />
                </span>
                <div className="text-left">
                  <p className="font-bold text-red-600">{isLoggingOut ? 'Keluar...' : 'Keluar'}</p>
                </div>
              </div>
            </button>
          </section>

          <p className="text-center text-sm text-text-secondary py-2">Version 1.0.0</p>
        </main>

        <MobileBottomNav currentTab="account" />
      </div>
    </div>
  )
}