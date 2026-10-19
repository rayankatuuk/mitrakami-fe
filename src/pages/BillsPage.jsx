import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import MobileBottomNav from '../components/MobileBottomNav'
import SupplierModeSelector from '../components/SupplierModeSelector'
import { mitrakamiApi } from '../services/mitrakamiApi'
import { getAuthSession, updateAuthSession } from '../utils/authStorage'
import { isEwalletService } from '../utils/billServiceCategory'
import AppIcon from '../components/AppIcon'

const normalizeText = (value) => String(value || '').toLowerCase().trim()
const formatCurrency = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`
const sanitizeCustomerNumber = (value) => String(value || '').replace(/[^0-9A-Za-z]/g, '')

const PLN_TOKEN_CODE = 'pln-token'
const PLN_PASCABAYAR_CODE = 'pln-pascabayar'
const PLN_PARENT_CODE = 'pln'
const INTERNET_PASCABAYAR_CODE = 'internet-pascabayar'
const VOUCHER_GAMES_CODE = 'voucher-games'
const SUPPLIER_MODE_AUTO = 'auto'

const isInternetPascabayarCode = (value) => {
  const code = normalizeText(value)
  return code === INTERNET_PASCABAYAR_CODE || code === 'internet_pascabayar' || code === 'internet-pasca-bayar'
}

const isPreferredInternetProduct = (product) => {
  const haystack = [
    product?.display_name,
    product?.description,
    product?.brand,
    product?.category,
    product?.product_code,
  ]
    .map((item) => normalizeText(item))
    .join(' ')

  return haystack.includes('speedy') || haystack.includes('indihome')
}

const PLN_TABS = [
  { key: PLN_TOKEN_CODE, label: 'Token Listrik' },
  { key: PLN_PASCABAYAR_CODE, label: 'Tagihan Listrik' },
]

const formatNominalLabel = (displayName) => {
  const digitMatch = displayName.match(/[\d.]+/)
  return digitMatch ? digitMatch[0] : displayName
}

export default function BillsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [services, setServices] = useState([])
  const [selectedService, setSelectedService] = useState(null)
  const [products, setProducts] = useState([])
  const [selectedProductCode, setSelectedProductCode] = useState('')
  const [customerNumber, setCustomerNumber] = useState('')
  const [inquiryResult, setInquiryResult] = useState(null)
  const [walletBalance, setWalletBalance] = useState(() => Number(getAuthSession()?.walletBalance ?? 0))
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [productsLoading, setProductsLoading] = useState(false)
  const [isCheckingInquiry, setIsCheckingInquiry] = useState(false)
  const [isPlacingOrder, setIsPlacingOrder] = useState(false)
  const [requestError, setRequestError] = useState('')
  const [showPlnView, setShowPlnView] = useState(false)
  const [activePlnTab, setActivePlnTab] = useState(PLN_TOKEN_CODE)
  const [supplierMode, setSupplierMode] = useState(SUPPLIER_MODE_AUTO)
  const [activeSuppliers, setActiveSuppliers] = useState([])

  const transactionMode = selectedService?.transaction_mode || 'postpaid'
  const isPostpaid = transactionMode === 'postpaid'

  const loadServices = useCallback(async () => {
    setIsLoading(true)
    setRequestError('')

    try {
      const payload = await mitrakamiApi.getBillServices()
      setServices(Array.isArray(payload?.services) ? payload.services : [])
    } catch (error) {
      const responseMessage = error?.response?.data?.message
      setRequestError(responseMessage || 'Gagal memuat layanan tagihan.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadServices()
  }, [loadServices])

  const loadProducts = useCallback(async (serviceCode, nextSupplierMode = SUPPLIER_MODE_AUTO) => {
    setProductsLoading(true)
    setRequestError('')

    try {
      const normalizedServiceCode = normalizeText(serviceCode)
      const isPlnTokenService = normalizedServiceCode === PLN_TOKEN_CODE

      const payload = await mitrakamiApi.getBillProducts({
        serviceCode,
        supplierCode: isPlnTokenService && nextSupplierMode !== SUPPLIER_MODE_AUTO
          ? nextSupplierMode
          : undefined,
      })
      const rawProducts = Array.isArray(payload?.products) ? payload.products : []
      const apiSuppliers = Array.isArray(payload?.meta?.suppliers) ? payload.meta.suppliers : []

      if (isPlnTokenService) {
        setActiveSuppliers(apiSuppliers)
      } else {
        setActiveSuppliers([])
      }

      const supplierCode = isPlnTokenService && nextSupplierMode !== SUPPLIER_MODE_AUTO
        ? nextSupplierMode
        : undefined

      const productsBySupplier = supplierCode
        ? rawProducts.filter((item) => normalizeText(item?.best_supplier?.code) === supplierCode)
        : rawProducts

      const nextProducts = productsBySupplier
      setProducts(nextProducts)

      const preferredInternetProduct = isInternetPascabayarCode(serviceCode)
        ? nextProducts.find((item) => isPreferredInternetProduct(item))
        : null

      if (preferredInternetProduct?.product_code) {
        setSelectedProductCode(preferredInternetProduct.product_code)
      } else if (nextProducts.length === 1) {
        setSelectedProductCode(nextProducts[0]?.product_code || '')
      } else {
        setSelectedProductCode('')
      }

      setInquiryResult(null)
    } catch (error) {
      const responseMessage = error?.response?.data?.message
      setRequestError(responseMessage || 'Gagal memuat produk tagihan.')
      setProducts([])
      setSelectedProductCode('')
      setActiveSuppliers([])
    } finally {
      setProductsLoading(false)
    }
  }, [])

  const isInternetPascabayarService = useCallback((service) => {
    return isInternetPascabayarCode(service?.code)
  }, [])

  const filteredServices = useMemo(() => {
    const keyword = normalizeText(searchTerm)

    const normalizedServices = services.filter(
      (item) => item?.code !== PLN_TOKEN_CODE
        && item?.code !== PLN_PASCABAYAR_CODE
        && normalizeText(item?.code) !== VOUCHER_GAMES_CODE
        && !isInternetPascabayarService(item)
        && !isEwalletService(item),
    )

    if (!keyword) {
      return normalizedServices
    }

    return normalizedServices.filter((item) => normalizeText(item?.name).includes(keyword))
  }, [isInternetPascabayarService, searchTerm, services])

  const handleServiceClick = (service) => {
    if (!service?.is_active) {
      return
    }

    if (service?.code === PLN_PARENT_CODE || service?.is_parent) {
      setShowPlnView(true)
      setSupplierMode(SUPPLIER_MODE_AUTO)
      setActiveSuppliers([])
      setSelectedService(null)
      setProducts([])
      setSelectedProductCode('')
      setCustomerNumber('')
      setInquiryResult(null)
      setRequestError('')
      handlePlnTabSwitch(activePlnTab)
      return
    }

    setSelectedService(service)
    setShowPlnView(false)
    setSupplierMode(SUPPLIER_MODE_AUTO)
    setActiveSuppliers([])
    setCustomerNumber('')
    setSelectedProductCode('')
    setInquiryResult(null)
    setRequestError('')
    loadProducts(service.code)
  }

  const handlePlnTabSwitch = useCallback((tabKey) => {
    setActivePlnTab(tabKey)
    setSupplierMode(SUPPLIER_MODE_AUTO)
    setActiveSuppliers([])
    setCustomerNumber('')
    setSelectedProductCode('')
    setInquiryResult(null)
    setRequestError('')
    setProducts([])

    const targetService = services.find((item) => item?.code === tabKey)
    if (targetService) {
      setSelectedService(targetService)
      loadProducts(tabKey, SUPPLIER_MODE_AUTO)
    } else {
      setSelectedService(null)
    }
  }, [loadProducts, services])

  const handleSwitchSupplierMode = async (nextSupplierMode) => {
    if (supplierMode === nextSupplierMode) {
      return
    }

    setSupplierMode(nextSupplierMode)
    setSelectedProductCode('')
    setInquiryResult(null)

    if (activePlnTab === PLN_TOKEN_CODE && selectedService?.code === PLN_TOKEN_CODE) {
      await loadProducts(PLN_TOKEN_CODE, nextSupplierMode)
    }
  }

  useEffect(() => {
    if (showPlnView && services.length > 0 && !selectedService) {
      handlePlnTabSwitch(activePlnTab)
    }
  }, [showPlnView, services, selectedService, activePlnTab, handlePlnTabSwitch])

  useEffect(() => {
    if (services.length === 0) {
      return
    }

    const requestedService = normalizeText(new URLSearchParams(location.search).get('service'))
    if (!requestedService) {
      return
    }

    if (
      requestedService === PLN_PARENT_CODE
      || requestedService === PLN_TOKEN_CODE
      || requestedService === PLN_PASCABAYAR_CODE
    ) {
      const targetPlnTab = requestedService === PLN_PASCABAYAR_CODE
        ? PLN_PASCABAYAR_CODE
        : PLN_TOKEN_CODE

      setShowPlnView(true)
      setSelectedService(null)
      setProducts([])
      setSelectedProductCode('')
      setCustomerNumber('')
      setInquiryResult(null)
      setRequestError('')
      handlePlnTabSwitch(targetPlnTab)
      return
    }

    const targetService = services.find((item) => normalizeText(item?.code) === requestedService)
    if (!targetService || isEwalletService(targetService)) {
      return
    }

    setShowPlnView(false)
    setSupplierMode(SUPPLIER_MODE_AUTO)
    setActiveSuppliers([])
    setSelectedService(targetService)
    setProducts([])
    setSelectedProductCode('')
    setCustomerNumber('')
    setInquiryResult(null)
    setRequestError('')
    loadProducts(targetService.code)
  }, [handlePlnTabSwitch, loadProducts, location.search, services])

  const selectedProduct = useMemo(
    () => products.find((item) => item.product_code === selectedProductCode) || null,
    [products, selectedProductCode],
  )

  const payableAmount = useMemo(() => {
    if (isPostpaid) {
      return Number(inquiryResult?.bill?.total_amount ?? 0)
    }

    return Number(selectedProduct?.sell_price ?? 0)
  }, [inquiryResult?.bill?.total_amount, isPostpaid, selectedProduct?.sell_price])

  const hasValidCustomerNumber = Boolean(sanitizeCustomerNumber(customerNumber).length >= 4)
  const canCheckInquiry = isPostpaid && hasValidCustomerNumber && Boolean(selectedProductCode)
  const canPlaceOrder = Boolean(customerNumber && selectedProductCode)
    && (!isPostpaid || inquiryResult)
    && payableAmount > 0

  const handleCheckInquiry = async () => {
    if (!canCheckInquiry) {
      setRequestError('Lengkapi nomor pelanggan dan produk tagihan.')
      return
    }

    setIsCheckingInquiry(true)
    setRequestError('')

    try {
      const payload = await mitrakamiApi.createBillInquiry({
        serviceCode: selectedService.code,
        customerNumber,
        productCode: selectedProductCode,
      })

      setInquiryResult(payload)
    } catch (error) {
      const responseMessage = error?.response?.data?.message
      setRequestError(responseMessage || 'Gagal melakukan inquiry tagihan.')
      setInquiryResult(null)
    } finally {
      setIsCheckingInquiry(false)
    }
  }

  const handleCreateOrder = async () => {
    if (!canPlaceOrder) {
      setRequestError('Data transaksi belum lengkap.')
      return
    }

    setIsPlacingOrder(true)
    setRequestError('')

    try {
      const supplierCodeForOrder = selectedService?.code === PLN_TOKEN_CODE && supplierMode !== SUPPLIER_MODE_AUTO
        ? supplierMode
        : undefined

      const payload = await mitrakamiApi.createBillOrder({
        serviceCode: selectedService.code,
        customerNumber,
        productCode: selectedProductCode,
        supplierCode: supplierCodeForOrder,
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
      setRequestError(responseMessage || 'Gagal memproses pembayaran tagihan.')
    } finally {
      setIsPlacingOrder(false)
    }
  }

  const handleBack = () => {
    const activeServiceCode = normalizeText(selectedService?.code)
    const shouldBackToDashboard = showPlnView
      || activeServiceCode === PLN_TOKEN_CODE
      || activeServiceCode === PLN_PASCABAYAR_CODE
      || isInternetPascabayarService(selectedService)

    if (shouldBackToDashboard) {
      navigate('/app/home')
      return
    }

    if (selectedService && !showPlnView) {
      setSelectedService(null)
      setSupplierMode(SUPPLIER_MODE_AUTO)
      setActiveSuppliers([])
      setProducts([])
      setSelectedProductCode('')
      setCustomerNumber('')
      setInquiryResult(null)
      setRequestError('')
      return
    }

    if (showPlnView) {
      setShowPlnView(false)
      setSelectedService(null)
      setSupplierMode(SUPPLIER_MODE_AUTO)
      setActiveSuppliers([])
      setProducts([])
      setSelectedProductCode('')
      setCustomerNumber('')
      setInquiryResult(null)
      setRequestError('')
      return
    }

    navigate('/app/home')
  }

  const renderPlnTokenView = () => {
    const isPrepaidMode = selectedService?.transaction_mode === 'prepaid'
    if (!isPrepaidMode) return null

    return (
      <section className="space-y-4">
        <div className="rounded-3xl bg-white border border-black/5 shadow-soft p-4 space-y-3">
          <div>
            <label htmlFor="plnTokenCustomerNumber" className="text-sm font-semibold text-text-secondary block mb-2">
              No. Meter / ID Pelanggan
            </label>
            <div className="flex items-center gap-2">
              <input
                id="plnTokenCustomerNumber"
                type="text"
                value={customerNumber}
                onChange={(event) => {
                  setCustomerNumber(sanitizeCustomerNumber(event.target.value))
                  setInquiryResult(null)
                }}
                placeholder="No. Meter / ID Pelanggan"
                className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm"
                inputMode="numeric"
              />
              <div className="size-10 rounded-full bg-primary-soft text-primary grid place-items-center shrink-0">
                <AppIcon name="person" className="size-5" />
              </div>
            </div>
            {hasValidCustomerNumber && (
              <p className="text-xs text-emerald-600 mt-1.5 flex items-center gap-1">
                <AppIcon name="check_circle" className="size-4" />
                Token pln
              </p>
            )}
          </div>
        </div>

        <SupplierModeSelector
          supplierMode={supplierMode}
          suppliers={activeSuppliers}
          autoModeValue={SUPPLIER_MODE_AUTO}
          manualPlaceholder="Pilih server"
          onChange={handleSwitchSupplierMode}
          selectClassName="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
        />

        <div>
          <h2 className="text-sm font-semibold text-text-secondary mb-3">Isi Ulang</h2>

          {productsLoading && (
            <div className="grid grid-cols-3 gap-3">
              <div className="h-24 rounded-2xl bg-white animate-pulse" />
              <div className="h-24 rounded-2xl bg-white animate-pulse" />
              <div className="h-24 rounded-2xl bg-white animate-pulse" />
            </div>
          )}

          {!productsLoading && products.length === 0 && (
            <div className="rounded-2xl bg-white border border-black/5 p-5 text-center text-sm text-text-secondary">
              Produk token listrik belum tersedia.
            </div>
          )}

          {!productsLoading && products.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {products.map((product) => {
                const isSelected = selectedProductCode === product.product_code
                const isDisabled = !hasValidCustomerNumber || !product.is_active
                const isOutOfStock = product.stock <= 0
                const nominalLabel = formatNominalLabel(product.display_name)

                return (
                  <button
                    key={product.product_code}
                    type="button"
                    onClick={() => {
                      if (isDisabled || isOutOfStock) return

                      setSelectedProductCode(product.product_code)
                    }}
                    disabled={isDisabled || isOutOfStock}
                    className={`relative rounded-2xl border p-3 text-center transition bg-white ${isSelected ? 'border-primary ring-2 ring-primary/20 shadow-soft' : 'border-black/10'} ${isDisabled || isOutOfStock ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary/40'}`}
                  >
                    <p className="text-lg font-bold text-text-primary">{nominalLabel}</p>

                    {isOutOfStock && (
                      <p className="text-xs text-red-500 font-semibold mt-1">Habis</p>
                    )}

                    {!isOutOfStock && product.sell_price > 0 && (
                      <p className="text-xs text-text-secondary mt-1">
                        Bayar: {formatCurrency(product.sell_price)}
                      </p>
                    )}

                    {!isOutOfStock && product?.best_supplier?.name && (
                      <p className="text-[11px] text-text-secondary mt-1">
                        {supplierMode === SUPPLIER_MODE_AUTO ? 'Server termurah' : 'Server dipilih'}: {product.best_supplier.name}
                      </p>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {selectedProduct && hasValidCustomerNumber && (
          <div className="rounded-3xl bg-white border border-black/5 shadow-soft p-4 space-y-2">
            <h2 className="font-bold">Pembayaran</h2>
            <div className="flex items-center justify-between text-sm gap-3">
              <span className="text-text-secondary">Saldo Mitrakami</span>
              <span className="font-semibold">{formatCurrency(walletBalance)}</span>
            </div>
            <div className="flex items-center justify-between text-sm gap-3">
              <span className="text-text-secondary">Total bayar</span>
              <span className="font-semibold text-primary">{formatCurrency(payableAmount)}</span>
            </div>
            <button
              type="button"
              onClick={handleCreateOrder}
              disabled={!canPlaceOrder || isPlacingOrder}
              className="w-full rounded-2xl bg-primary text-white font-bold py-3 disabled:opacity-50 mt-1"
            >
              {isPlacingOrder ? 'Memproses...' : 'Bayar Sekarang'}
            </button>
          </div>
        )}
      </section>
    )
  }

  const renderPlnPascabayarView = () => {
    const isPostpaidMode = selectedService?.transaction_mode === 'postpaid'
    if (!isPostpaidMode) return null

    return (
      <section className="space-y-4">
        <div className="rounded-3xl bg-white border border-black/5 shadow-soft p-4 space-y-3">
          <div>
            <label htmlFor="plnPascaCustomerNumber" className="text-sm font-semibold text-text-secondary block mb-2">
              No. Meter / ID Pelanggan
            </label>
            <div className="flex items-center gap-2">
              <input
                id="plnPascaCustomerNumber"
                type="text"
                value={customerNumber}
                onChange={(event) => {
                  setCustomerNumber(sanitizeCustomerNumber(event.target.value))
                  setInquiryResult(null)
                }}
                placeholder="No. Meter / ID Pelanggan"
                className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm"
                inputMode="numeric"
              />
              <div className="size-10 rounded-full bg-primary-soft text-primary grid place-items-center shrink-0">
                <AppIcon name="person" className="size-5" />
              </div>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCheckInquiry}
          disabled={!canCheckInquiry || isCheckingInquiry}
          className="w-full rounded-2xl bg-gray-100 border border-black/5 text-text-primary font-semibold py-4 disabled:opacity-50"
        >
          {isCheckingInquiry ? 'Mengecek tagihan...' : 'Periksa Tagihan'}
        </button>

        {inquiryResult && (
          <>
            <div className="rounded-3xl bg-white border border-black/5 shadow-soft p-4 space-y-2">
              <h2 className="font-bold">Hasil Inquiry</h2>
              <div className="flex items-center justify-between text-sm gap-3">
                <span className="text-text-secondary">Nama pelanggan</span>
                <span className="font-semibold text-right">{inquiryResult.customer_name || '-'}</span>
              </div>
              <div className="flex items-center justify-between text-sm gap-3">
                <span className="text-text-secondary">Total tagihan</span>
                <span className="font-semibold text-right text-primary">
                  {formatCurrency(inquiryResult?.bill?.total_amount || 0)}
                </span>
              </div>
              <div className="flex items-start justify-between text-sm gap-3">
                <span className="text-text-secondary">Detail</span>
                <span className="font-semibold text-right max-w-[70%] wrap-break-word">
                  {inquiryResult?.bill?.desc || '-'}
                </span>
              </div>
            </div>

            <div className="rounded-3xl bg-white border border-black/5 shadow-soft p-4 space-y-2">
              <h2 className="font-bold">Pembayaran</h2>
              <div className="flex items-center justify-between text-sm gap-3">
                <span className="text-text-secondary">Saldo Mitrakami</span>
                <span className="font-semibold">{formatCurrency(walletBalance)}</span>
              </div>
              <div className="flex items-center justify-between text-sm gap-3">
                <span className="text-text-secondary">Total bayar</span>
                <span className="font-semibold text-primary">{formatCurrency(payableAmount)}</span>
              </div>
              <button
                type="button"
                onClick={handleCreateOrder}
                disabled={!canPlaceOrder || isPlacingOrder}
                className="w-full rounded-2xl bg-primary text-white font-bold py-3 disabled:opacity-50 mt-1"
              >
                {isPlacingOrder ? 'Memproses...' : 'Bayar Sekarang'}
              </button>
            </div>
          </>
        )}
      </section>
    )
  }

  const renderPlnView = () => {
    return (
      <section className="space-y-5">
        <div className="rounded-2xl bg-gray-200/70 p-1 grid grid-cols-2 gap-1">
          {PLN_TABS.map((tab) => {
            const isActive = activePlnTab === tab.key

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => handlePlnTabSwitch(tab.key)}
                className={`rounded-xl py-2.5 text-sm font-semibold transition ${isActive ? 'bg-white text-primary shadow-soft' : 'text-text-secondary'}`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        {activePlnTab === PLN_TOKEN_CODE && renderPlnTokenView()}
        {activePlnTab === PLN_PASCABAYAR_CODE && renderPlnPascabayarView()}
      </section>
    )
  }

  const renderGenericServiceView = () => {
    if (!selectedService || showPlnView) return null

    return (
      <section className="space-y-4 mb-6">
        <div className="rounded-3xl bg-white border border-black/5 shadow-soft p-4">
          <p className="text-xs uppercase tracking-wide text-text-secondary mb-1">Layanan</p>
          <p className="text-lg font-bold">{selectedService.name}</p>
          <p className="text-xs text-text-secondary mt-1">
            Mode: {isPostpaid ? 'Pascabayar (dengan inquiry)' : 'Prabayar'}
          </p>
        </div>

        <div className="rounded-3xl bg-white border border-black/5 shadow-soft p-4 space-y-3">
          <div>
            <label htmlFor="billCustomerNumber" className="text-sm font-semibold text-text-secondary block mb-2">
              Nomor pelanggan
            </label>
            <input
              id="billCustomerNumber"
              type="text"
              value={customerNumber}
              onChange={(event) => {
                setCustomerNumber(sanitizeCustomerNumber(event.target.value))
                setInquiryResult(null)
              }}
              placeholder="Masukkan nomor pelanggan"
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm"
            />
          </div>

          <div>
            <label htmlFor="billProduct" className="text-sm font-semibold text-text-secondary block mb-2">
              Produk
            </label>
            <select
              id="billProduct"
              value={selectedProductCode}
              onChange={(event) => {
                setSelectedProductCode(event.target.value)
                setInquiryResult(null)
              }}
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm"
              disabled={productsLoading || products.length === 0}
            >
              {products.length === 0 && <option value="">Produk tidak tersedia</option>}
              {products.map((product) => (
                <option key={product.product_code} value={product.product_code}>
                  {product.display_name}
                  {product.sell_price > 0 ? ` - ${formatCurrency(product.sell_price)}` : ''}
                </option>
              ))}
            </select>
          </div>

          {!isPostpaid && selectedProduct && (
            <div className="rounded-2xl bg-primary-soft text-primary p-3 text-sm">
              Nominal pembayaran: <span className="font-bold">{formatCurrency(selectedProduct.sell_price)}</span>
            </div>
          )}

          {isPostpaid && (
            <button
              type="button"
              onClick={handleCheckInquiry}
              disabled={!canCheckInquiry || isCheckingInquiry}
              className="w-full rounded-2xl border-2 border-primary text-primary font-bold py-3 disabled:opacity-50"
            >
              {isCheckingInquiry ? 'Mengecek tagihan...' : 'Cek Tagihan'}
            </button>
          )}
        </div>

        {isPostpaid && inquiryResult && (
          <div className="rounded-3xl bg-white border border-black/5 shadow-soft p-4 space-y-2">
            <h2 className="font-bold">Hasil Inquiry</h2>
            <div className="flex items-center justify-between text-sm gap-3">
              <span className="text-text-secondary">Nama pelanggan</span>
              <span className="font-semibold text-right">{inquiryResult.customer_name || '-'}</span>
            </div>
            <div className="flex items-center justify-between text-sm gap-3">
              <span className="text-text-secondary">Total tagihan</span>
              <span className="font-semibold text-right text-primary">
                {formatCurrency(inquiryResult?.bill?.total_amount || 0)}
              </span>
            </div>
            <div className="flex items-start justify-between text-sm gap-3">
              <span className="text-text-secondary">Detail</span>
              <span className="font-semibold text-right max-w-[70%] wrap-break-word">
                {inquiryResult?.bill?.desc || '-'}
              </span>
            </div>
          </div>
        )}

        <div className="rounded-3xl bg-white border border-black/5 shadow-soft p-4 space-y-2">
          <h2 className="font-bold">Pembayaran</h2>
          <div className="flex items-center justify-between text-sm gap-3">
            <span className="text-text-secondary">Saldo Mitrakami</span>
            <span className="font-semibold">{formatCurrency(walletBalance)}</span>
          </div>
          <div className="flex items-center justify-between text-sm gap-3">
            <span className="text-text-secondary">Total bayar</span>
            <span className="font-semibold text-primary">{formatCurrency(payableAmount)}</span>
          </div>
          <button
            type="button"
            onClick={handleCreateOrder}
            disabled={!canPlaceOrder || isPlacingOrder}
            className="w-full rounded-2xl bg-primary text-white font-bold py-3 disabled:opacity-50"
          >
            {isPlacingOrder ? 'Memproses...' : 'Bayar Sekarang'}
          </button>
        </div>
      </section>
    )
  }

  const headerTitle = showPlnView ? 'Listrik PLN' : 'Tagihan'

  return (
    <div className="min-h-screen bg-background-app text-text-primary">
      <div className="mx-auto w-full max-w-md min-h-screen bg-background-app relative overflow-hidden pb-28">
        <header className="bg-primary text-white px-6 pt-12 pb-5 sticky top-0 z-10 shadow-soft">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Kembali"
              onClick={handleBack}
              className="size-10 rounded-full bg-white/15 grid place-items-center"
            >
              <AppIcon name="arrow_back" className="size-5" />
            </button>

            <h1 className="text-xl font-bold tracking-tight">{headerTitle}</h1>
          </div>
        </header>

        <main className="px-6 py-5">
          {!selectedService && !showPlnView && (
            <div className="relative mb-5">
            <AppIcon
              name="search"
              className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
            />

            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Cari layanan tagihan..."
              className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white border border-black/5 shadow-soft text-sm placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            </div>
          )}

          {showPlnView && renderPlnView()}

          {selectedService && !showPlnView && renderGenericServiceView()}

          {requestError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 mb-5">
              {requestError}
            </div>
          )}

          {isLoading && !selectedService && !showPlnView && (
            <div className="grid grid-cols-3 gap-4">
              <div className="h-39 rounded-3xl bg-white animate-pulse" />
              <div className="h-39 rounded-3xl bg-white animate-pulse" />
              <div className="h-39 rounded-3xl bg-white animate-pulse" />
            </div>
          )}

          {!selectedService && !showPlnView && !isLoading && filteredServices.length === 0 && (
            <div className="rounded-2xl bg-white border border-black/5 p-5 text-center text-sm text-text-secondary">
              Layanan tagihan tidak ditemukan.
            </div>
          )}

          {!selectedService && !showPlnView && !isLoading && filteredServices.length > 0 && (
            <div className="grid grid-cols-3 gap-4">
              {filteredServices.map((service) => {
                const isMore = Boolean(service?.is_more)
                const isActive = Boolean(service?.is_active)

                if (isMore) {
                  return (
                    <button
                      key={service.code}
                      type="button"
                      onClick={() => handleServiceClick(service)}
                      className="group flex flex-col items-center justify-center rounded-3xl p-4 bg-gray-50 border-2 border-dashed border-black/10 min-h-39"
                    >
                      <div className="size-14 rounded-full grid place-items-center text-text-secondary mb-3">
                          <AppIcon name={service.icon || 'more_horiz'} className="size-7.5" />
                      </div>
                      <span className="text-sm font-medium text-text-secondary text-center">{service.name}</span>
                    </button>
                  )
                }

                return (
                  <button
                    key={service.code}
                    type="button"
                    disabled={!isActive}
                    onClick={() => handleServiceClick(service)}
                    className={`group flex flex-col items-center justify-center rounded-3xl p-4 bg-white border border-black/5 shadow-soft min-h-39 ${isActive ? 'hover:border-primary/30' : 'opacity-50 cursor-not-allowed'}`}
                  >
                    <div className="size-14 rounded-full bg-primary-soft text-primary grid place-items-center mb-3">
                      <AppIcon name={service.icon || 'receipt_long'} className="size-7.5" />
                    </div>
                    <span className="text-sm font-semibold text-center">{service.name}</span>
                  </button>
                )
              })}
            </div>
          )}
        </main>

        <MobileBottomNav currentTab="home" />
      </div>
    </div>
  )
}
