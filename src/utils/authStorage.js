const AUTH_STORAGE_KEY = 'mitrakami_auth_session'

export function getAuthSession() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw)
    if (!parsed?.memberId) return null

    return parsed
  } catch {
    return null
  }
}

export function setAuthSession(session) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
}

export function updateAuthSession(partialSession) {
  const current = getAuthSession() ?? {}
  setAuthSession({ ...current, ...partialSession })
}

export function clearAuthSession() {
  localStorage.removeItem(AUTH_STORAGE_KEY)
}

export function isAuthenticated() {
  return Boolean(getAuthSession()?.memberId)
}
