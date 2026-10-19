import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MobileBottomNav from '../components/MobileBottomNav'
import { mitrakamiApi } from '../services/mitrakamiApi'
import { getAuthSession, updateAuthSession } from '../utils/authStorage'
import {
  normalizeTopUpHistoryTransaction,
  resolveTopUpHistoryRoute,
} from '../utils/topupHistoryMapper'
import AppIcon from '../components/AppIcon'

const DEFAULT_FILTER_TYPES = [
  { key: 'all', label: 'Semua' },
  { key: 'expense', label: 'Uang Keluar' },
  { key: 'income', label: 'Uang Masuk' },
]

const DEFAULT_FILTER_TYPE_LABELS = DEFAULT_FILTER_TYPES.reduce((accumulator, item) => {
  accumulator[item.key] = item.label
  return accumulator
}, {})

const normalizeFilterTypes = (types) => {
  if (!Array.isArray(types) || types.length === 0) {
    return DEFAULT_FILTER_TYPES
  }

  const normalized = types
    .map((item) => {
      const key = typeof item?.key === 'string' ? item.key.trim() : ''
      if (!key) {
        return null
      }

      const apiLabel = typeof item?.label === 'string' ? item.label.trim() : ''
      const fallbackLabel = DEFAULT_FILTER_TYPE_LABELS[key]

      return {
        ...item,
        key,
        label: fallbackLabel || apiLabel || key,
      }
    })
    .filter(Boolean)

  return normalized.length > 0 ? normalized : DEFAULT_FILTER_TYPES
}

const DIRECTION_STYLES = {
  credit: {
    sign: '+',
    amountClass: 'text-emerald-600',
    iconClass: 'text-emerald-500',
    iconBgClass: 'bg-emerald-100',
    icon: 'south_west',
  },
  debit: {
    sign: '-',
    amountClass: 'text-text-primary',
    iconClass: 'text-red-500',
    iconBgClass: 'bg-red-100',
    icon: 'north_east',
  },
}

const STATUS_STYLES = {
  success: 'bg-emerald-100 text-emerald-700',
  pending: 'bg-amber-100 text-amber-700',
  failed: 'bg-red-100 text-red-700',
}

const STATUS_LABELS = {
  success: 'sukses',
  pending: 'diproses',
  failed: 'gagal',
}

const monthFormatter = new Intl.DateTimeFormat('id-ID', {
  month: 'short',
  year: 'numeric',
})

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

const timeFormatter = new Intl.DateTimeFormat('id-ID', {
  hour: '2-digit',
  minute: '2-digit',
})

