import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getAuthSession } from '../utils/authStorage'
import { mitrakamiApi } from '../services/mitrakamiApi'
import {
  TOPUP_PAYMENT_INSTRUCTIONS,
  TOPUP_TRANSFER_TYPE_LABEL,
} from '../constants/topup'
import {
  normalizeTopUpHistoryTransaction,
  TOPUP_STATUSES,
} from '../utils/topupHistoryMapper'
import AppIcon from '../components/AppIcon'

const HOME_ROUTE = '/app/home'

const formatCurrency = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`

const splitBankNameParts = (value) => String(value || '')
  .split(/\s*[—-]\s*/)
  .map((part) => part.trim())
  .filter(Boolean)

const normalizeBankName = (value) => {
  const parts = splitBankNameParts(value)
  if (parts.length <= 1) {
    return String(value || '').trim()
  }

  const bankPart = parts.find((part) => /\bbank\b/i.test(part))
  if (bankPart) {
    return bankPart
  }

  return [...parts].sort((a, b) => b.length - a.length)[0] || String(value || '').trim()
}

const normalizeBankCode = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/\s+/g, '-')

const formatReferenceTime = (value) =>
  new Date(value).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

const formatCountdown = (targetDate) => {
  const diffMs = Math.max(new Date(targetDate).getTime() - Date.now(), 0)
  const totalSec = Math.floor(diffMs / 1000)
  const hours = String(Math.floor(totalSec / 3600)).padStart(2, '0')
  const minutes = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0')
  const seconds = String(totalSec % 60).padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}

export default function TopUpSaldoPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const authSession = useMemo(() => getAuthSession() ?? {}, [])
  const historyTopUp = useMemo(
    () => normalizeTopUpHistoryTransaction(location.state?.transaction),
    [location.state?.transaction],
  )
  const historySourceRoute = location.state?.from || HOME_ROUTE

  const [step, setStep] = useState(1)
  const [amountInput, setAmountInput] = useState('')
  const [amountError, setAmountError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [isLoadingActive, setIsLoadingActive] = useState(true)
  const [requestError, setRequestError] = useState('')
  const [infoMessage, setInfoMessage] = useState('')
  const [pendingOrder, setPendingOrder] = useState(null)
  const [countdown, setCountdown] = useState('')
  const [topUpConfig, setTopUpConfig] = useState({
    minAmount: null,
    expiryHours: null,
  })
  const [bankInfo, setBankInfo] = useState(null)

  const displayName = authSession?.memberName || authSession?.memberId || 'Member Prime'
  const currentBalance = Number(authSession?.walletBalance ?? 0)

  const parsedAmount = Number(amountInput || 0)
  const minAmount = Number(topUpConfig?.minAmount || 0)

  const quickAmounts = useMemo(() => {
    if (!minAmount) return []

    const values = [minAmount, minAmount * 5, minAmount * 10, minAmount * 50]
    return [...new Set(values)].sort((a, b) => a - b)
  }, [minAmount])

  const mapOrder = useCallback((order) => {
    if (!order?.reference) return null

    return {
      reference: order.reference,
      status: order.status ?? 'pending',
      amount: Number(order.amount ?? 0),
      uniqueCode: Number(order.uniqueCode ?? 0),
      totalAmount: Number(order.totalAmount ?? order.amount ?? 0),
      expiresAt: order.expiresAt ?? null,
      createdAt: order.createdAt ?? new Date().toISOString(),
      failedReason: order.failedReason ?? null,
    }
  }, [])

  const applyServerPayload = useCallback((payload) => {
    if (payload?.config) {
      setTopUpConfig({
        minAmount: Number(payload.config.minAmount ?? 0),
        expiryHours: Number(payload.config.expiryHours ?? 0),
      })
    }

    const resolvedBank = payload?.active?.bank ?? payload?.bank ?? payload?.order?.bank ?? null
    if (resolvedBank) {
      const normalizedName = normalizeBankName(resolvedBank.name)
      const derivedCode = normalizeBankCode(resolvedBank.code)
        || normalizeBankCode(normalizedName)

      setBankInfo({
        code: derivedCode || null,
        name: normalizedName || '-',
        accountName: resolvedBank.account_name ?? resolvedBank.accountName ?? '-',
        accountNumber: resolvedBank.account_number ?? resolvedBank.accountNumber ?? '-',
      })
    }

    const nextOrder = mapOrder(payload?.active ?? payload)
    if (nextOrder) {
      setPendingOrder(nextOrder)
      setStep(3)
      return true
    }

    setPendingOrder(null)
    return false
  }, [mapOrder])

  const fetchActiveTopUp = useCallback(async (silent = false) => {
    if (!silent) {
      setIsLoadingActive(true)
    }

    try {
      const response = await mitrakamiApi.getActiveTopUp()
      const hasActive = applyServerPayload(response)

      if (!hasActive && !silent) {
        setStep(1)
      }
    } catch (error) {
      if (!silent) {
        const responseMessage = error?.response?.data?.message
        setRequestError(responseMessage || 'Gagal memuat status top up aktif.')
      }
    } finally {
      if (!silent) {
        setIsLoadingActive(false)
      }
    }
  }, [applyServerPayload])

  useEffect(() => {
    if (!pendingOrder?.expiresAt || step !== 3) return undefined

    const updateCountdown = () => {
      const nextCountdown = formatCountdown(pendingOrder.expiresAt)
      setCountdown(nextCountdown)

      if (nextCountdown === '00:00:00') {
        fetchActiveTopUp(true)
      }
    }

    updateCountdown()

    const timer = setInterval(() => {
      updateCountdown()
    }, 1000)

    return () => clearInterval(timer)
  }, [pendingOrder?.expiresAt, step, fetchActiveTopUp])

  const handleChooseQuickAmount = (amount) => {
    setAmountInput(String(amount))
    setAmountError('')
  }

  const handleContinueFromBank = () => {
    setStep(2)
    setAmountError('')
    setRequestError('')
    setInfoMessage('')
  }

  const handleCreateOrder = async () => {
    setAmountError('')
    setRequestError('')
    setInfoMessage('')

    if (!minAmount) {
      setAmountError('Konfigurasi top up belum tersedia. Coba lagi beberapa saat.')
      return
    }

    if (!bankInfo?.code) {
      setAmountError('Data tujuan bank belum tersedia. Coba lagi beberapa saat.')
      return
    }

    if (!parsedAmount || Number.isNaN(parsedAmount)) {
      setAmountError('Nominal top up wajib diisi.')
      return
    }

    if (parsedAmount < minAmount) {
      setAmountError(`Minimal top up ${formatCurrency(minAmount)}.`)
      return
    }

    try {
      setIsSubmitting(true)
      const response = await mitrakamiApi.createTopUpOrder({
        amount: parsedAmount,
        bankCode: bankInfo.code,
      })

      applyServerPayload(response)
    } catch (error) {
      if (error?.response?.status === 409 && error?.response?.data?.active) {
        applyServerPayload(error.response.data)
        setInfoMessage(error.response.data?.message || 'Top up aktif ditemukan dan ditampilkan kembali.')
        return
      }

      const responseMessage = error?.response?.data?.message
      setRequestError(responseMessage || 'Gagal membuat instruksi top up. Silakan coba lagi.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancelActiveTopUp = async () => {
    setRequestError('')
    setInfoMessage('')

    try {
      setIsCancelling(true)
      const response = await mitrakamiApi.cancelActiveTopUp()

      setPendingOrder(null)
      setStep(2)
      setInfoMessage(response?.message || 'Top up aktif berhasil dibatalkan.')
      await fetchActiveTopUp(true)
    } catch (error) {
      const responseMessage = error?.response?.data?.message
      setRequestError(responseMessage || 'Gagal membatalkan top up aktif.')
    } finally {
      setIsCancelling(false)
    }
  }

  const handleCopyAccountNumber = async () => {
    if (!bankInfo?.accountNumber) return

    try {
      await navigator.clipboard.writeText(bankInfo.accountNumber)
    } catch {
      // Ignore clipboard errors silently
    }
  }

  const bankLabel = useMemo(() => {
    const name = normalizeBankName(bankInfo?.name)
    if (name) {
      return name.replace(/^bank\s+/i, '').toUpperCase()
    }

    const fromCode = String(bankInfo?.code || '').trim()
    if (fromCode) {
      return fromCode.toUpperCase()
    }

    return '-'
  }, [bankInfo?.code, bankInfo?.name])

  const bankDisplayName = useMemo(() => normalizeBankName(bankInfo?.name) || '-', [bankInfo?.name])

  const isPendingHistoryTopUp = useMemo(() => {
    if (!historyTopUp) return false

    return historyTopUp.status !== TOPUP_STATUSES.success && historyTopUp.status !== TOPUP_STATUSES.failed
  }, [historyTopUp])

  const applyHistoryPendingTopUp = useCallback(() => {
    if (!isPendingHistoryTopUp || !historyTopUp?.reference) {
      return false
    }

    const historyBankCode = normalizeBankCode(historyTopUp.bankCode)
      || normalizeBankCode(historyTopUp.bankName)

    setBankInfo({
      code: historyBankCode || null,
      name: normalizeBankName(historyTopUp.bankName) || '-',
      accountName: historyTopUp.accountName || '-',
      accountNumber: historyTopUp.accountNumber || '-',
    })

    const mappedHistoryOrder = mapOrder({
      reference: historyTopUp.reference,
      status: historyTopUp.status,
      amount: historyTopUp.amount,
      uniqueCode: historyTopUp.uniqueCode,
      totalAmount: historyTopUp.totalAmount,
      expiresAt: historyTopUp.expiresAt,
      createdAt: historyTopUp.createdAt,
      failedReason: historyTopUp.failedReason,
    })

    if (!mappedHistoryOrder) {
      return false
    }

    setPendingOrder(mappedHistoryOrder)
    setStep(3)
    setIsLoadingActive(false)
    setAmountError('')
    setRequestError('')
    setInfoMessage('')

    return true
  }, [historyTopUp, isPendingHistoryTopUp, mapOrder])

  useEffect(() => {
    const isAppliedFromHistory = applyHistoryPendingTopUp()
    if (isAppliedFromHistory) {
      return
    }

    fetchActiveTopUp()
  }, [applyHistoryPendingTopUp, fetchActiveTopUp])

  const handleHeaderBack = useCallback(() => {
    if (isPendingHistoryTopUp) {
      navigate(historySourceRoute, { replace: true })
      return
    }

    if (step === 3 || step === 1) {
      navigate(HOME_ROUTE, { replace: true })
      return
    }

    setStep((prev) => Math.max(prev - 1, 1))
  }, [historySourceRoute, isPendingHistoryTopUp, navigate, step])

  if (isLoadingActive) {
    return (
      <div className="min-h-screen bg-background-app text-text-primary">
        <div className="mx-auto w-full max-w-md min-h-screen bg-background-app relative overflow-hidden">
          <div className="px-5 pt-14">
            <div className="rounded-2xl border border-black/5 bg-white p-4 text-sm text-text-secondary shadow-soft">
              Memuat informasi top up...
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background-app text-text-primary">
      <div className="mx-auto w-full max-w-md min-h-screen bg-background-app relative overflow-hidden">
        <header className="bg-primary px-5 pt-12 pb-8 rounded-b-4xl shadow-md text-white">
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={handleHeaderBack}
              className="size-9 rounded-full bg-white/15 grid place-items-center"
              aria-label="Kembali"
            >
              <AppIcon name="arrow_back_ios_new" className="size-5" />
            </button>
            <h1 className="text-xl font-bold">Top Up Saldo</h1>
            <span className="size-9" />
          </div>

          <div className="bg-white rounded-2xl p-4 text-text-primary shadow-soft border border-black/5">
            <p className="text-xs uppercase tracking-wider font-bold text-text-secondary mb-1">
              Saldo Saat Ini
            </p>
            <p className="text-xl font-bold">{formatCurrency(currentBalance)}</p>
            <p className="text-xs text-text-secondary mt-1">{displayName}</p>
          </div>
        </header>

        {step === 1 && (
          <main className="px-5 pt-6 pb-8">
            <h2 className="text-lg font-bold mb-2">Pilih Bank Transfer</h2>
            <p className="text-sm text-text-secondary mb-5">
              Saat ini top up manual tersedia melalui {bankDisplayName}.
            </p>

            <button
              type="button"
              className="w-full rounded-2xl bg-white p-4 border border-primary/40 shadow-soft flex items-center justify-between"
              onClick={handleContinueFromBank}
            >
              <div className="flex items-center gap-3 text-left">
                <div className="w-16 h-10 rounded-lg bg-blue-50 border border-blue-100 grid place-items-center">
                  <span className="text-sm font-bold text-blue-700">{bankLabel}</span>
                </div>
                <div>
                  <p className="font-bold">{bankDisplayName}</p>
                  <p className="text-xs text-text-secondary">{TOPUP_TRANSFER_TYPE_LABEL}</p>
                </div>
              </div>
              <AppIcon name="chevron_right" className="size-4 text-text-secondary" />
            </button>
          </main>
        )}

        {step === 2 && (
          <main className="px-5 pt-6 pb-28">
            <div className="bg-white rounded-2xl p-4 shadow-soft border border-black/5 mb-8 flex items-center justify-between">
              <div>
                <p className="text-xs text-text-secondary uppercase tracking-wide">Tujuan Transfer</p>
                <p className="font-bold">{bankInfo?.accountName || '-'}</p>
                <p className="text-sm">{bankInfo?.accountNumber || '-'}</p>
              </div>
              <span className="text-xs font-bold text-primary">{bankLabel}</span>
            </div>

            <h2 className="text-lg font-bold mb-5">Berapa saldo yang mau kamu isi?</h2>
            <div className="bg-white rounded-2xl p-4 shadow-soft border border-black/5 mb-4">
              <label htmlFor="topup-amount" className="text-xs uppercase tracking-wide text-text-secondary font-bold">
                Nominal Top Up
              </label>
              <div className="flex items-end gap-2 border-b-2 border-black/10 mt-2 pb-2">
                <span className="font-bold text-xl">Rp</span>
                <input
                  id="topup-amount"
                  type="number"
                  inputMode="numeric"
                  min={minAmount || 0}
                  value={amountInput}
                  onChange={(event) => {
                    setAmountInput(event.target.value)
                    setAmountError('')
                  }}
                  placeholder="Nominal"
                  className="w-full text-xl font-bold bg-transparent outline-none"
                />
              </div>
              <p className="text-xs text-text-secondary mt-2">
                Minimal top up {formatCurrency(minAmount)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              {quickAmounts.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => handleChooseQuickAmount(amount)}
                  className="rounded-xl bg-white border border-black/10 py-2.5 text-sm font-bold"
                >
                  {formatCurrency(amount)}
                </button>
              ))}
            </div>

            {amountError && <p className="text-sm font-medium text-red-500 mb-2">{amountError}</p>}
            {requestError && <p className="text-sm font-medium text-red-500 mb-2">{requestError}</p>}
            {infoMessage && <p className="text-sm font-medium text-emerald-500 mb-2">{infoMessage}</p>}
          </main>
        )}

        {step === 3 && pendingOrder && (
          <main className="px-5 pt-6 pb-10">
            <section className="bg-white rounded-3xl p-5 shadow-soft border border-black/5 mb-4">
              <p className="text-sm text-text-secondary mb-1">Total Pembayaran</p>
              <h2 className="text-3xl font-bold text-primary mb-4">{formatCurrency(pendingOrder.totalAmount)}</h2>

              <div className="rounded-xl border border-dashed border-primary/30 p-3 mb-3">
                <p className="text-xs text-text-secondary mb-1">Nomor Rekening Tujuan</p>
                <p className="text-xl font-bold tracking-wider">{bankInfo?.accountNumber || '-'}</p>
              </div>

              <button
                type="button"
                onClick={handleCopyAccountNumber}
                className="w-full rounded-xl border border-primary/25 text-primary py-2.5 font-semibold mb-4"
              >
                Salin Nomor Rekening
              </button>

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Penerima</span>
                  <span className="font-semibold">{bankInfo?.accountName || '-'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Nominal Top Up</span>
                  <span className="font-semibold">{formatCurrency(pendingOrder.amount)}</span>
                </div>
                {pendingOrder.uniqueCode > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-text-secondary">Kode Unik</span>
                    <span className="font-semibold">{pendingOrder.uniqueCode}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Batas Waktu</span>
                  <span className="font-semibold text-red-500">{countdown}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Referensi</span>
                  <span className="font-semibold text-right max-w-[58%] break-all">{pendingOrder.reference}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Dibuat</span>
                  <span className="font-semibold">{formatReferenceTime(pendingOrder.createdAt)}</span>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-sm text-text-secondary uppercase tracking-wider">Instruksi Pembayaran</h3>
              {TOPUP_PAYMENT_INSTRUCTIONS.map((instruction) => (
                <details key={instruction.title} className="bg-white rounded-2xl border border-black/5 p-4 shadow-soft">
                  <summary className="font-semibold cursor-pointer">{instruction.title}</summary>
                  <ol className="list-decimal list-inside mt-3 space-y-1 text-sm text-text-secondary">
                    {instruction.steps.map((stepItem) => (
                      <li key={stepItem}>{stepItem}</li>
                    ))}
                  </ol>
                </details>
              ))}
            </section>

            <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-text-secondary">
              Setelah transfer dilakukan, status transaksi akan diverifikasi dan diperbarui oleh admin panel.
            </div>

            {requestError && <p className="text-sm font-medium text-red-500 mt-3">{requestError}</p>}
            {infoMessage && <p className="text-sm font-medium text-emerald-500 mt-3">{infoMessage}</p>}
          </main>
        )}

        {step === 2 && (
          <div className="fixed bottom-0 left-0 right-0 mx-auto max-w-md p-5 bg-background-app border-t border-black/5">
            <button
              type="button"
              onClick={handleCreateOrder}
              disabled={isSubmitting}
              className="w-full rounded-2xl bg-primary hover:bg-primary-hover disabled:opacity-60 text-white font-bold py-3.5"
            >
              {isSubmitting ? 'Memproses...' : 'Isi Saldo'}
            </button>
          </div>
        )}

        {step === 3 && pendingOrder && (
          <div className="fixed bottom-0 left-0 right-0 mx-auto max-w-md p-5 bg-white border-t border-black/5 space-y-2">
            <button
              type="button"
              onClick={handleCancelActiveTopUp}
              disabled={isCancelling}
              className="w-full rounded-2xl border border-black/10 text-text-secondary font-semibold py-3 disabled:opacity-60"
            >
              {isCancelling ? 'Membatalkan...' : 'Batalkan Top Up Ini'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
