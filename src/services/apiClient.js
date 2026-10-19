import axios from 'axios'
import { clearAuthSession, getAuthSession } from '../utils/authStorage'

const rawApiBaseUrl = (import.meta.env.VITE_PRIME_API_BASE_URL || '').trim()
export const API_BASE_URL = rawApiBaseUrl.replace(/\/+$/, '')
const SANCTUM_BASE_URL = API_BASE_URL.replace(/\/api$/i, '')

let csrfFetched = false

export const buildApiUrl = (path = '') => {
  const cleanPath = String(path).replace(/^\/+/, '')
  if (!cleanPath) return API_BASE_URL || '/'
  if (!API_BASE_URL) return `/${cleanPath}`
  return `${API_BASE_URL}/${cleanPath}`
}

const apiClient = axios.create({
  baseURL: API_BASE_URL || '/',
  withCredentials: true,
  timeout: 20000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
})

const getXsrfTokenFromCookie = () => {
  if (typeof document === 'undefined') return null

  const token = document.cookie
    .split('; ')
    .find((row) => row.startsWith('XSRF-TOKEN='))
    ?.split('=')[1]

  return token ? decodeURIComponent(token) : null
}

export const ensureCsrfCookie = async ({ force = false } = {}) => {
  if (csrfFetched && !force) return

  const endpoint = SANCTUM_BASE_URL
    ? `${SANCTUM_BASE_URL}/sanctum/csrf-cookie`
    : '/sanctum/csrf-cookie'

  await axios.get(endpoint, {
    withCredentials: true,
    timeout: 10000,
  })

  csrfFetched = true
}

apiClient.interceptors.request.use((config) => {
  // Prefer Bearer token for cross-domain auth (mitrakami.app → api.primerajawali.com)
  const session = getAuthSession()
  if (session?.token) {
    config.headers.Authorization = `Bearer ${session.token}`
  }

  // Also attach XSRF-TOKEN for same-domain session-based auth
  const xsrfToken = getXsrfTokenFromCookie()
  if (xsrfToken) {
    config.headers['X-XSRF-TOKEN'] = xsrfToken
  }

  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status
    const url = String(error?.config?.url || '')
    const isAuthEndpoint = url.includes('/api/auth/login') || url.includes('/api/auth/user')

    // Handle CSRF token mismatch — refresh token and retry once
    if (status === 419 && !error.config._csrfRetried) {
      error.config._csrfRetried = true
      try {
        await ensureCsrfCookie({ force: true })
        const xsrfToken = getXsrfTokenFromCookie()
        if (xsrfToken) {
          error.config.headers['X-XSRF-TOKEN'] = xsrfToken
        }
        return apiClient(error.config)
      } catch {
        // CSRF refresh failed, fall through to reject
      }
    }

    if (status === 401 && !isAuthEndpoint) {
      clearAuthSession()

      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }

    return Promise.reject(error)
  },
)

export default apiClient
