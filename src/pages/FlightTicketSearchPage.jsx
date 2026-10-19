import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MobileBottomNav from '../components/MobileBottomNav'
import {
  CABIN_CLASS_OPTIONS,
  DEFAULT_AIRLINE_CODE,
  FLIGHT_SCOPE_OPTIONS,
  FLIGHT_SEARCH_DEBOUNCE_MS,
  PASSENGER_LIMITS,
  createInitialFlightSearchForm,
} from '../constants/flightSearch'
import { mitrakamiApi } from '../services/mitrakamiApi'
import { mapFlightSearchPayload } from '../utils/flightSearchMapper'
import { sanitizePassengers, validateFlightSearchForm } from '../utils/flightSearchValidation'
import AppIcon from '../components/AppIcon'

const formatAirportLabel = (airport) => {
  if (!airport) {
    return ''
  }

  const city = String(airport?.city_name || airport?.city || airport?.name || '').trim()
  const iataCode = String(airport?.iata_code || airport?.code || '').trim().toUpperCase()

  if (city && iataCode) {
    return `${city} (${iataCode})`
  }

  return city || iataCode || ''
}

const formatPassengerSummary = (passengers) => {
  const safePassengers = sanitizePassengers(passengers)
  return `${safePassengers.adults} Dewasa, ${safePassengers.children} Anak, ${safePassengers.infants} Bayi`
}

const getTodayDateIso = () => {
  const now = new Date()
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return localDate.toISOString().slice(0, 10)
}

