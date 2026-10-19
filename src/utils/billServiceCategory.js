const normalizeText = (value) => String(value || '').toLowerCase().trim()

const EWALLET_HINTS = [
  'ewallet',
  'e-wallet',
  'emoney',
  'e-money',
  'topup ewallet',
  'top up ewallet',
  'topup e-wallet',
  'top up e-wallet',
  'gopay',
  'ovo',
  'dana',
  'shopeepay',
  'linkaja',
  'isaku',
  'tapcash',
  'brizzi',
  'flazz',
]

const resolveHaystack = (service) => {
  const keywords = Array.isArray(service?.keywords) ? service.keywords.join(' ') : ''

  return normalizeText([
    service?.code,
    service?.name,
    service?.display_name,
    service?.label,
    keywords,
  ].join(' '))
}

export const isEwalletService = (service) => {
  const haystack = resolveHaystack(service)

  if (!haystack) {
    return false
  }

  return EWALLET_HINTS.some((hint) => haystack.includes(hint))
}
