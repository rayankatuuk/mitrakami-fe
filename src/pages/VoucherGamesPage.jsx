import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MobileBottomNav from '../components/MobileBottomNav'
import { mitrakamiApi } from '../services/mitrakamiApi'
import { getAuthSession, updateAuthSession } from '../utils/authStorage'
import AppIcon from '../components/AppIcon'

const formatCurrency = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`
const sanitizeCustomerNumber = (value) => String(value || '').replace(/[^0-9A-Za-z]/g, '')

const toKey = (value) => String(value || '').toLowerCase().trim().replace(/\s+/g, '-')

const GAMING_INCLUDE_KEYWORDS = [
  'game',
  'games',
  'gaming',
  'voucher game',
  'voucher games',
  'diamond',
  'garena',
  'steam',
  'uc',
  'genshin',
  'mobile legends',
  'free fire',
  'pubg',
  'valorant',
  'codm',
]

const NON_GAME_EXCLUDE_KEYWORDS = [
  'axis',
  'by.u',
  'byu',
  'indosat',
  'nex parabola',
  'smartfren',
  'telkomsel',
  'wifi id',
  'wifi.id',
  'pln',
  'token listrik',
  'bpjs',
  'pdam',
  'pascabayar',
  'pulsa',
  'paket data',
]

const isGameVoucherProduct = (product) => {
  const haystack = [
    product?.display_name,
    product?.description,
    product?.brand,
    product?.category,
    product?.product_code,
  ]
    .map((item) => String(item || '').toLowerCase().trim())
    .join(' ')

  if (!haystack) {
    return false
  }

  const hasExcludedKeyword = NON_GAME_EXCLUDE_KEYWORDS.some((keyword) => haystack.includes(keyword))
  if (hasExcludedKeyword) {
    return false
  }

  return GAMING_INCLUDE_KEYWORDS.some((keyword) => haystack.includes(keyword))
}

const resolveGameName = (product) => {
  const brand = String(product?.brand || '').trim()
  if (brand) return brand

  const category = String(product?.category || '').trim()
  if (category) return category

  const displayName = String(product?.display_name || '').trim()
  if (!displayName) return 'Voucher Game'

  const cleaned = displayName
    .replace(/\b(\d+[kK]?|diamond|dm|voucher|top\s*up|topup|coins?|points?|uc)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return cleaned || displayName
}

const resolveGameImageUrl = (products) => {
  const firstImage = products.find((item) => String(item?.image_url || '').trim() !== '')
  return firstImage?.image_url || ''
}

const toTitleCase = (value) => {
  return String(value || '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ')
}

const toVoucherGameImageCandidates = (gameName, providerImageUrl) => {
  const normalizedName = String(gameName || '').trim().replace(/\s+/g, ' ')
  const safeProviderImage = String(providerImageUrl || '').trim()

  const baseVariants = Array.from(new Set([
    normalizedName,
    normalizedName.replace(/\s*&\s*/g, ' and '),
    normalizedName.replace(/\blegends\b/gi, 'legend'),
    toTitleCase(normalizedName),
    toTitleCase(normalizedName.replace(/\blegends\b/gi, 'legend')),
  ].map((item) => item.trim()).filter(Boolean)))

  const filenameVariants = baseVariants.flatMap((variant) => {
    const compact = variant.replace(/[\\/:*?"<>|]/g, '').trim()

    return [
      compact,
      compact.replace(/\s+/g, '-'),
      compact.replace(/\s+/g, '_'),
    ]
  })

  const localCandidates = Array.from(new Set(filenameVariants))
    .flatMap((filename) => ([
      `/images/voucher-games/${filename}.png`,
      `/images/voucher-games/${filename}.jpg`,
      `/images/voucher-games/${filename}.jpeg`,
      `/images/voucher-games/${filename}.webp`,
    ]))

  if (safeProviderImage) {
    localCandidates.push(safeProviderImage)
  }

  return localCandidates
}

const makeGamePlaceholder = (name) => {
  const safeName = String(name || 'Game').trim()
  const initials = safeName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((token) => token[0]?.toUpperCase() || '')
    .join('') || 'GM'

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180" fill="none">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="320" y2="180">
          <stop offset="0" stop-color="#0EA5E9"/>
          <stop offset="1" stop-color="#7C3AED"/>
        </linearGradient>
      </defs>
      <rect width="320" height="180" rx="20" fill="url(#g)"/>
      <circle cx="275" cy="44" r="34" fill="white" fill-opacity="0.14"/>
      <circle cx="46" cy="145" r="28" fill="white" fill-opacity="0.12"/>
      <text x="20" y="142" fill="white" font-size="56" font-family="Arial, sans-serif" font-weight="700">${initials}</text>
    </svg>
  `.trim()

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

