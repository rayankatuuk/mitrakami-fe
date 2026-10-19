const isEmailValid = (value = '') => {
  const text = String(value).trim()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)
}

export const validateHotelGuestForm = (form = {}) => {
  const errors = {}

  const fullName = String(form.fullName || '').trim()
  const email = String(form.email || '').trim()
  const phone = String(form.phone || '').replace(/[^0-9]/g, '')

  if (!fullName) {
    errors.fullName = 'Nama tamu wajib diisi.'
  }

  if (!email) {
    errors.email = 'Email wajib diisi.'
  } else if (!isEmailValid(email)) {
    errors.email = 'Format email tidak valid.'
  }

  if (!phone) {
    errors.phone = 'Nomor telepon wajib diisi.'
  } else if (phone.length < 9) {
    errors.phone = 'Nomor telepon terlalu pendek.'
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  }
}
