import { useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import AppIcon from '../components/AppIcon'
import { mitrakamiApi } from '../services/mitrakamiApi'
import { isAuthenticated, setAuthSession } from '../utils/authStorage'
import './LoginPage.css'

export default function LoginPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ memberId: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const alreadyLoggedIn = useMemo(() => isAuthenticated(), [])

  const handleChange = (event) => {
    const { name, value } = event.target

    if (name === 'memberId') {
      const normalizedValue = value
        .toUpperCase()
        .replace(/^PRIME/i, '')
        .replace(/\s+/g, '')
        .replace(/[^A-Z0-9]/g, '')

      setForm((prev) => ({ ...prev, memberId: normalizedValue }))
      return
    }

    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (!form.memberId.trim() || !form.password.trim()) {
      setError('Member ID dan password wajib diisi.')
      return
    }

    const memberIdSuffix = form.memberId.trim().toUpperCase()
    const distributorId = `PRIME${memberIdSuffix}`

    try {
      setIsSubmitting(true)

      const loginResponse = await mitrakamiApi.loginMember({
        distributorId,
        password: form.password,
      })

      const user = loginResponse?.user ?? {}
      const packageValue = user?.package
      const packageName =
        typeof packageValue === 'string'
          ? packageValue
          : (packageValue?.name ?? '')

      const session = {
        memberId: user?.member_id ?? distributorId,
        memberName: user?.name ?? user?.username ?? distributorId,
        username: user?.username ?? null,
        email: user?.email ?? null,
        phone: user?.phone ?? null,
        city: user?.city ?? null,
        province: user?.state ?? null,
        address: user?.address ?? null,
        packageName,
        avatar: user?.avatar ?? user?.profile_photo ?? null,
        walletBalance: Number(user?.wallet_balance ?? 0),
        status: user?.status ?? null,
        token: loginResponse?.token ?? null,
        loggedInAt: Date.now(),
      }

      setAuthSession(session)
      navigate('/app/home', { replace: true })
    } catch (requestError) {
      const responseMessage = requestError?.response?.data?.message
      const validationErrors = requestError?.response?.data?.errors
      const firstValidationError = validationErrors
        ? Object.values(validationErrors)?.[0]?.[0]
        : null

      setError(
        responseMessage ||
          firstValidationError ||
          'Login gagal. Periksa Member ID dan password Anda.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (alreadyLoggedIn) {
    return <Navigate to="/app/home" replace />
  }

  return (
    <main className="login-screen">
      <div className="login-artwork" aria-hidden="true" />

      <section className="login-form-panel" aria-label="Form masuk MitraKami">
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-field login-field-member">
            <label htmlFor="memberId">Member ID</label>
            <div className="login-input-wrap">
              <AppIcon name="person_outline" className="login-input-icon" />
              <input
                id="memberId"
                name="memberId"
                type="text"
                autoComplete="username"
                value={form.memberId}
                onChange={handleChange}
                placeholder="Masukkan Member ID Anda"
                className="login-input login-member-input"
              />
            </div>
          </div>

          <div className="login-field login-field-password">
            <label htmlFor="password">Kata Sandi</label>
            <div className="login-input-wrap">
              <AppIcon name="lock" className="login-input-icon" />
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={form.password}
                onChange={handleChange}
                placeholder="Masukkan kata sandi Anda"
                className="login-input login-password-input"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="login-password-toggle"
                aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
              >
                <AppIcon name={showPassword ? 'visibility_off' : 'visibility'} className="login-input-icon" />
              </button>
            </div>
          </div>

          {error ? (
            <p className="login-error" role="alert">{error}</p>
          ) : (
            <button type="button" className="login-forgot-password">
              Lupa Kata Sandi?
            </button>
          )}

          <button className="login-submit" type="submit" disabled={isSubmitting}>
            <span>{isSubmitting ? 'Memproses...' : 'Masuk'}</span>
            <AppIcon name="arrow_forward" className="login-submit-icon" />
          </button>
        </form>

        <p className="login-register-prompt">
          Belum punya akun? <span>Daftar Sekarang</span>
        </p>
      </section>
    </main>
  )
}
