import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MobileBottomNav from '../components/MobileBottomNav'
import CustomerNumberStoragePanel from '../components/CustomerNumberStoragePanel'
import SupplierModeSelector from '../components/SupplierModeSelector'
import { mitrakamiApi } from '../services/mitrakamiApi'
import { getAuthSession, updateAuthSession } from '../utils/authStorage'
import { classifyPulsaPrepaidProduct } from '../utils/prepaidProductGrouping'
import AppIcon from '../components/AppIcon'

const PRODUCT_TYPE_OPTIONS = [
  { key: 'pulsa', label: 'Pulsa' },
  { key: 'data', label: 'Paket Data' },
]

const SUPPLIER_MODE_AUTO = 'auto'

const formatCurrency = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`

const sanitizePhoneNumber = (value) => String(value || '').replace(/[^0-9]/g, '')

const formatPhonePreview = (value) => {
  const digits = sanitizePhoneNumber(value)
  if (digits.length <= 4) {
    return digits
  }

  return digits.replace(/(\d{4})(\d{1,4})?(\d{1,4})?/, (_, a, b, c) => [a, b, c].filter(Boolean).join(' '))
}

const filterPulsaPageProducts = (items, activeProductType) => {
  if (activeProductType === 'pulsa') {
    return items.filter((item) => classifyPulsaPrepaidProduct(item) === 'pulsa')
  }

  return items
}

const resolveDefaultOperatorCode = (items) => {
  const operators = Array.isArray(items) ? items : []
  const preferred = operators.find((item) => {
    const name = String(item?.name || '').toLowerCase()
    const code = String(item?.code || '').toLowerCase()

    return name.includes('telkomsel') || code.includes('telkomsel')
  })

  return preferred?.code || operators[0]?.code || ''
}

export default function PulsaPage() {
  const navigate = useNavigate()
  const [initLoading, setInitLoading] = useState(true)
  const [productsLoading, setProductsLoading] = useState(false)
  const [placingOrder, setPlacingOrder] = useState(false)
  const [requestError, setRequestError] = useState('')
  const [step, setStep] = useState('form')
  const [operators, setOperators] = useState([])
  const [savedNumbers, setSavedNumbers] = useState([])
  const [selectedOperatorCode, setSelectedOperatorCode] = useState('')
  const [customerNumber, setCustomerNumber] = useState('')
  const [saveNumber, setSaveNumber] = useState(true)
  const [productType, setProductType] = useState('pulsa')
  const [supplierMode, setSupplierMode] = useState(SUPPLIER_MODE_AUTO)
  const [activeSuppliers, setActiveSuppliers] = useState([])
  const [products, setProducts] = useState([])
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [walletBalance, setWalletBalance] = useState(() => Number(getAuthSession()?.walletBalance ?? 0))

  const operatorByCode = useMemo(() => {
    return operators.reduce((accumulator, item) => {
      accumulator[item.code] = item
      return accumulator
    }, {})
  }, [operators])

  const selectedOperator = selectedOperatorCode ? operatorByCode[selectedOperatorCode] : null

  const loadInit = useCallback(async () => {
    setInitLoading(true)
    setRequestError('')

    try {
      const payload = await mitrakamiApi.getPulsaInit()
      const nextOperators = Array.isArray(payload?.operators) ? payload.operators : []
      const nextSavedNumbers = Array.isArray(payload?.saved_numbers) ? payload.saved_numbers : []

      setOperators(nextOperators)
      setSavedNumbers(nextSavedNumbers)
      setWalletBalance(Number(payload?.wallet_balance ?? 0))

      if (nextOperators.length > 0 && !selectedOperatorCode) {
        setSelectedOperatorCode(resolveDefaultOperatorCode(nextOperators))
      }
    } catch (error) {
      const responseMessage = error?.response?.data?.message
      setRequestError(responseMessage || 'Gagal memuat halaman pulsa.')
    } finally {
      setInitLoading(false)
    }
  }, [selectedOperatorCode])

  useEffect(() => {
    loadInit()
  }, [loadInit])

  const loadProducts = useCallback(async () => {
    if (!selectedOperatorCode) {
      setRequestError('Operator belum dipilih.')
      return
    }

    setProductsLoading(true)
    setRequestError('')

    try {
      const payload = await mitrakamiApi.getPulsaProducts({
        operatorCode: selectedOperatorCode,
        productType,
        supplierCode: supplierMode === SUPPLIER_MODE_AUTO ? undefined : supplierMode,
      })

      const nextProducts = Array.isArray(payload?.products) ? payload.products : []
      setActiveSuppliers(Array.isArray(payload?.meta?.suppliers) ? payload.meta.suppliers : [])
      setProducts(filterPulsaPageProducts(nextProducts, productType))
      setSelectedProduct(null)
      setStep('products')
    } catch (error) {
      const responseMessage = error?.response?.data?.message
      setRequestError(responseMessage || 'Gagal memuat varian produk.')
    } finally {
      setProductsLoading(false)
    }
  }, [productType, selectedOperatorCode, supplierMode])

  const handleProceedToProducts = async () => {
    const normalizedNumber = sanitizePhoneNumber(customerNumber)

    if (!selectedOperatorCode) {
      setRequestError('Silakan pilih operator terlebih dahulu.')
      return
    }

    if (!normalizedNumber || normalizedNumber.length < 9) {
      setRequestError('Nomor handphone belum valid.')
      return
    }

    setCustomerNumber(normalizedNumber)
    await loadProducts()
  }

  const handleDeleteSavedNumber = async (savedNumberId) => {
    setRequestError('')

    try {
      const payload = await mitrakamiApi.deletePulsaCustomerNumber({ id: savedNumberId })
      setSavedNumbers(Array.isArray(payload?.saved_numbers) ? payload.saved_numbers : [])
    } catch (error) {
      const responseMessage = error?.response?.data?.message
      setRequestError(responseMessage || 'Gagal menghapus nomor pelanggan.')
    }
  }

  const handleChooseSavedNumber = (item) => {
    setCustomerNumber(sanitizePhoneNumber(item?.customer_number || ''))

    if (item?.operator_code && operatorByCode[item.operator_code]) {
      setSelectedOperatorCode(item.operator_code)
    }

    setRequestError('')
  }

  const handleSwitchProductType = async (nextType) => {
    if (productType === nextType) {
      return
    }

    setProductType(nextType)
    setSelectedProduct(null)
    setProducts([])

    if (step === 'products' || step === 'payment') {
      setStep('products')
      setProductsLoading(true)

      try {
        const payload = await mitrakamiApi.getPulsaProducts({
          operatorCode: selectedOperatorCode,
          productType: nextType,
          supplierCode: supplierMode === SUPPLIER_MODE_AUTO ? undefined : supplierMode,
        })

        const nextProducts = Array.isArray(payload?.products) ? payload.products : []
        setActiveSuppliers(Array.isArray(payload?.meta?.suppliers) ? payload.meta.suppliers : [])
        setProducts(filterPulsaPageProducts(nextProducts, nextType))
      } catch (error) {
        const responseMessage = error?.response?.data?.message
        setRequestError(responseMessage || 'Gagal memuat varian produk.')
      } finally {
        setProductsLoading(false)
      }
    }
  }

  const handleSwitchSupplierMode = async (nextSupplierMode) => {
    if (supplierMode === nextSupplierMode) {
      return
    }

    setSupplierMode(nextSupplierMode)
    setSelectedProduct(null)
    setProducts([])

    if (step === 'products' || step === 'payment') {
      setStep('products')
      setProductsLoading(true)

      try {
        const payload = await mitrakamiApi.getPulsaProducts({
          operatorCode: selectedOperatorCode,
          productType,
          supplierCode: nextSupplierMode === SUPPLIER_MODE_AUTO ? undefined : nextSupplierMode,
        })

        const nextProducts = Array.isArray(payload?.products) ? payload.products : []
        setActiveSuppliers(Array.isArray(payload?.meta?.suppliers) ? payload.meta.suppliers : [])
        setProducts(filterPulsaPageProducts(nextProducts, productType))
      } catch (error) {
        const responseMessage = error?.response?.data?.message
        setRequestError(responseMessage || 'Gagal memuat varian produk.')
      } finally {
        setProductsLoading(false)
      }
    }
  }

  const handleSaveNumberOnly = async () => {
    const normalizedNumber = sanitizePhoneNumber(customerNumber)

    if (!selectedOperatorCode || normalizedNumber.length < 9) {
      setRequestError('Pilih operator dan isi nomor yang valid untuk menyimpan pelanggan.')
      return
    }

    try {
      const payload = await mitrakamiApi.savePulsaCustomerNumber({
        customerNumber: normalizedNumber,
        operatorCode: selectedOperatorCode,
        operatorName: selectedOperator?.name,
        label: selectedOperator?.name,
      })

      setSavedNumbers(Array.isArray(payload?.saved_numbers) ? payload.saved_numbers : [])
      setRequestError('')
    } catch (error) {
      const responseMessage = error?.response?.data?.message
      setRequestError(responseMessage || 'Gagal menyimpan nomor pelanggan.')
    }
  }

  const handleConfirmPayment = async () => {
    if (!selectedProduct) {
      setRequestError('Silakan pilih produk terlebih dahulu.')
      return
    }

    setPlacingOrder(true)
    setRequestError('')

    try {
      const payload = await mitrakamiApi.createPulsaOrder({
        operatorCode: selectedOperatorCode,
        customerNumber: sanitizePhoneNumber(customerNumber),
        productType,
        productCode: selectedProduct.product_code,
        supplierCode: selectedProduct?.selected_supplier_code || undefined,
        saveNumber,
      })

      const nextBalance = Number(payload?.wallet_balance ?? walletBalance)
      setWalletBalance(nextBalance)

      const latestSession = getAuthSession() ?? {}
      updateAuthSession({
        ...latestSession,
        walletBalance: nextBalance,
      })

      if (Array.isArray(payload?.saved_numbers)) {
        setSavedNumbers(payload.saved_numbers)
      }

      navigate('/app/history', { replace: true })
    } catch (error) {
      const responseMessage = error?.response?.data?.message
      setRequestError(responseMessage || 'Gagal memproses pembelian pulsa.')
    } finally {
      setPlacingOrder(false)
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
            <h1 className="text-xl font-bold">Pulsa & Paket Data</h1>
            <p className="text-xs text-white/80">Pilih paket telepon dan masa aktif yang sesuai dengan kebutuhan Anda.</p>
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
            <label htmlFor="operator" className="text-sm font-semibold text-text-secondary block mb-2">Operator</label>
            <select
              id="operator"
              value={selectedOperatorCode}
              onChange={(event) => setSelectedOperatorCode(event.target.value)}
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm"
            >
              {operators.map((item) => (
                <option key={item.code} value={item.code}>{item.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="customerNumber" className="text-sm font-semibold text-text-secondary block mb-2">Nomor Handphone</label>
            <input
              id="customerNumber"
              value={customerNumber}
              onChange={(event) => setCustomerNumber(sanitizePhoneNumber(event.target.value))}
              placeholder="08xxxxxxxxxx"
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-lg font-semibold"
              inputMode="numeric"
            />
            <p className="text-xs text-text-secondary mt-2">Masukkan nomor pelanggan untuk pembelian pulsa/data.</p>
          </div>

          <CustomerNumberStoragePanel
            saveNumber={saveNumber}
            onSaveNumberChange={setSaveNumber}
            onSaveNow={handleSaveNumberOnly}
            savedNumbers={savedNumbers}
            onChooseSavedNumber={handleChooseSavedNumber}
            onDeleteSavedNumber={handleDeleteSavedNumber}
            formatCustomerNumber={formatPhonePreview}
          />
        </div>

        <button
          type="button"
          onClick={handleProceedToProducts}
          disabled={productsLoading}
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
          <p className="text-xl font-bold">{formatPhonePreview(customerNumber)}</p>
          <p className="text-sm text-text-secondary mt-1">{selectedOperator?.name || '-'}</p>
        </div>

        <div className="rounded-2xl bg-gray-200/70 p-1 grid grid-cols-2 gap-1">
          {PRODUCT_TYPE_OPTIONS.map((option) => {
            const isActive = option.key === productType

            return (
              <button
                key={option.key}
                type="button"
                onClick={() => handleSwitchProductType(option.key)}
                className={`rounded-xl py-2.5 text-sm font-semibold ${isActive ? 'bg-white text-text-primary shadow-soft' : 'text-text-secondary'}`}
              >
                {option.label}
              </button>
            )
          })}
        </div>

        <SupplierModeSelector
          supplierMode={supplierMode}
          suppliers={activeSuppliers}
          autoModeValue={SUPPLIER_MODE_AUTO}
          manualPlaceholder="Pilih server"
          onChange={handleSwitchSupplierMode}
          selectClassName="w-full rounded-xl border border-black/10 bg-white px-3 py-1.5 text-xs"
        />

        {productsLoading && (
          <div className="space-y-3">
            <div className="h-24 rounded-2xl bg-white animate-pulse" />
            <div className="h-24 rounded-2xl bg-white animate-pulse" />
          </div>
        )}

        {!productsLoading && products.length === 0 && (
          <div className="rounded-2xl bg-white border border-black/5 p-5 text-center text-sm text-text-secondary">
            Produk belum tersedia untuk operator ini.
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
                      <p className="text-sm text-text-secondary">{item.display_name || '-'}</p>
                    </div>

                    <span className="text-lg font-bold text-primary">{formatCurrency(item.sell_price)}</span>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-text-secondary">
                      {supplierMode === SUPPLIER_MODE_AUTO ? 'Server termurah: ' : 'Server dipilih: '}
                      {item?.best_supplier?.name || '-'}
                    </span>

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
              <p className="text-lg font-bold">{formatPhonePreview(customerNumber)}</p>
              <p className="text-sm text-text-secondary">{selectedOperator?.name || '-'}</p>
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
            <p className="text-xs text-text-secondary mt-1">Server: {selectedProduct?.best_supplier?.name || '-'}</p>
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
