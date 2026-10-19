const defaultResolveSupplierCode = (supplier) => String(supplier?.code || '').trim().toLowerCase()

export default function SupplierModeSelector({
  title = 'Server harga',
  supplierMode,
  suppliers = [],
  onChange,
  autoModeValue = 'auto',
  autoLabel = 'Termurah otomatis',
  manualPlaceholder = 'Pilih server',
  className = 'rounded-2xl border border-black/10 bg-white p-3',
  selectClassName = 'w-full rounded-xl border border-black/10 bg-white px-3 py-1.5 text-xs',
}) {
  const normalizedSuppliers = Array.isArray(suppliers)
    ? suppliers
      .map((supplier) => {
        const code = defaultResolveSupplierCode(supplier)

        return {
          code,
          name: supplier?.name || code,
          isActive: Boolean(supplier?.is_active),
        }
      })
      .filter((supplier) => supplier.code !== '')
    : []

  return (
    <div className={className}>
      <p className="text-xs uppercase tracking-wide text-text-secondary mb-2">{title}</p>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onChange?.(autoModeValue)}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border ${supplierMode === autoModeValue ? 'bg-primary text-white border-primary' : 'bg-white text-text-secondary border-black/10'}`}
        >
          {autoLabel}
        </button>

        <select
          value={supplierMode === autoModeValue ? '' : supplierMode}
          onChange={(event) => {
            const nextValue = String(event.target.value || '').trim().toLowerCase()

            if (!nextValue) {
              return
            }

            onChange?.(nextValue)
          }}
          className={selectClassName}
          disabled={normalizedSuppliers.length === 0}
        >
          <option value="">{manualPlaceholder}</option>
          {normalizedSuppliers.map((supplier) => (
            <option key={supplier.code} value={supplier.code} disabled={!supplier.isActive}>
              {supplier.name}{!supplier.isActive ? ' (nonaktif)' : ''}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
