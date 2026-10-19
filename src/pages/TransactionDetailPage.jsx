import { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import AppIcon from '../components/AppIcon'

const HISTORY_ROUTE = '/app/history'

const STATUS_LABELS = {
  success: 'Sukses',
  pending: 'Diproses',
  failed: 'Gagal',
}

const STATUS_STYLES = {
  success: 'bg-emerald-100 text-emerald-700',
  pending: 'bg-amber-100 text-amber-700',
  failed: 'bg-red-100 text-red-700',
}

const STATUS_ICONS = {
  success: {
    wrapperClass: 'bg-emerald-100',
    iconClass: 'text-emerald-500',
    iconName: 'check_circle',
  },
  pending: {
    wrapperClass: 'bg-amber-100',
    iconClass: 'text-amber-500',
    iconName: 'schedule',
  },
  failed: {
    wrapperClass: 'bg-red-100',
    iconClass: 'text-red-500',
    iconName: 'cancel',
  },
}

const formatCurrency = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`
const normalizeText = (value) => String(value || '').toLowerCase().trim()

const formatDateTime = (value) => {
  if (!value) {
    return '-'
  }

  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) {
    return '-'
  }

  return parsedDate.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const resolveProviderSnapshot = (notes) => {
  if (!notes || typeof notes !== 'object') {
    return null
  }

  const provider = notes.provider
  if (!provider || typeof provider !== 'object') {
    return null
  }

  return provider.callback || provider.response || provider.inquiry || null
}

const resolveProductTypeLabel = (value) => {
  const productType = normalizeText(value)

  if (productType === 'pulsa') return 'Pulsa'
  if (productType === 'data') return 'Paket Data'
  if (productType === 'prepaid') return 'Prabayar'
  if (productType === 'postpaid') return 'Pascabayar'

  return value || '-'
}

const isHotelTransaction = (transaction) => normalizeText(transaction?.category) === 'hotels'

const parseHotelNotes = (notes) => {
  if (!notes || typeof notes !== 'object') {
    return {}
  }

  return {
    hotelName: notes.hotel_name || notes.hotelName || '',
    roomName: notes.room_name || notes.roomName || '',
    reservationNo: notes.reservation_no || notes.reservationNo || '',
    osRefNo: notes.os_ref_no || notes.osRefNo || '',
    agentOsRef: notes.agent_os_ref || notes.agentOsRef || '',
    bookingStatus: notes.booking_status || notes.bookingStatus || '',
    checkInDate: notes.check_in_date || notes.checkInDate || '',
    checkOutDate: notes.check_out_date || notes.checkOutDate || '',
    rooms: notes.rooms || 1,
    bedType: notes.bed_type || notes.bedType || '',
    guestName: notes.guest_name || notes.guestName || '',
    guestEmail: notes.guest_email || notes.guestEmail || '',
  }
}

const isPlnTokenTransaction = (transaction) => {
  const notes = transaction?.notes || {}
  const serviceCode = normalizeText(notes?.service_code)
  const serviceName = normalizeText(notes?.service_name)
  const productType = normalizeText(notes?.product_type)
  const title = normalizeText(transaction?.title)

  if (serviceCode === 'pln-token') {
    return true
  }

  if (serviceName.includes('token') && serviceName.includes('listrik')) {
    return true
  }

  return productType === 'prepaid' && title.includes('pln')
}

const parsePlnTokenSerial = (serialNumber) => {
  const sn = String(serialNumber || '').trim()
  if (!sn || !sn.includes('/')) {
    return null
  }

  const segments = sn
    .split('/')
    .map((item) => item.trim())
    .filter(Boolean)

  if (segments.length < 4) {
    return null
  }

  const tariffPower = segments.length >= 5
    ? `${segments[2]}/${segments[3]}`
    : segments[2]

  const kwhAmount = segments.length >= 5
    ? segments.slice(4).join('/')
    : segments[3]

  return {
    tokenNumber: segments[0],
    customerName: segments[1],
    tariffPower,
    kwhAmount,
  }
}

const parseOvoSerial = (serialNumber) => {
  const sn = String(serialNumber || '').trim()
  if (!sn || !sn.includes('/')) {
    return null
  }

  const segments = sn
    .split('/')
    .map((item) => item.trim())
    .filter(Boolean)

  if (segments.length < 4) {
    return null
  }

  return {
    customerName: segments[0],
    ovoNumber: segments[1],
    topUpAmount: segments[2],
    transactionCode: segments.slice(3).join('/'),
  }
}

const isOvoTopUpTransaction = (transaction, providerSnapshot) => {
  const title = normalizeText(transaction?.title)
  const notes = transaction?.notes || {}
  const serviceName = normalizeText(notes?.service_name)
  const serialNumber = normalizeText(providerSnapshot?.sn)

  if (title.includes('ovo')) {
    return true
  }

  if (serviceName.includes('e-money') && serialNumber.startsWith('ovo ')) {
    return true
  }

  return false
}

const isPulsaOrDataTransaction = (transaction) => {
  const category = normalizeText(transaction?.category)
  if (category !== 'pulsa') {
    return false
  }

  const productType = normalizeText(transaction?.notes?.product_type)
  return productType === 'pulsa' || productType === 'data'
}

const toDetailRows = (transaction, providerSnapshot) => {
  const notes = transaction?.notes || {}
  const category = normalizeText(transaction?.category)
  const rows = []

  if (category === 'pulsa') {
    const productType = normalizeText(notes?.product_type)
    const productLabel = productType === 'data' ? 'Paket Data' : 'Pulsa'
    const productDisplayName = transaction?.title || notes?.product_name || notes?.product_code || '-'

    rows.push(
      { label: 'Operator', value: notes?.operator_name || '-' },
      { label: 'Jenis Produk', value: resolveProductTypeLabel(notes?.product_type) },
      { label: productLabel, value: productDisplayName },
    )
  }

  if (category === 'bills') {
    rows.push(
      { label: 'Layanan', value: notes?.service_name || '-' },
      { label: 'Jenis Transaksi', value: resolveProductTypeLabel(notes?.product_type) },
      { label: 'Kode Produk', value: notes?.product_code || '-' },
    )

    const customerName = providerSnapshot?.customer_name || providerSnapshot?.customer || ''
    if (customerName) {
      rows.push({ label: 'Nama Pelanggan', value: customerName })
    }

    const billPeriod = providerSnapshot?.periode
    if (billPeriod) {
      rows.push({ label: 'Periode', value: billPeriod })
    }
  }

  return rows.filter((item) => String(item?.value || '').trim() !== '')
}

const toProviderRows = (transaction, providerSnapshot) => {
  if (!providerSnapshot || typeof providerSnapshot !== 'object') {
    return []
  }

  if (isPlnTokenTransaction(transaction)) {
    const tokenSerial = parsePlnTokenSerial(providerSnapshot?.sn)

    const tokenRows = [
      { label: 'Message', value: providerSnapshot.message || '-' },
      { label: 'RC', value: providerSnapshot.rc || '-' },
      { label: 'No. Token', value: tokenSerial?.tokenNumber || '-' },
      { label: 'Nama Pelanggan', value: tokenSerial?.customerName || providerSnapshot.customer_name || '-' },
      { label: 'Tarif Daya', value: tokenSerial?.tariffPower || '-' },
      { label: 'Jumlah Kwh', value: tokenSerial?.kwhAmount || '-' },
      { label: 'Customer No', value: providerSnapshot.customer_no || '-' },
    ]

    return tokenRows.filter((item) => String(item?.value || '').trim() !== '')
  }

  if (isOvoTopUpTransaction(transaction, providerSnapshot)) {
    const ovoSerial = parseOvoSerial(providerSnapshot?.sn)

    const ovoRows = [
      { label: 'Message', value: providerSnapshot.message || '-' },
      { label: 'RC', value: providerSnapshot.rc || '-' },
      { label: 'Nama Pelanggan', value: ovoSerial?.customerName || '-' },
      { label: 'No. OVO', value: ovoSerial?.ovoNumber || '-' },
      { label: 'Jumlah Top Up', value: ovoSerial?.topUpAmount || '-' },
      { label: 'Kode Transaksi', value: ovoSerial?.transactionCode || '-' },
    ]

    return ovoRows.filter((item) => String(item?.value || '').trim() !== '')
  }

  if (isPulsaOrDataTransaction(transaction)) {
    const rows = [
      { label: 'Message', value: providerSnapshot.message || '-' },
      { label: 'RC', value: providerSnapshot.rc || '-' },
      { label: 'SN', value: providerSnapshot.sn || '-' },
      { label: 'Nomor Pelanggan', value: providerSnapshot.customer_no || '-' },
    ]

    return rows.filter((item) => String(item?.value || '').trim() !== '')
  }

  const rows = [
    { label: 'Message', value: providerSnapshot.message || '-' },
    { label: 'RC', value: providerSnapshot.rc || '-' },
    { label: 'SN', value: providerSnapshot.sn || '-' },
    { label: 'Ref ID', value: providerSnapshot.ref_id || '-' },
    { label: 'SKU', value: providerSnapshot.buyer_sku_code || '-' },
    { label: 'Customer No', value: providerSnapshot.customer_no || '-' },
  ]

  return rows.filter((item) => String(item?.value || '').trim() !== '')
}

const toBillingRows = (providerSnapshot) => {
  if (!providerSnapshot || typeof providerSnapshot !== 'object') {
    return []
  }

  const amount = Number(providerSnapshot.selling_price || providerSnapshot.price || providerSnapshot.amount || 0)
  const admin = Number(providerSnapshot.admin || 0)

  const rows = []
  if (amount > 0) {
    rows.push({ label: 'Nominal Provider', value: formatCurrency(amount) })
  }

  if (admin > 0) {
    rows.push({ label: 'Biaya Admin', value: formatCurrency(admin) })
  }

  return rows
}

const toPostpaidBreakdownRows = (providerSnapshot) => {
  const detailRows = providerSnapshot?.desc?.detail

  if (!Array.isArray(detailRows) || detailRows.length === 0) {
    return []
  }

  return detailRows.map((item, index) => ({
    id: index,
    period: item?.periode || '-',
    billValue: item?.nilai_tagihan || '-',
    admin: item?.admin || '-',
    penalty: item?.denda || '-',
  }))
}

export default function TransactionDetailPage() {
  const navigate = useNavigate()
  const location = useLocation()

  const transaction = useMemo(() => {
    if (location.state?.transaction && typeof location.state.transaction === 'object') {
      return location.state.transaction
    }

    return null
  }, [location.state?.transaction])

  if (!transaction) {
    return (
      <div className="min-h-screen bg-background-app text-text-primary">
        <div className="mx-auto w-full max-w-md min-h-screen bg-background-app relative overflow-hidden px-5 pt-16 pb-8">
          <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-soft text-center">
            <h1 className="text-xl font-bold mb-2">Data transaksi tidak ditemukan</h1>
            <p className="text-sm text-text-secondary mb-5">
              Silakan kembali ke halaman riwayat untuk melihat detail transaksi.
            </p>
            <button
              type="button"
              onClick={() => navigate(HISTORY_ROUTE, { replace: true })}
              className="w-full rounded-2xl bg-primary text-white font-bold py-3"
            >
              Kembali ke Riwayat
            </button>
          </div>
        </div>
      </div>
    )
  }

  const status = String(transaction.status || 'pending').toLowerCase()
  const statusLabel = STATUS_LABELS[status] || status
  const statusClass = STATUS_STYLES[status] || 'bg-gray-100 text-gray-700'
  const statusIcon = STATUS_ICONS[status] || STATUS_ICONS.pending

  const providerSnapshot = resolveProviderSnapshot(transaction.notes)
  const detailRows = toDetailRows(transaction, providerSnapshot)
  const providerRows = toProviderRows(transaction, providerSnapshot)
  const billingRows = toBillingRows(providerSnapshot)
  const postpaidBreakdownRows = toPostpaidBreakdownRows(providerSnapshot)
  const isHotel = isHotelTransaction(transaction)
  const hotelNotes = isHotel ? parseHotelNotes(transaction.notes) : null

  return (
    <div className="min-h-screen bg-background-app text-text-primary">
      <div className="mx-auto w-full max-w-md min-h-screen bg-background-app relative overflow-hidden pb-8">
        <header className="bg-primary text-white px-5 pt-12 pb-8 shadow-md">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate(HISTORY_ROUTE, { replace: true })}
              className="size-9 rounded-full bg-white/15 grid place-items-center"
              aria-label="Kembali"
            >
              <AppIcon name="arrow_back_ios_new" className="size-5" />
            </button>
            <h1 className="text-xl font-bold">Detail Transaksi</h1>
            <span className="size-9" />
          </div>
        </header>

        <main className="px-5 pt-7">
          <div className={`size-20 mx-auto mb-6 rounded-full ${statusIcon.wrapperClass} grid place-items-center`}>
            <AppIcon name={statusIcon.iconName} className={`size-24 ${statusIcon.iconClass}`} />
          </div>

          <h2 className="text-2xl font-bold text-center mb-2">{transaction.title || '-'}</h2>
          <div className="text-center mb-7">
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${statusClass}`}>
              {statusLabel}
            </span>
          </div>

          <section className="rounded-3xl bg-white border border-black/5 shadow-soft p-5 mb-5">
            <div className="text-center border-b border-black/5 pb-4 mb-4">
              <p className="text-text-secondary text-sm mb-2">Nominal Transaksi</p>
              <p className="text-2xl font-bold text-primary">{formatCurrency(transaction.amount)}</p>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-text-secondary">Kategori</span>
                <span className="font-semibold text-right">{transaction.category_label || '-'}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-text-secondary">Tujuan</span>
                <span className="font-semibold text-right">{transaction.counterparty || '-'}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-text-secondary">No. Referensi</span>
                <span className="font-semibold text-right break-all">{transaction.reference || '-'}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-text-secondary">Waktu Transaksi</span>
                <span className="font-semibold text-right">{formatDateTime(transaction.created_at)}</span>
              </div>
            </div>
          </section>

          {isHotel && hotelNotes ? (
            <section className="rounded-3xl bg-white border border-black/5 shadow-soft p-5 mb-5">
              <h3 className="text-xs font-bold uppercase tracking-wide text-text-secondary mb-3">Detail Reservasi Hotel</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-text-secondary">Hotel</span>
                  <span className="font-semibold text-right">{hotelNotes.hotelName || '-'}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-text-secondary">Kamar</span>
                  <span className="font-semibold text-right">{hotelNotes.roomName || '-'}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-text-secondary">Check-in</span>
                  <span className="font-semibold text-right">{hotelNotes.checkInDate || '-'}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-text-secondary">Check-out</span>
                  <span className="font-semibold text-right">{hotelNotes.checkOutDate || '-'}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-text-secondary">Jumlah Kamar</span>
                  <span className="font-semibold text-right">{hotelNotes.rooms || 1}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-text-secondary">Tipe Tempat Tidur</span>
                  <span className="font-semibold text-right">{hotelNotes.bedType || '-'}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-text-secondary">Nama Tamu</span>
                  <span className="font-semibold text-right">{hotelNotes.guestName || '-'}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-text-secondary">Email Tamu</span>
                  <span className="font-semibold text-right">{hotelNotes.guestEmail || '-'}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-text-secondary">Kode Reservasi</span>
                  <span className="font-semibold text-right break-all">{hotelNotes.reservationNo || '-'}</span>
                </div>
                {hotelNotes.bookingStatus ? (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-text-secondary">Status Booking</span>
                    <span className="font-semibold text-right">{hotelNotes.bookingStatus}</span>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          {(detailRows.length > 0 || billingRows.length > 0) && (
            <section className="rounded-3xl bg-white border border-black/5 shadow-soft p-5 mb-5">
              <h3 className="text-xs font-bold uppercase tracking-wide text-text-secondary mb-3">Detail Layanan</h3>

              {detailRows.length > 0 && (
                <div className="space-y-3 text-sm mb-3">
                  {detailRows.map((row) => (
                    <div key={`${row.label}-${row.value}`} className="flex items-center justify-between gap-3">
                      <span className="text-text-secondary">{row.label}</span>
                      <span className="font-semibold text-right wrap-break-word">{row.value}</span>
                    </div>
                  ))}
                </div>
              )}

              {billingRows.length > 0 && (
                <div className={`space-y-3 text-sm ${detailRows.length > 0 ? 'border-t border-black/5 pt-3' : ''}`}>
                  {billingRows.map((row) => (
                    <div key={`${row.label}-${row.value}`} className="flex items-center justify-between gap-3">
                      <span className="text-text-secondary">{row.label}</span>
                      <span className="font-semibold text-right">{row.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {providerRows.length > 0 && (
            <section className="rounded-3xl bg-white border border-black/5 shadow-soft p-5 mb-8">
              <h3 className="text-xs font-bold uppercase tracking-wide text-text-secondary mb-3">Status Provider</h3>
              <div className="space-y-3 text-sm">
                {providerRows.map((row) => (
                  <div key={`${row.label}-${row.value}`} className="flex items-center justify-between gap-3">
                    <span className="text-text-secondary">{row.label}</span>
                    <span className="font-semibold text-right break-all">{row.value}</span>
                  </div>
                ))}
              </div>

              {postpaidBreakdownRows.length > 0 && (
                <div className="mt-4 border-t border-black/5 pt-4 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wide text-text-secondary">Rincian Tagihan</h4>

                  {postpaidBreakdownRows.map((row) => (
                    <div key={row.id} className="rounded-2xl bg-gray-50 border border-black/5 p-3 space-y-1.5 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-text-secondary">Periode</span>
                        <span className="font-semibold">{row.period}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-text-secondary">Nilai Tagihan</span>
                        <span className="font-semibold">{row.billValue}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-text-secondary">Admin</span>
                        <span className="font-semibold">{row.admin}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-text-secondary">Denda</span>
                        <span className="font-semibold">{row.penalty}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          <button
            type="button"
            onClick={() => navigate(HISTORY_ROUTE, { replace: true })}
            className="w-full rounded-2xl border-2 border-primary text-primary font-bold py-3.5"
          >
            Kembali ke Riwayat
          </button>
        </main>
      </div>
    </div>
  )
}