const formatCurrency = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`

const formatMonthParam = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1)

const parseMonthStart = (value) => {
  if (!value) return null

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return startOfMonth(parsed)
}

const toDateLabel = (dateKey) => {
  const now = new Date()
  const todayKey = now.toISOString().slice(0, 10)

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayKey = yesterday.toISOString().slice(0, 10)

  if (dateKey === todayKey) return 'Hari Ini'
  if (dateKey === yesterdayKey) return 'Kemarin'

  const [year, month, day] = dateKey.split('-').map(Number)
  return dateFormatter.format(new Date(year, month - 1, day))
}

const canOpenTransactionDetail = (item) => Boolean(item?.id && item?.reference)

export default function HistoryPage() {
  const navigate = useNavigate()
  const authSession = useMemo(() => getAuthSession() ?? {}, [])
  const [selectedMonth, setSelectedMonth] = useState(() => startOfMonth(new Date()))
  const [filterType, setFilterType] = useState('all')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [transactions, setTransactions] = useState([])
  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
    has_more: false,
  })
  const [summary, setSummary] = useState(null)
  const [availableFilterTypes, setAvailableFilterTypes] = useState(DEFAULT_FILTER_TYPES)
  const [availableCategories, setAvailableCategories] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [requestError, setRequestError] = useState('')
  const [memberJoinedAt, setMemberJoinedAt] = useState(() => authSession?.joinedAt ?? null)

  const isAtCurrentMonth = useMemo(() => {
    const currentMonth = startOfMonth(new Date())
    return selectedMonth.getTime() >= currentMonth.getTime()
  }, [selectedMonth])

  const minHistoryMonth = useMemo(() => {
    return parseMonthStart(memberJoinedAt)
  }, [memberJoinedAt])

  const isAtMinHistoryMonth = useMemo(() => {
    if (!minHistoryMonth) {
      return false
    }

    return selectedMonth.getTime() <= minHistoryMonth.getTime()
  }, [minHistoryMonth, selectedMonth])

  const groupedTransactions = useMemo(() => {
    const grouped = transactions.reduce((accumulator, item) => {
      const dateKey = item?.date || item?.created_at?.slice(0, 10)
      if (!dateKey) {
        return accumulator
      }

      if (!accumulator[dateKey]) {
        accumulator[dateKey] = []
      }

      accumulator[dateKey].push(item)
      return accumulator
    }, {})

    return Object.entries(grouped)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([dateKey, rows]) => ({
        dateKey,
        label: toDateLabel(dateKey),
        rows,
      }))
  }, [transactions])

  const syncSessionBalance = useCallback(async () => {
    try {
      const profile = await mitrakamiApi.getCurrentMember()
      if (!profile) return

      const latestSession = getAuthSession() ?? {}

      updateAuthSession({
        ...latestSession,
        memberId: profile.member_id ?? latestSession?.memberId,
        memberName: profile.name ?? profile.username ?? latestSession?.memberName,
        packageName: profile.package?.name ?? latestSession?.packageName,
        avatar: profile.avatar ?? latestSession?.avatar,
        walletBalance: profile.wallet_balance != null
          ? Number(profile.wallet_balance)
          : latestSession?.walletBalance,
        totalPv: profile.total_pv != null
          ? Number(profile.total_pv)
          : latestSession?.totalPv,
        joinedAt:
          profile.join_date
          ?? profile.joined_at
          ?? profile.created_at
          ?? latestSession?.joinedAt,
      })

      setMemberJoinedAt(
        profile.join_date
        ?? profile.joined_at
        ?? profile.created_at
        ?? latestSession?.joinedAt
        ?? null,
      )
    } catch {
      // Ignore profile sync errors silently.
    }
  }, [])

  useEffect(() => {
    if (!minHistoryMonth) {
      return
    }

    if (selectedMonth.getTime() < minHistoryMonth.getTime()) {
      setSelectedMonth(minHistoryMonth)
    }
  }, [minHistoryMonth, selectedMonth])

  const fetchHistory = useCallback(async ({ page = 1, append = false } = {}) => {
    if (append) {
      setIsLoadingMore(true)
    } else {
      setIsLoading(true)
    }

    setRequestError('')

    try {
      const payload = await mitrakamiApi.getTransactionHistory({
        month: formatMonthParam(selectedMonth),
        filter_type: filterType,
        category: selectedCategory || undefined,
        page,
      })

      const nextTransactions = Array.isArray(payload?.transactions) ? payload.transactions : []

      setTransactions((previous) => (append ? [...previous, ...nextTransactions] : nextTransactions))
      setPagination({
        current_page: payload?.pagination?.current_page ?? 1,
        last_page: payload?.pagination?.last_page ?? 1,
        has_more: Boolean(payload?.pagination?.has_more),
      })
      setSummary(payload?.summary ?? null)

      const nextFilterTypes = payload?.filters?.types
      if (Array.isArray(nextFilterTypes) && nextFilterTypes.length > 0) {
        setAvailableFilterTypes(normalizeFilterTypes(nextFilterTypes))
      }

      const nextCategories = payload?.filters?.categories
      if (Array.isArray(nextCategories)) {
        setAvailableCategories(nextCategories)
      }

      await syncSessionBalance()
    } catch (error) {
      const responseMessage = error?.response?.data?.message
      setRequestError(responseMessage || 'Gagal memuat riwayat transaksi.')

      if (!append) {
        setTransactions([])
      }
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }, [filterType, selectedCategory, selectedMonth, syncSessionBalance])

  useEffect(() => {
    fetchHistory({ page: 1 })
  }, [fetchHistory])

  const handleLoadMore = () => {
    if (!pagination.has_more || isLoadingMore) {
      return
    }

    fetchHistory({ page: pagination.current_page + 1, append: true })
  }

  const handleTransactionClick = (item) => {
    const topUpTransaction = normalizeTopUpHistoryTransaction(item)

    if (topUpTransaction) {
      navigate(resolveTopUpHistoryRoute(topUpTransaction.status), {
        state: {
          from: '/app/history',
          transaction: topUpTransaction,
        },
      })

      return
    }

    if (!canOpenTransactionDetail(item)) {
      return
    }

    navigate('/app/history/transaction', {
      state: {
        from: '/app/history',
        transaction: item,
      },
    })
  }

  return (
    <div className="min-h-screen bg-background-app text-text-primary">
      <div className="mx-auto w-full max-w-md min-h-screen bg-background-app relative overflow-hidden pb-28">
        <header className="px-6 pt-12 pb-4 bg-background-app sticky top-0 z-10">
          <div className="flex items-center justify-between mb-5">
            <h1 className="text-2xl font-bold tracking-tight">Riwayat</h1>
            <button
              type="button"
              aria-label="Cari transaksi"
              className="size-10 rounded-full grid place-items-center text-text-secondary"
            >
              <AppIcon name="search" className="size-5" />
            </button>
          </div>

          <div className="flex items-center justify-between mb-5">
            <button
              type="button"
              onClick={() => setSelectedMonth((previous) => new Date(previous.getFullYear(), previous.getMonth() - 1, 1))}
              className="size-11 rounded-full bg-gray-200/90 grid place-items-center text-text-primary disabled:opacity-40"
              aria-label="Bulan sebelumnya"
              disabled={isAtMinHistoryMonth}
            >
              <AppIcon name="chevron_left" className="size-5" />
            </button>

            <span className="text-xl font-bold">{monthFormatter.format(selectedMonth)}</span>

            <button
              type="button"
              onClick={() => setSelectedMonth((previous) => new Date(previous.getFullYear(), previous.getMonth() + 1, 1))}
              className="size-11 rounded-full bg-gray-200/90 grid place-items-center text-text-primary disabled:opacity-40"
              aria-label="Bulan berikutnya"
              disabled={isAtCurrentMonth}
            >
              <AppIcon name="chevron_right" className="size-5" />
            </button>
          </div>

          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
            {availableFilterTypes.map((item) => {
              const isActive = item.key === filterType

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    setFilterType(item.key)
                  }}
                  className={`px-5 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap ${isActive ? 'bg-primary text-white shadow-soft' : 'bg-gray-200/90 text-text-primary'}`}
                >
                  {item.label}
                </button>
              )
            })}

            {availableCategories.map((item) => {
              const isActive = selectedCategory === item.key

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    setSelectedCategory((previous) => (previous === item.key ? '' : item.key))
                  }}
                  className={`px-5 py-2.5 rounded-full text-sm font-medium whitespace-nowrap border ${isActive ? 'border-primary text-primary bg-primary-soft' : 'border-black/10 text-text-secondary bg-white'}`}
                >
                  {item.label}
                </button>
              )
            })}
          </div>
        </header>

        <main className="px-4 pt-2 pb-4">
          <div className="rounded-3xl bg-white/80 border border-black/5 p-4 mb-4">
            <p className="text-xs uppercase tracking-wide text-text-secondary">Total transaksi bulan ini</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(summary?.total_amount ?? 0)}</p>
            <p className="text-sm text-text-secondary mt-1">{summary?.transactions_count ?? 0} transaksi</p>
          </div>

          {requestError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 mb-4">
              <p className="text-sm font-medium text-red-600 mb-3">{requestError}</p>
              <button
                type="button"
                onClick={() => fetchHistory({ page: 1 })}
                className="rounded-xl bg-red-600 text-white text-sm font-semibold px-4 py-2"
              >
                Coba Lagi
              </button>
            </div>
          )}

          {isLoading && !requestError && (
            <div className="space-y-4">
              <div className="h-30 rounded-2xl bg-white animate-pulse" />
              <div className="h-30 rounded-2xl bg-white animate-pulse" />
            </div>
          )}

          {!isLoading && !requestError && groupedTransactions.length === 0 && (
            <div className="rounded-2xl border border-black/5 bg-white p-5 text-center">
              <p className="font-semibold mb-1">Belum ada transaksi.</p>
              <p className="text-sm text-text-secondary">Riwayat akan muncul otomatis saat transaksi berhasil dibuat.</p>
            </div>
          )}

          {!isLoading && !requestError && groupedTransactions.map((group) => (
            <section key={group.dateKey} className="mb-6">
              <h2 className="text-sm font-semibold text-text-secondary px-2 mb-3">{group.label}</h2>

              <div className="bg-white rounded-3xl border border-black/5 overflow-hidden">
                {group.rows.map((item, index) => {
                  const directionStyle = DIRECTION_STYLES[item?.direction] ?? DIRECTION_STYLES.debit
                  const statusClass = STATUS_STYLES[item?.status] ?? 'bg-gray-100 text-gray-600'
                  const statusLabel = STATUS_LABELS[item?.status] || item?.status || '-'
                  const timeLabel = item?.created_at
                    ? timeFormatter.format(new Date(item.created_at))
                    : item?.time || '-'
                  const hasDivider = index < group.rows.length - 1
                  const isClickable = Boolean(normalizeTopUpHistoryTransaction(item) || canOpenTransactionDetail(item))

                  return (
                    <button
                      key={`${item.id}-${item.reference}`}
                      type="button"
                      onClick={() => handleTransactionClick(item)}
                      disabled={!isClickable}
                      className={`w-full text-left p-4 flex items-center gap-3 ${hasDivider ? 'border-b border-black/5' : ''} ${!isClickable ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                      <div className={`size-13 rounded-full ${directionStyle.iconBgClass} grid place-items-center shrink-0`}>
                        <AppIcon name={directionStyle.icon} className={`size-6 ${directionStyle.iconClass}`} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="font-bold truncate">{item.title}</p>
                        <p className="text-sm text-text-secondary truncate">
                          {item.category_label}
                          {item.counterparty ? ` | ${item.counterparty}` : ''}
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusClass}`}>
                            {statusLabel}
                          </span>
                          <span className="text-[10px] text-text-secondary">{item.reference}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className={`text-xl font-bold ${directionStyle.amountClass}`}>
                          {directionStyle.sign} {formatCurrency(item.amount)}
                        </p>
                        <p className="text-sm text-gray-400">{timeLabel}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </section>
          ))}

          {!isLoading && !requestError && pagination.has_more && (
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              className="w-full rounded-2xl bg-white border border-black/10 py-3 font-semibold disabled:opacity-60"
            >
              {isLoadingMore ? 'Memuat...' : 'Muat lebih banyak'}
            </button>
          )}
        </main>

        <MobileBottomNav currentTab="history" />
      </div>
    </div>
  )
}
