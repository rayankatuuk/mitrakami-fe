import AppIcon from './AppIcon'

export default function CustomerNumberStoragePanel({
  saveNumber,
  onSaveNumberChange,
  onSaveNow,
  savedNumbers = [],
  onChooseSavedNumber,
  onDeleteSavedNumber,
  formatCustomerNumber,
  getSecondaryLabel,
  saveToggleLabel = 'Simpan nomor pelanggan',
  saveNowLabel = 'Simpan sekarang',
  recentTitle = 'Terakhir digunakan',
  emptyText = 'Belum ada nomor tersimpan.',
  disableSaveNow = false,
}) {
  const formatValue = formatCustomerNumber || ((value) => value)
  const resolveSecondaryLabel = getSecondaryLabel || ((item) => item?.operator_name || '-')

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <label className="inline-flex items-center gap-2 text-sm font-medium text-text-secondary">
          <input
            type="checkbox"
            checked={saveNumber}
            onChange={(event) => onSaveNumberChange(event.target.checked)}
            className="size-4"
          />
          {saveToggleLabel}
        </label>

        <button
          type="button"
          onClick={onSaveNow}
          disabled={disableSaveNow}
          className="text-sm font-semibold text-primary disabled:opacity-50 border border-primary rounded-lg px-3 py-1 hover:bg-primary/10 disabled:hover:bg-transparent transition-colors"
        >
          {saveNowLabel}
        </button>
      </div>

      <div>
        <h2 className="text-sm font-bold uppercase tracking-wide text-text-secondary mb-3">{recentTitle}</h2>

        <div className="space-y-2">
          {savedNumbers.length === 0 && (
            <div className="rounded-2xl border border-dashed border-black/15 bg-white p-4 text-sm text-text-secondary">
              {emptyText}
            </div>
          )}

          {savedNumbers.map((item) => (
            <article key={item.id} className="rounded-2xl bg-white border border-black/5 p-3 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => onChooseSavedNumber(item)}
                className="text-left min-w-0 flex-1"
              >
                <p className="font-semibold truncate">{formatValue(item.customer_number)}</p>
                <p className="text-xs text-text-secondary truncate">{resolveSecondaryLabel(item)}</p>
              </button>

              <button
                type="button"
                onClick={() => onDeleteSavedNumber(item.id)}
                className="size-9 rounded-full bg-red-50 text-red-500 grid place-items-center"
                aria-label="Hapus nomor"
              >
                <AppIcon name="delete" className="size-5" />
              </button>
            </article>
          ))}
        </div>
      </div>
    </>
  )
}
