const PACKAGE_AVATAR_MAP = {
  founder: '/images/titanium.png',
  silver: '/images/silver.png',
  gold: '/images/gold.png',
  platinum: '/images/platinum.png',
  titanium: '/images/titanium.png',
}

export const normalizePackageTier = (packageName) => {
  if (!packageName) return ''

  return String(packageName)
    .replace(/^prime\s+/i, '')
    .trim()
    .toLowerCase()
}

export const resolvePackageAvatarPath = (packageName) => {
  const tier = normalizePackageTier(packageName)

  return PACKAGE_AVATAR_MAP[tier] ?? '/images/silver.png'
}
