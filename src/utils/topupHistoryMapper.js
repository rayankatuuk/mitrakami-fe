export const TOPUP_MEMBER_CATEGORY = 'topup-member'

export const TOPUP_STATUSES = {
  pending: 'pending',
  success: 'success',
  failed: 'failed',
}

export const TOPUP_HISTORY_ROUTES = {
  pending: '/app/topup',
  success: '/app/topup/success',
  failed: '/app/topup/failed',
}

const parseNotes = (notes) => {
  if (!notes) return {}

  if (typeof notes === 'string') {
    try {
      const parsed = JSON.parse(notes)
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  }

  return typeof notes === 'object' ? notes : {}
}

export const normalizeTopUpHistoryTransaction = (transaction) => {
  if (!transaction || transaction.category !== TOPUP_MEMBER_CATEGORY) {
    return null
  }

  const notes = parseNotes(transaction.notes)
  const status = String(transaction.status || TOPUP_STATUSES.pending).toLowerCase()
  const reference = transaction.reference || transaction.trx_id || null
  const createdAt = transaction.createdAt || transaction.created_at || null
  const amount = Number(transaction.amount ?? transaction.totalAmount ?? notes.total_amount ?? 0)
  const totalAmount = Number(
    notes.total_amount
    ?? transaction.totalAmount
    ?? transaction.amount
    ?? 0,
  )

  return {
    id: transaction.id,
    category: transaction.category,
    reference,
    status,
    title: transaction.title,
    amount,
    totalAmount,
    uniqueCode: Number(notes.unique_code ?? 0),
    createdAt,
    counterparty: transaction.counterparty ?? null,
    bankCode: notes.bank_code ?? transaction.bankCode ?? null,
    bankName: notes.bank_name ?? transaction.bankName ?? null,
    accountName: notes.account_name ?? transaction.accountName ?? null,
    accountNumber: notes.account_number ?? transaction.accountNumber ?? null,
    expiresAt: notes.expires_at ?? null,
    failedReason: notes.failed_reason ?? null,
    notes,
  }
}

export const resolveTopUpHistoryRoute = (status) => {
  const normalizedStatus = String(status || '').toLowerCase()

  if (normalizedStatus === TOPUP_STATUSES.success) {
    return TOPUP_HISTORY_ROUTES.success
  }

  if (normalizedStatus === TOPUP_STATUSES.failed) {
    return TOPUP_HISTORY_ROUTES.failed
  }

  return TOPUP_HISTORY_ROUTES.pending
}