export default function FlightTicketSearchPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState(() => createInitialFlightSearchForm())
  const [originKeyword, setOriginKeyword] = useState('')
  const [destinationKeyword, setDestinationKeyword] = useState('')
  const [activeAirportField, setActiveAirportField] = useState('')
  const [airportOptions, setAirportOptions] = useState([])
  const [isAirportLoading, setIsAirportLoading] = useState(false)
  const [airlines, setAirlines] = useState([])
  const [isAirlinesLoading, setIsAirlinesLoading] = useState(false)
  const [requestError, setRequestError] = useState('')
  const [validationErrors, setValidationErrors] = useState({})
  const [searchResult, setSearchResult] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const airportRequestIdRef = useRef(0)
  const airportPanelRef = useRef(null)

  const todayDateIso = useMemo(() => getTodayDateIso(), [])

  const currentAirportKeyword = useMemo(() => {
    if (activeAirportField === 'origin') {
      return originKeyword
    }

    if (activeAirportField === 'destination') {
      return destinationKeyword
    }

    return ''
  }, [activeAirportField, destinationKeyword, originKeyword])

  const loadAirlines = useCallback(async () => {
    setIsAirlinesLoading(true)

    try {
      const payload = await mitrakamiApi.getFlightAirlines({
        flightScope: form.flightScope,
      })

      const nextAirlines = Array.isArray(payload?.airlines) ? payload.airlines : []
      setAirlines(nextAirlines)
    } catch {
      setAirlines([])
    } finally {
      setIsAirlinesLoading(false)
    }
  }, [form.flightScope])

  useEffect(() => {
    loadAirlines()
  }, [loadAirlines])

  useEffect(() => {
    const handleClickOutsideAirportPanel = (event) => {
      if (!activeAirportField) {
        return
      }

      const panelElement = airportPanelRef.current
      if (!panelElement) {
        return
      }

      if (panelElement.contains(event.target)) {
        return
      }

      setActiveAirportField('')
      setAirportOptions([])
    }

    window.addEventListener('mousedown', handleClickOutsideAirportPanel)

    return () => {
      window.removeEventListener('mousedown', handleClickOutsideAirportPanel)
    }
  }, [activeAirportField])

  useEffect(() => {
    const keyword = String(currentAirportKeyword || '').trim()

    if (!activeAirportField || keyword.length < 2) {
      setAirportOptions([])
      setIsAirportLoading(false)
      return undefined
    }

    const requestId = airportRequestIdRef.current + 1
    airportRequestIdRef.current = requestId

    const timeoutId = window.setTimeout(async () => {
      setIsAirportLoading(true)

      try {
        const payload = await mitrakamiApi.searchFlightAirports({
          keyword,
          flightScope: form.flightScope,
          limit: 8,
        })

        if (airportRequestIdRef.current !== requestId) {
          return
        }

        const nextAirports = Array.isArray(payload?.airports) ? payload.airports : []
        setAirportOptions(nextAirports)
      } catch {
        if (airportRequestIdRef.current !== requestId) {
          return
        }

        setAirportOptions([])
      } finally {
        if (airportRequestIdRef.current === requestId) {
          setIsAirportLoading(false)
        }
      }
    }, FLIGHT_SEARCH_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [activeAirportField, currentAirportKeyword, form.flightScope])

  const handleFlightScopeChange = (scopeKey) => {
    if (scopeKey === form.flightScope) {
      return
    }

    setForm((prevState) => ({
      ...prevState,
      flightScope: scopeKey,
      airlineCode: DEFAULT_AIRLINE_CODE,
      origin: null,
      destination: null,
    }))
    setOriginKeyword('')
    setDestinationKeyword('')
    setAirportOptions([])
    setRequestError('')
    setValidationErrors({})
  }

  const handleAirlineChange = (event) => {
    const nextAirlineCode = event.target.value

    setForm((prevState) => ({
      ...prevState,
      airlineCode: nextAirlineCode,
    }))
  }

  const handleRoundTripChange = (event) => {
    const isRoundTrip = event.target.checked

    setForm((prevState) => ({
      ...prevState,
      roundTrip: isRoundTrip,
      returnDate: isRoundTrip ? prevState.returnDate : '',
    }))

    setValidationErrors((prevState) => {
      if (!prevState.returnDate) {
        return prevState
      }

      const restErrors = { ...prevState }
      delete restErrors.returnDate
      return restErrors
    })
  }

  const handlePassengerChange = (type, nextValue) => {
    setForm((prevState) => ({
      ...prevState,
      passengers: {
        ...prevState.passengers,
        [type]: Number(nextValue),
      },
    }))

    setValidationErrors((prevState) => {
      if (!prevState.passengers) {
        return prevState
      }

      const restErrors = { ...prevState }
      delete restErrors.passengers
      return restErrors
    })
  }

  const handleAirportKeywordChange = (field, nextValue) => {
    setActiveAirportField(field)

    if (field === 'origin') {
      setOriginKeyword(nextValue)
      setForm((prevState) => ({
        ...prevState,
        origin: null,
      }))
    }

    if (field === 'destination') {
      setDestinationKeyword(nextValue)
      setForm((prevState) => ({
        ...prevState,
        destination: null,
      }))
    }

    setRequestError('')
    setValidationErrors((prevState) => {
      const nextErrors = { ...prevState }
      delete nextErrors[field]
      delete nextErrors.destination
      return nextErrors
    })
  }

  const handleSelectAirport = (airport) => {
    const label = formatAirportLabel(airport)

    if (activeAirportField === 'origin') {
      setForm((prevState) => ({
        ...prevState,
        origin: airport,
      }))
      setOriginKeyword(label)
    }

    if (activeAirportField === 'destination') {
      setForm((prevState) => ({
        ...prevState,
        destination: airport,
      }))
      setDestinationKeyword(label)
    }

    setAirportOptions([])
    setActiveAirportField('')
  }

  const handleSwapRoute = () => {
    setForm((prevState) => ({
      ...prevState,
      origin: prevState.destination,
      destination: prevState.origin,
    }))

    setOriginKeyword((prevState) => {
      const nextOrigin = destinationKeyword || formatAirportLabel(form.destination)
      return nextOrigin || prevState
    })

    setDestinationKeyword((prevState) => {
      const nextDestination = originKeyword || formatAirportLabel(form.origin)
      return nextDestination || prevState
    })

    setValidationErrors((prevState) => {
      const restErrors = { ...prevState }
      delete restErrors.destination
      delete restErrors.origin
      return restErrors
    })
  }

  const handleDateChange = (field, value) => {
    setForm((prevState) => ({
      ...prevState,
      [field]: value,
    }))

    setValidationErrors((prevState) => {
      if (!prevState[field]) {
        return prevState
      }

      const { [field]: _ignoredField, ...restErrors } = prevState
      return restErrors
    })
  }

  const handleSearchFlights = async (event) => {
    event.preventDefault()
    setRequestError('')
    setSearchResult(null)

    const checkResult = validateFlightSearchForm(form)
    if (!checkResult.isValid) {
      setValidationErrors(checkResult.errors)
      return
    }

    setValidationErrors({})
    setIsSubmitting(true)

    try {
      const payload = mapFlightSearchPayload({
        ...form,
        passengers: checkResult.passengers,
      })

      const response = await mitrakamiApi.searchFlights(payload)
      const totalFlights = Number(response?.meta?.total_results ?? response?.meta?.total ?? 0)

      setSearchResult({
        totalFlights,
      })
    } catch (error) {
      const responseMessage = error?.response?.data?.message
      setRequestError(responseMessage || 'Pencarian tiket belum tersedia. Silakan coba beberapa saat lagi.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const airlineOptions = useMemo(() => {
    return airlines.map((airline) => ({
      value: String(airline?.code || airline?.iata_code || '').trim(),
      label: String(airline?.name || airline?.airline_name || '').trim(),
    })).filter((airline) => airline.value && airline.label)
  }, [airlines])

  const passengerSummary = useMemo(() => {
    return formatPassengerSummary(form.passengers)
  }, [form.passengers])

  return (
    <div className="min-h-screen bg-background-app text-text-primary">
      <div className="mx-auto w-full max-w-md min-h-screen bg-background-app relative overflow-hidden pb-28">
        <div className="absolute top-0 left-0 h-48 w-full rounded-b-4xl bg-[#1E88E5]" />

        <div className="relative z-10 px-6 pt-12">
          <header className="mb-6 flex items-center justify-between text-white">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/app/home')}
                className="rounded-full p-1 transition-colors hover:bg-white/20"
                aria-label="Kembali"
              >
                <AppIcon name="arrow_back_ios_new" className="size-6" />
              </button>
              <h1 className="text-xl font-bold">Tiket Pesawat</h1>
            </div>

            <button
              type="button"
              onClick={() => navigate('/app/history')}
              className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-soft transition-colors hover:bg-primary-hover"
            >
              <AppIcon name="receipt_long" className="size-4" />
              Pesanan Saya
            </button>
          </header>

          <form onSubmit={handleSearchFlights} className="rounded-3xl border border-black/5 bg-surface p-5 shadow-soft">
            <div className="mb-5 flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-text-secondary">Flight</span>

              <div className="inline-flex rounded-xl bg-background-app p-1">
                {FLIGHT_SCOPE_OPTIONS.map((scope) => {
                  const isActive = form.flightScope === scope.key

                  return (
                    <button
                      key={scope.key}
                      type="button"
                      onClick={() => handleFlightScopeChange(scope.key)}
                      className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${isActive ? 'bg-surface text-text-primary shadow-soft' : 'text-text-secondary'}`}
                    >
                      {scope.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="mb-4 space-y-2">
              <label htmlFor="airline" className="text-sm font-semibold text-text-secondary">Maskapai</label>
              <div className="relative">
                <select
                  id="airline"
                  value={form.airlineCode}
                  onChange={handleAirlineChange}
                  disabled={isAirlinesLoading}
                  className="h-12 w-full appearance-none rounded-xl border border-black/10 bg-white px-4 pr-10 text-sm font-semibold outline-none transition-colors focus:border-[#1E88E5]"
                >
                  <option value={DEFAULT_AIRLINE_CODE}>Semua Maskapai</option>
                  {airlineOptions.map((airline) => (
                    <option key={airline.value} value={airline.value}>
                      {airline.label}
                    </option>
                  ))}
                </select>
                <AppIcon
                  name="expand_more"
                  className="size-4 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary"
                />
              </div>
            </div>

            <div className="mb-4 space-y-2">
              <p className="text-sm font-semibold text-text-secondary">Penumpang</p>
              <div className="rounded-xl border border-black/10 p-3">
                <p className="mb-3 text-sm font-semibold text-text-primary">{passengerSummary}</p>
                <div className="grid grid-cols-3 gap-3">
                  <label className="space-y-1 text-xs font-semibold text-text-secondary">
                    Dewasa
                    <select
                      value={form.passengers.adults}
                      onChange={(event) => handlePassengerChange('adults', event.target.value)}
                      className="h-10 w-full rounded-lg border border-black/10 px-2 text-sm text-text-primary outline-none focus:border-[#1E88E5]"
                    >
                      {Array.from({ length: PASSENGER_LIMITS.adults.max }, (_, index) => index + 1).map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1 text-xs font-semibold text-text-secondary">
                    Anak
                    <select
                      value={form.passengers.children}
                      onChange={(event) => handlePassengerChange('children', event.target.value)}
                      className="h-10 w-full rounded-lg border border-black/10 px-2 text-sm text-text-primary outline-none focus:border-[#1E88E5]"
                    >
                      {Array.from({ length: PASSENGER_LIMITS.children.max + 1 }, (_, index) => index).map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1 text-xs font-semibold text-text-secondary">
                    Bayi
                    <select
                      value={form.passengers.infants}
                      onChange={(event) => handlePassengerChange('infants', event.target.value)}
                      className="h-10 w-full rounded-lg border border-black/10 px-2 text-sm text-text-primary outline-none focus:border-[#1E88E5]"
                    >
                      {Array.from({ length: PASSENGER_LIMITS.infants.max + 1 }, (_, index) => index).map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
              {validationErrors.passengers ? <p className="text-xs text-red-500">{validationErrors.passengers}</p> : null}
            </div>

            <div className="my-4 h-px bg-black/10" />

            <div ref={airportPanelRef} className="relative mb-4 space-y-3">
              <label className="space-y-2 text-sm font-semibold text-text-secondary">
                Dari
                <div className="flex items-center rounded-xl border border-black/10 px-3">
                  <AppIcon name="flight_takeoff" className="size-5 mr-2 text-[#1E88E5]" />
                  <input
                    type="text"
                    value={originKeyword}
                    onFocus={() => setActiveAirportField('origin')}
                    onChange={(event) => handleAirportKeywordChange('origin', event.target.value)}
                    placeholder="Pilih Kota Asal"
                    className="h-12 w-full bg-transparent text-sm font-semibold outline-none"
                  />
                </div>
              </label>
              {validationErrors.origin ? <p className="text-xs text-red-500">{validationErrors.origin}</p> : null}

              <button
                type="button"
                onClick={handleSwapRoute}
                className="absolute left-1/2 top-1/2 z-10 size-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1E88E5] text-white shadow-soft transition-transform hover:scale-105"
                aria-label="Tukar kota"
              >
                <AppIcon name="swap_vert" className="size-5" />
              </button>

              <label className="space-y-2 pt-2 text-sm font-semibold text-text-secondary">
                Ke
                <div className="flex items-center rounded-xl border border-black/10 px-3">
                  <AppIcon name="flight_land" className="size-5 mr-2 text-[#1E88E5]" />
                  <input
                    type="text"
                    value={destinationKeyword}
                    onFocus={() => setActiveAirportField('destination')}
                    onChange={(event) => handleAirportKeywordChange('destination', event.target.value)}
                    placeholder="Pilih Kota Tujuan"
                    className="h-12 w-full bg-transparent text-sm font-semibold outline-none"
                  />
                </div>
              </label>
              {validationErrors.destination ? <p className="text-xs text-red-500">{validationErrors.destination}</p> : null}

              {activeAirportField ? (
                <div className="absolute left-0 right-0 top-[calc(100%+0.25rem)] z-20 overflow-hidden rounded-xl border border-black/10 bg-white shadow-soft">
                  {isAirportLoading ? (
                    <p className="px-4 py-3 text-sm text-text-secondary">Mencari bandara...</p>
                  ) : null}
                  {!isAirportLoading && airportOptions.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-text-secondary">Bandara tidak ditemukan.</p>
                  ) : null}
                  {!isAirportLoading && airportOptions.length > 0 ? (
                    <ul className="max-h-56 overflow-y-auto">
                      {airportOptions.map((airport) => {
                        const key = String(airport?.id || airport?.iata_code || airport?.code || airport?.name)
                        return (
                          <li key={key}>
                            <button
                              type="button"
                              onClick={() => handleSelectAirport(airport)}
                              className="w-full border-b border-black/5 px-4 py-3 text-left text-sm transition-colors last:border-b-0 hover:bg-primary-soft"
                            >
                              <p className="font-semibold text-text-primary">{formatAirportLabel(airport)}</p>
                              <p className="text-xs text-text-secondary">
                                {String(airport?.airport_name || airport?.name || '').trim() || 'Bandara'}
                              </p>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="my-4 h-px bg-black/10" />

            <div className="mb-4 flex items-center justify-end gap-2">
              <span className="text-xs font-semibold text-text-secondary">Pulang Pergi</span>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={form.roundTrip}
                  onChange={handleRoundTripChange}
                  className="peer sr-only"
                />
                <span className="h-6 w-11 rounded-full bg-black/10 transition-colors after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-[#1E88E5] peer-checked:after:translate-x-5" />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-2 text-sm font-semibold text-text-secondary">
                Tanggal Berangkat
                <div className="flex items-center rounded-xl border border-black/10 px-3">
                  <AppIcon name="calendar_month" className="size-5 mr-2 text-[#1E88E5]" />
                  <input
                    type="date"
                    value={form.departureDate}
                    min={todayDateIso}
                    onChange={(event) => handleDateChange('departureDate', event.target.value)}
                    className="h-12 w-full bg-transparent text-sm font-semibold outline-none"
                  />
                </div>
                {validationErrors.departureDate ? <p className="text-xs text-red-500">{validationErrors.departureDate}</p> : null}
              </label>

              <label className={`space-y-2 text-sm font-semibold ${form.roundTrip ? 'text-text-secondary' : 'text-text-secondary/50'}`}>
                Tanggal Pulang
                <div className="flex items-center rounded-xl border border-black/10 px-3">
                  <AppIcon name="calendar_month" className="size-5 mr-2 text-[#1E88E5]" />
                  <input
                    type="date"
                    value={form.returnDate}
                    min={form.departureDate || todayDateIso}
                    disabled={!form.roundTrip}
                    onChange={(event) => handleDateChange('returnDate', event.target.value)}
                    className="h-12 w-full bg-transparent text-sm font-semibold outline-none disabled:cursor-not-allowed"
                  />
                </div>
                {validationErrors.returnDate ? <p className="text-xs text-red-500">{validationErrors.returnDate}</p> : null}
              </label>
            </div>

            <div className="mt-4 space-y-2">
              <label htmlFor="cabinClass" className="text-sm font-semibold text-text-secondary">Kelas Penumpang</label>
              <div className="relative">
                <select
                  id="cabinClass"
                  value={form.cabinClass}
                  onChange={(event) => setForm((prevState) => ({ ...prevState, cabinClass: event.target.value }))}
                  className="h-12 w-full appearance-none rounded-xl border border-black/10 bg-white px-4 pr-10 text-sm font-semibold outline-none transition-colors focus:border-[#1E88E5]"
                >
                  {CABIN_CLASS_OPTIONS.map((cabinClass) => (
                    <option key={cabinClass.key} value={cabinClass.key}>{cabinClass.label}</option>
                  ))}
                </select>
                <AppIcon
                  name="airline_seat_recline_normal"
                  className="size-4 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary"
                />
              </div>
            </div>

            {requestError ? (
              <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
                {requestError}
              </div>
            ) : null}

            {searchResult ? (
              <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                Pencarian berhasil. Total pilihan tiket ditemukan: {searchResult.totalFlights}.
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white shadow-soft transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-70"
            >
              <AppIcon name="search" className="size-4" />
              {isSubmitting ? 'Mencari...' : 'Cari Tiket'}
            </button>
          </form>
        </div>

        <MobileBottomNav currentTab="home" />
      </div>
    </div>
  )
}
