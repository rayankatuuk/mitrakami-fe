const normalizeText = (value) => String(value || '').toLowerCase().trim()

const includesAny = (haystack, keywords) => keywords.some((keyword) => haystack.includes(keyword))

const resolveHaystack = (item) => {
  return normalizeText([
    item?.display_name,
    item?.description,
    item?.category,
    item?.brand,
    item?.product_code,
  ].join(' '))
}

const MASA_AKTIF_KEYWORDS = [
  'masa aktif',
  'masaaktif',
  'aktif kartu',
  'active period',
  'validity',
  'perpanjang aktif',
]

const PAKET_TELEPON_KEYWORDS = [
  'paket telepon',
  'telepon',
  'telpon',
  'nelpon',
  'sms',
  'paket sms',
  'bundle sms',
  'short message',
  'short message service',
  'pesan singkat',
  'call',
  'voice',
  'minute',
  'minutes',
  'menit',
]

const DATA_KEYWORDS = [
  'paket data',
  'internet',
  'kuota',
  'quota',
  'data',
  'gb',
  'mb',
  'unlimited',
]

const PLN_TOKEN_REQUIRED_KEYWORDS = [
  'pln',
  'token listrik',
  'listrik token',
  'listrik prabayar',
  'id pelanggan',
  'no meter',
  'meter listrik',
  'kwh',
  'listrik',
]

const PLN_TOKEN_EXCLUDED_KEYWORDS = [
  'voucher',
  'game',
  'games',
  'diamond',
  'honor of kings',
  'hok',
  'mobile legends',
  'ml',
  'free fire',
  'ff',
  'pubg',
  'genshin',
  'steam',
  'garena',
  'valorant',
  'codm',
  'point blank',
  'gift card',
  'topup game',
]

export const classifyPulsaPrepaidProduct = (item) => {
  const haystack = resolveHaystack(item)

  if (!haystack) {
    return 'pulsa'
  }

  if (includesAny(haystack, MASA_AKTIF_KEYWORDS)) {
    return 'masa_aktif'
  }

  if (includesAny(haystack, PAKET_TELEPON_KEYWORDS)) {
    return 'paket_telepon'
  }

  if (includesAny(haystack, DATA_KEYWORDS)) {
    return 'data'
  }

  return 'pulsa'
}

export const isLikelyPlnTokenProduct = (item) => {
  const haystack = resolveHaystack(item)

  if (!haystack) {
    return false
  }

  if (includesAny(haystack, PLN_TOKEN_EXCLUDED_KEYWORDS)) {
    return false
  }

  return includesAny(haystack, PLN_TOKEN_REQUIRED_KEYWORDS)
}