function GameCoverImage({ gameName, providerImageUrl, className, alt }) {
  const candidates = useMemo(
    () => [...toVoucherGameImageCandidates(gameName, providerImageUrl), makeGamePlaceholder(gameName)],
    [gameName, providerImageUrl],
  )
  const [currentIndex, setCurrentIndex] = useState(0)

  const src = candidates[currentIndex] || makeGamePlaceholder(gameName)

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={className}
      onError={() => {
        setCurrentIndex((previous) => {
          if (previous >= candidates.length - 1) {
            return previous
          }

          return previous + 1
        })
      }}
    />
  )
}

export default function VoucherGamesPage() {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(true)
  const [isPlacingOrder, setIsPlacingOrder] = useState(false)
  const [requestError, setRequestError] = useState('')
  const [products, setProducts] = useState([])
  const [selectedGameKey, setSelectedGameKey] = useState('')
  const [selectedProductCode, setSelectedProductCode] = useState('')
  const [customerNumber, setCustomerNumber] = useState('')
  const [walletBalance, setWalletBalance] = useState(() => Number(getAuthSession()?.walletBalance ?? 0))

  const loadProducts = useCallback(async () => {
    setIsLoading(true)
    setRequestError('')

    try {
      const payload = await mitrakamiApi.getVoucherGameProducts()
      const nextProducts = Array.isArray(payload?.products) ? payload.products : []
      setProducts(nextProducts)
    } catch (error) {
      const responseMessage = error?.response?.data?.message
      setRequestError(responseMessage || 'Gagal memuat katalog voucher games.')
      setProducts([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  const games = useMemo(() => {
    const grouped = products
      .filter((item) => isGameVoucherProduct(item))
      .reduce((accumulator, item) => {
      const gameName = resolveGameName(item)
      const key = toKey(gameName)

      if (!accumulator[key]) {
        accumulator[key] = {
          key,
          name: gameName,
          products: [],
        }
      }

      accumulator[key].products.push(item)
      return accumulator
      }, {})

    return Object.values(grouped)
      .map((item) => ({
        ...item,
        providerImageUrl: resolveGameImageUrl(item.products),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'id'))
  }, [products])

  const selectedGame = useMemo(
    () => games.find((item) => item.key === selectedGameKey) || null,
    [games, selectedGameKey],
  )

  const selectedProducts = useMemo(() => {
    if (!selectedGame) {
      return []
    }

    return [...selectedGame.products]
      .filter((item) => Boolean(item?.is_active))
      .sort((a, b) => Number(a?.sell_price ?? 0) - Number(b?.sell_price ?? 0))
  }, [selectedGame])

  const selectedProduct = useMemo(
    () => selectedProducts.find((item) => item.product_code === selectedProductCode) || null,
    [selectedProductCode, selectedProducts],
  )

  const canSubmitOrder = Boolean(selectedProduct && sanitizeCustomerNumber(customerNumber).length >= 4 && !isPlacingOrder)

  const handleBack = () => {
    if (selectedGameKey) {
      setSelectedGameKey('')
      setSelectedProductCode('')
      setCustomerNumber('')
      setRequestError('')
      return
    }

    navigate('/app/home')
  }

  const handleChooseGame = (gameKey) => {
    setSelectedGameKey(gameKey)
    setSelectedProductCode('')
    setRequestError('')
  }

  const handleCreateOrder = async () => {
    if (!canSubmitOrder) {
      setRequestError('Lengkapi User ID dan pilih voucher terlebih dahulu.')
      return
    }

    setIsPlacingOrder(true)
    setRequestError('')

    try {
      const payload = await mitrakamiApi.createVoucherGameOrder({
        customerNumber: sanitizeCustomerNumber(customerNumber),
        productCode: selectedProduct.product_code,
      })

      const nextBalance = Number(payload?.wallet_balance ?? walletBalance)
      setWalletBalance(nextBalance)

      const latestSession = getAuthSession() ?? {}
      updateAuthSession({
        ...latestSession,
        walletBalance: nextBalance,
      })

      navigate('/app/history', { replace: true })
    } catch (error) {
      const responseMessage = error?.response?.data?.message
      setRequestError(responseMessage || 'Gagal memproses pembelian voucher game.')
    } finally {
      setIsPlacingOrder(false)
    }
  }

  return (
    <div className="min-h-screen bg-background-app text-text-primary">
      <div className="mx-auto w-full max-w-md min-h-screen bg-background-app relative overflow-hidden pb-28">
        <header className="px-6 pt-12 pb-5 rounded-b-4xl bg-primary text-white sticky top-0 z-10 shadow-soft">
          <div className="flex items-center gap-3 mb-4">
            <button
              type="button"
              onClick={handleBack}
              className="size-10 rounded-full bg-white/15 grid place-items-center"
              aria-label="Kembali"
            >
              <AppIcon name="arrow_back_ios_new" className="size-5" />
            </button>

            <div>
              <h1 className="text-xl font-bold">Voucher Games</h1>
              <p className="text-xs text-white/80">Pilih game, lalu pilih voucher sesuai kebutuhan</p>
            </div>
          </div>

        </header>

        <main className="px-6 py-5 space-y-5">
          {!selectedGame && (
            <section className="space-y-4">
              <div className="rounded-3xl bg-white border border-black/5 shadow-soft p-4">
                <h2 className="text-sm font-semibold text-text-secondary">Pilih Game</h2>
                <p className="text-xs text-text-secondary mt-1">Pilih game terlebih dahulu, lalu lanjut pilih voucher.</p>
              </div>

              {isLoading && (
                <div className="grid grid-cols-3 gap-3">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="h-30 rounded-2xl bg-white animate-pulse" />
                  ))}
                </div>
              )}

              {!isLoading && games.length === 0 && (
                <div className="rounded-2xl bg-white border border-black/5 p-5 text-center text-sm text-text-secondary">
                  Katalog voucher games belum tersedia.
                </div>
              )}

              {!isLoading && games.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  {games.map((game) => {
                    return (
                      <button
                        key={game.key}
                        type="button"
                        onClick={() => handleChooseGame(game.key)}
                        className="rounded-2xl bg-white border border-black/5 shadow-soft overflow-hidden text-left transition hover:border-primary/30"
                      >
                        <GameCoverImage
                          key={`${game.key}-${game.providerImageUrl || 'no-image'}`}
                          gameName={game.name}
                          providerImageUrl={game.providerImageUrl}
                          alt={game.name}
                          className="w-full h-20 object-cover bg-slate-100"
                        />
                        <div className="p-2">
                          <p className="text-xs font-semibold leading-tight line-clamp-2">{game.name}</p>
                          <p className="text-[11px] text-text-secondary mt-1">{game.products.length} voucher</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </section>
          )}

          {selectedGame && (
            <section className="space-y-4">
              <div className="rounded-3xl bg-white border border-black/5 shadow-soft p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <GameCoverImage
                    key={`${selectedGame.key}-${selectedGame.providerImageUrl || 'no-image'}`}
                    gameName={selectedGame.name}
                    providerImageUrl={selectedGame.providerImageUrl}
                    alt={selectedGame.name}
                    className="size-14 rounded-xl object-cover bg-slate-100"
                  />
                  <div>
                    <p className="text-xs uppercase tracking-wide text-text-secondary">Game Terpilih</p>
                    <h2 className="font-bold leading-tight">{selectedGame.name}</h2>
                  </div>
                </div>

                <div>
                  <label htmlFor="voucherCustomerNumber" className="text-sm font-semibold text-text-secondary block mb-2">
                    User ID
                  </label>
                  <input
                    id="voucherCustomerNumber"
                    type="text"
                    value={customerNumber}
                    onChange={(event) => setCustomerNumber(sanitizeCustomerNumber(event.target.value))}
                    placeholder="Masukkan user ID"
                    className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold"
                  />
                  <p className="text-xs text-text-secondary mt-2">
                    Format umumnya alfanumerik. Jika game membutuhkan format khusus, ikuti deskripsi voucher.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-text-secondary">Pilih Voucher</h3>

                {selectedProducts.length === 0 && (
                  <div className="rounded-2xl bg-white border border-black/5 p-4 text-sm text-text-secondary">
                    Voucher untuk game ini belum tersedia.
                  </div>
                )}

                {selectedProducts.map((product) => {
                  const isSelected = selectedProductCode === product.product_code
                  const isOutOfStock = Number(product?.stock ?? 0) <= 0

                  return (
                    <button
                      key={product.product_code}
                      type="button"
                      disabled={isOutOfStock}
                      onClick={() => setSelectedProductCode(product.product_code)}
                      className={`w-full rounded-2xl border p-4 text-left transition bg-white ${isSelected ? 'border-primary ring-2 ring-primary/20 shadow-soft' : 'border-black/10'} ${isOutOfStock ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary/30'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold leading-tight">{product.display_name}</p>
                          <p className="text-xs text-text-secondary mt-1 line-clamp-2">{product.description || '-'}</p>
                        </div>
                        <span className="text-sm font-bold text-primary whitespace-nowrap">{formatCurrency(product.sell_price)}</span>
                      </div>
                    </button>
                  )
                })}
              </div>

              {selectedProduct && (
                <div className="rounded-3xl bg-white border border-black/5 shadow-soft p-4 space-y-2">
                  <h2 className="font-bold">Pembayaran</h2>
                  <div className="flex items-center justify-between text-sm gap-3">
                    <span className="text-text-secondary">Saldo Mitrakami</span>
                    <span className="font-semibold">{formatCurrency(walletBalance)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm gap-3">
                    <span className="text-text-secondary">Total bayar</span>
                    <span className="font-semibold text-primary">{formatCurrency(selectedProduct.sell_price)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCreateOrder}
                    disabled={!canSubmitOrder}
                    className="w-full rounded-2xl bg-primary text-white font-bold py-3 disabled:opacity-50 mt-1"
                  >
                    {isPlacingOrder ? 'Memproses...' : 'Beli Sekarang'}
                  </button>
                </div>
              )}
            </section>
          )}

          {requestError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
              {requestError}
            </div>
          )}
        </main>

        <MobileBottomNav currentTab="home" />
      </div>
    </div>
  )
}
