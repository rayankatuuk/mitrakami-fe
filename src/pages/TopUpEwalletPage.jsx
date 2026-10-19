import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CustomerNumberStoragePanel from '../components/CustomerNumberStoragePanel'
import MobileBottomNav from '../components/MobileBottomNav'
import { mitrakamiApi } from '../services/mitrakamiApi'
import { getAuthSession, updateAuthSession } from '../utils/authStorage'
import { isEwalletService } from '../utils/billServiceCategory'
import AppIcon from '../components/AppIcon'

const SAVED_NUMBER_SERVICE_KEY = 'ewallet'
const formatCurrency = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`
const sanitizeCustomerNumber = (value) => String(value || '').replace(/[^0-9A-Za-z]/g, '')
const normalizeText = (value) => String(value || '').toLowerCase().trim()

const WALLET_KEYWORDS = [
  { key: 'dana', label: 'DANA', aliases: ['dana'] },
  { key: 'ovo', label: 'OVO', aliases: ['ovo'] },
  { key: 'linkaja', label: 'LinkAja', aliases: ['linkaja', 'link aja'] },
  { key: 'gopay', label: 'GoPay', aliases: ['gopay', 'go pay'] },
  { key: 'shopeepay', label: 'ShopeePay', aliases: ['shopeepay', 'shopee pay'] },
]

const resolveWalletOption = (product) => {
  const brand = String(product?.brand || '').trim()
  if (brand && brand !== '-') {
    return {
      key: normalizeText(brand),
      label: brand,
    }
  }

  const haystack = normalizeText([
    product?.display_name,
    product?.description,
    product?.category,
    product?.product_code,
  ].join(' '))

  const matchedWallet = WALLET_KEYWORDS.find((wallet) => {
    return wallet.aliases.some((alias) => haystack.includes(alias))
  })

  if (matchedWallet) {
    return {
      key: matchedWallet.key,
      label: matchedWallet.label,
    }
  }

  return {
    key: 'lainnya',
    label: 'Lainnya',
  }
}

export default function TopUpEwalletPage() {
  const navigate = useNavigate()
  const [initLoading, setInitLoading] = useState(true)
  const [productsLoading, setProductsLoading] = useState(false)
  const [placingOrder, setPlacingOrder] = useState(false)
  const [requestError, setRequestError] = useState('')
  const [step, setStep] = useState('form')
  const [serviceCode, setServiceCode] = useState('')
  const [walletOptions, setWalletOptions] = useState([])
  const [selectedWalletKey, setSelectedWalletKey] = useState('')
  const [customerNumber, setCustomerNumber] = useState('')
  const [saveNumber, setSaveNumber] = useState(true)
  const [savedNumbers, setSavedNumbers] = useState([])
  const [allProducts, setAllProducts] = useState([])
  const [products, setProducts] = useState([])
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [walletBalance, setWalletBalance] = useState(() => Number(getAuthSession()?.walletBalance ?? 0))

  const selectedWalletLabel = useMemo(() => {
    return walletOptions.find((item) => item.key === selectedWalletKey)?.label || '-'
  }, [selectedWalletKey, walletOptions])

  const loadInit = useCallback(async () => {
    setInitLoading(true)
    setRequestError('')

    try {
      const payload = await mitrakamiApi.getBillServices()
      const ewalletServices = Array.isArray(payload?.services)
        ? payload.services.filter((service) => isEwalletService(service))
        : []

      const defaultServiceCode = String(ewalletServices[0]?.code || '').trim()
      setServiceCode(defaultServiceCode)

      if (defaultServiceCode) {
        const productPayload = await mitrakamiApi.getBillProducts({ serviceCode: defaultServiceCode })
        const nextProducts = Array.isArray(productPayload?.products) ? productPayload.products : []
        const savedNumberPayload = await mitrakamiApi.getSavedCustomerNumbers({ service: SAVED_NUMBER_SERVICE_KEY })
        const nextSavedNumbers = Array.isArray(savedNumberPayload?.saved_numbers) ? savedNumberPayload.saved_numbers : []

        setAllProducts(nextProducts)
        setSavedNumbers(nextSavedNumbers)

        const dynamicWalletOptions = nextProducts
          .map((product) => resolveWalletOption(product))
          .reduce((accumulator, option) => {
            if (accumulator.some((item) => item.key === option.key)) {
              return accumulator
            }

            return [...accumulator, option]
          }, [])

        setWalletOptions(dynamicWalletOptions)

        if (dynamicWalletOptions.length > 0) {
          setSelectedWalletKey(dynamicWalletOptions[0].key)
        }
      }
    } catch (error) {
      const responseMessage = error?.response?.data?.message
      setRequestError(responseMessage || 'Gagal memuat halaman top up e-wallet.')
    } finally {
      setInitLoading(false)
    }
  }, [])

  useEffect(() => {
    loadInit()
  }, [loadInit])

  const loadProducts = useCallback(async () => {
    if (!selectedWalletKey) {
      setRequestError('E-Wallet belum dipilih.')
      return
    }

    setProductsLoading(true)
    setRequestError('')

    try {
      const filteredProducts = allProducts.filter((item) => {
        const walletOption = resolveWalletOption(item)
        return walletOption.key === selectedWalletKey
      })

      setProducts(filteredProducts)
      setSelectedProduct(null)
      setStep('products')
    } finally {
      setProductsLoading(false)
    }
  }, [allProducts, selectedWalletKey])

  const handleProceedToProducts = async () => {
    const normalizedNumber = sanitizeCustomerNumber(customerNumber)

    if (!selectedWalletKey) {
      setRequestError('Silakan pilih E-Wallet terlebih dahulu.')
      return
    }

    if (!normalizedNumber || normalizedNumber.length < 4) {
      setRequestError('Nomor tujuan belum valid.')
      return
    }

    setCustomerNumber(normalizedNumber)
    await loadProducts()
  }

  const handleConfirmPayment = async () => {
    if (!serviceCode || !selectedProduct?.product_code) {
      setRequestError('Silakan pilih produk e-wallet terlebih dahulu.')
      return
    }

    setPlacingOrder(true)
    setRequestError('')

    try {
      const payload = await mitrakamiApi.createBillOrder({
        serviceCode,
        customerNumber: sanitizeCustomerNumber(customerNumber),
        productCode: selectedProduct.product_code,
      })

      if (saveNumber) {
        try {
          await mitrakamiApi.saveCustomerNumber({
            customerNumber: sanitizeCustomerNumber(customerNumber),
            operatorCode: selectedWalletKey,
            operatorName: selectedWalletLabel,
            label: selectedWalletLabel,
            service: SAVED_NUMBER_SERVICE_KEY,
          })
        } catch {
          // Do not block successful purchase flow if saving number fails.
        }
      }

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
      setRequestError(responseMessage || 'Gagal memproses top up e-wallet.')
    } finally {
      setPlacingOrder(false)
    }
  }

  const handleDeleteSavedNumber = async (savedNumberId) => {
    setRequestError('')

    try {
      const payload = await mitrakamiApi.deleteCustomerNumber({
        id: savedNumberId,
        service: SAVED_NUMBER_SERVICE_KEY,
      })

      setSavedNumbers(Array.isArray(payload?.saved_numbers) ? payload.saved_numbers : [])
    } catch (error) {
      const responseMessage = error?.response?.data?.message
      setRequestError(responseMessage || 'Gagal menghapus nomor pelanggan.')
    }
  }

  const handleChooseSavedNumber = (item) => {
    setCustomerNumber(sanitizeCustomerNumber(item?.customer_number || ''))

    if (item?.operator_code && walletOptions.some((wallet) => wallet.key === item.operator_code)) {
      setSelectedWalletKey(item.operator_code)
    }

    setRequestError('')
  }

  const handleSaveNumberOnly = async () => {
    const normalizedNumber = sanitizeCustomerNumber(customerNumber)

    if (!selectedWalletKey || normalizedNumber.length < 9) {
      setRequestError('Pilih E-Wallet dan isi nomor yang valid untuk menyimpan pelanggan.')
      return
    }

    try {
      const payload = await mitrakamiApi.saveCustomerNumber({
        customerNumber: normalizedNumber,
        operatorCode: selectedWalletKey,
        operatorName: selectedWalletLabel,
        label: selectedWalletLabel,
        service: SAVED_NUMBER_SERVICE_KEY,
      })

      setSavedNumbers(Array.isArray(payload?.saved_numbers) ? payload.saved_numbers : [])
      setRequestError('')
    } catch (error) {
      const responseMessage = error?.response?.data?.message
      setRequestError(responseMessage || 'Gagal menyimpan nomor pelanggan.')
    }
  }

  const renderHeader = () => {
    return (
      <header className="px-6 pt-12 pb-4 rounded-b-4xl bg-primary text-white sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-4">
          <button
            type="button"
            onClick={() => {
              if (step === 'payment') {
                setStep('products')
                return
              }

              if (step === 'products') {
                setStep('form')
                return
              }

              navigate('/app/home')
            }}
            className="size-10 rounded-full bg-white/15 grid place-items-center"
            aria-label="Kembali"
          >
            <AppIcon name="arrow_back_ios_new" className="size-5" />
          </button>

          <div>
            <h1 className="text-xl font-bold">Top Up E-Wallet</h1>
            <p className="text-xs text-white/80">Pilih E-Wallet dan isi nomor yang valid untuk top up.</p>
          </div>
        </div>

      </header>
    )
  }

  const renderFormStep = () => {
    return (
      <section className="px-6 py-5 space-y-5">
        <div className="rounded-3xl bg-white border border-black/5 shadow-soft p-5 space-y-4">
          <div>
            <label htmlFor="ewalletOperator" className="text-sm font-semibold text-text-secondary block mb-2">E-Wallet</label>
            <select
              id="ewalletOperator"
              value={selectedWalletKey}
              onChange={(event) => setSelectedWalletKey(event.target.value)}
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm"
              disabled={walletOptions.length === 0}
            >
              {walletOptions.length === 0 && <option value="">E-Wallet belum tersedia</option>}
              {walletOptions.map((item) => (
                <option key={item.key} value={item.key}>{item.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="ewalletCustomerNumber" className="text-sm font-semibold text-text-secondary block mb-2">
              Nomor E-Wallet
            </label>
            <input
              id="ewalletCustomerNumber"
              value={customerNumber}
              onChange={(event) => setCustomerNumber(sanitizeCustomerNumber(event.target.value))}
              placeholder="08xxxxxxxxxx"
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-lg font-semibold"
              inputMode="numeric"
            />
            <p className="text-xs text-text-secondary mt-2">Masukkan nomor pelanggan untuk top up e-wallet.</p>
          </div>

          <CustomerNumberStoragePanel
            saveNumber={saveNumber}
            onSaveNumberChange={setSaveNumber}
            onSaveNow={handleSaveNumberOnly}
            savedNumbers={savedNumbers}
            onChooseSavedNumber={handleChooseSavedNumber}
            onDeleteSavedNumber={handleDeleteSavedNumber}
            getSecondaryLabel={(item) => item?.operator_name || selectedWalletLabel}
          />
        </div>

        <button
          type="button"
          onClick={handleProceedToProducts}
          disabled={productsLoading || walletOptions.length === 0}
          className="w-full rounded-2xl bg-primary text-white font-bold py-4 disabled:opacity-60"
        >
          {productsLoading ? 'Memuat produk...' : 'Lanjut pilih produk'}
        </button>
      </section>
    )
  }

  const renderProductStep = () => {
    return (
      <section className="px-6 py-5 space-y-5">
        <div className="rounded-3xl bg-white border border-black/5 p-4">
          <p className="text-xs uppercase tracking-wide text-text-secondary mb-1">Nomor tujuan</p>
          <p className="text-xl font-bold">{customerNumber || '-'}</p>
          <p className="text-sm text-text-secondary mt-1">{selectedWalletLabel}</p>
        </div>

        {productsLoading && (
          <div className="space-y-3">
            <div className="h-24 rounded-2xl bg-white animate-pulse" />
            <div className="h-24 rounded-2xl bg-white animate-pulse" />
          </div>
        )}

        {!productsLoading && products.length === 0 && (
          <div className="rounded-2xl bg-white border border-black/5 p-5 text-center text-sm text-text-secondary">
            Produk belum tersedia untuk E-Wallet ini.
          </div>
        )}

        {!productsLoading && products.length > 0 && (
          <div className="space-y-3">
            {products.map((item) => {
              const isSelected = selectedProduct?.product_code === item.product_code
              const isDisabled = !item.is_active || item.is_out_of_stock

              return (
                <button
                  key={item.product_code}
                  type="button"
                  onClick={() => {
                    if (isDisabled) {
                      return
                    }

                    setSelectedProduct(item)
                    setStep('payment')
                  }}
                  disabled={isDisabled}
                  className={`w-full rounded-2xl border p-4 text-left bg-white transition ${isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-black/10'} ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary/60'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold">{item.display_name}</p>
                      <p className="text-sm text-text-secondary">{item.description || '-'}</p>
                    </div>

                    <span className="text-lg font-bold text-primary">{formatCurrency(item.sell_price)}</span>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-text-secondary">Supplier termurah: {item?.best_supplier?.name || '-'}</span>

                    {item.is_out_of_stock && (
                      <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-700 font-semibold">Habis</span>
                    )}

                    {!item.is_out_of_stock && !item.is_active && (
                      <span className="px-2 py-1 rounded-full bg-gray-200 text-gray-600 font-semibold">Nonaktif</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </section>
    )
  }

  const renderPaymentStep = () => {
    return (
      <section className="px-6 py-5 space-y-5">
        <div className="rounded-3xl bg-white border border-black/5 p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-text-secondary">Nomor tujuan</p>
              <p className="text-lg font-bold">{customerNumber}</p>
              <p className="text-sm text-text-secondary">{selectedWalletLabel}</p>
            </div>

            <button
              type="button"
              onClick={() => setStep('products')}
              className="text-sm font-semibold text-primary"
            >
              Ubah
            </button>
          </div>

          <div className="border-t border-black/5 pt-3">
            <p className="text-sm font-semibold">{selectedProduct?.display_name}</p>
            <p className="text-sm text-text-secondary">{selectedProduct?.description || '-'}</p>
            <p className="text-2xl font-bold mt-2 text-primary">{formatCurrency(selectedProduct?.sell_price || 0)}</p>
          </div>
        </div>

        <div className="rounded-3xl bg-white border border-black/5 p-5 space-y-3">
          <h2 className="font-bold">Pembayaran</h2>

          <div className="flex items-center justify-between">
            <span className="text-sm text-text-secondary">Metode</span>
            <span className="text-sm font-semibold">Saldo Mitrakami</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-text-secondary">Saldo tersedia</span>
            <span className="text-sm font-semibold">{formatCurrency(walletBalance)}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-text-secondary">Total bayar</span>
            <span className="text-sm font-semibold text-primary">{formatCurrency(selectedProduct?.sell_price || 0)}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleConfirmPayment}
          disabled={placingOrder}
          className="w-full rounded-2xl bg-primary text-white font-bold py-4 disabled:opacity-60"
        >
          {placingOrder ? 'Memproses...' : 'Bayar sekarang'}
        </button>
      </section>
    )
  }

  return (
    <div className="min-h-screen bg-background-app text-text-primary">
      <div className="mx-auto w-full max-w-md min-h-screen bg-background-app relative overflow-hidden pb-28">
        {renderHeader()}

        {requestError && (
          <div className="px-6 pt-4">
            <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
              {requestError}
            </div>
          </div>
        )}

        {initLoading && (
          <div className="px-6 py-6 space-y-3">
            <div className="h-24 rounded-2xl bg-white animate-pulse" />
            <div className="h-24 rounded-2xl bg-white animate-pulse" />
            <div className="h-12 rounded-2xl bg-white animate-pulse" />
          </div>
        )}

        {!initLoading && step === 'form' && renderFormStep()}
        {!initLoading && step === 'products' && renderProductStep()}
        {!initLoading && step === 'payment' && renderPaymentStep()}

        <MobileBottomNav currentTab="home" />
      </div>
    </div>
  )
}
