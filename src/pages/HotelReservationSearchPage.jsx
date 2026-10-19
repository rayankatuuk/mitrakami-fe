import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MobileBottomNav from '../components/MobileBottomNav'
import {
  HOTEL_BED_TYPE_OPTIONS,
  HOTEL_ROOM_LIMITS,
  HOTEL_SEARCH_DEBOUNCE_MS,
  createInitialHotelReservationForm,
} from '../constants/hotelReservation'
import { mitrakamiApi } from '../services/mitrakamiApi'
import { mapHotelCheckoutPayload } from '../utils/hotelReservationCheckoutMapper'
import { mapHotelReservationSearchPayload } from '../utils/hotelReservationMapper'
import { validateHotelGuestForm } from '../utils/hotelReservationGuestValidation'
import { sanitizeRoomCount, validateHotelReservationForm } from '../utils/hotelReservationValidation'
import AppIcon from '../components/AppIcon'

const formatDateLabel = (dateIso) => {
  if (!dateIso) {
    return '-'
  }

  const date = new Date(`${dateIso}T00:00:00`)

  if (Number.isNaN(date.getTime())) {
    return dateIso
  }

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

const formatCurrency = (value) => {
  const amount = Number(value || 0)
  return `Rp ${amount.toLocaleString('id-ID')}`
}

const formatCityLabel = (city) => {
  if (!city) {
    return ''
  }

  const name = String(city?.name || city?.city_name || '').trim()
  return name
}

const getTomorrowDateIso = (baseDateIso = '') => {
  const baseDate = baseDateIso ? new Date(`${baseDateIso}T00:00:00`) : new Date()

  if (Number.isNaN(baseDate.getTime())) {
    return ''
  }

  const next = new Date(baseDate)
  next.setDate(next.getDate() + 1)

  return next.toISOString().slice(0, 10)
}

export default function HotelReservationSearchPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState('search')
  const [form, setForm] = useState(() => createInitialHotelReservationForm())
  const [countries, setCountries] = useState([])
  const [cities, setCities] = useState([])
  const [cityKeyword, setCityKeyword] = useState('')
  const [isCityPanelOpen, setIsCityPanelOpen] = useState(false)
  const [isLoadingCountries, setIsLoadingCountries] = useState(false)
  const [isLoadingCities, setIsLoadingCities] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [validationErrors, setValidationErrors] = useState({})
  const [requestError, setRequestError] = useState('')
  const [searchResult, setSearchResult] = useState(null)
  const [selectedHotel, setSelectedHotel] = useState(null)
  const [availableRoomsResult, setAvailableRoomsResult] = useState(null)
  const [isLoadingRooms, setIsLoadingRooms] = useState(false)
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [pricePolicyResult, setPricePolicyResult] = useState(null)
  const [isLoadingPricePolicy, setIsLoadingPricePolicy] = useState(false)
  const [guestForm, setGuestForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    requestDescription: '',
    agentOsRef: '',
  })
  const [guestValidationErrors, setGuestValidationErrors] = useState({})
  const [paymentMethod, setPaymentMethod] = useState('superpay')
  const [checkoutResult, setCheckoutResult] = useState(null)
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const [isRoomSheetOpen, setIsRoomSheetOpen] = useState(false)

  const cityRequestIdRef = useRef(0)
  const cityPanelRef = useRef(null)

  useEffect(() => {
    let isMounted = true

    const loadCountries = async () => {
      setIsLoadingCountries(true)

      try {
        const payload = await mitrakamiApi.getHotelCountries({ limit: 220 })

        if (!isMounted) {
          return
        }

        const rows = Array.isArray(payload?.countries) ? payload.countries : []
        setCountries(rows)

        const indonesia = rows.find((country) => String(country?.name || '').toLowerCase() === 'indonesia')
        if (indonesia?.id) {
          setForm((prevState) => ({
            ...prevState,
            countryId: String(indonesia.id),
          }))
        } else if (rows[0]?.id) {
          setForm((prevState) => ({
            ...prevState,
            countryId: String(rows[0].id),
          }))
        }
      } catch {
        if (isMounted) {
          setCountries([])
        }
      } finally {
        if (isMounted) {
          setIsLoadingCountries(false)
        }
      }
    }

    loadCountries()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!form.countryId) {
      setCities([])
      setCityKeyword('')
      setForm((prevState) => ({
        ...prevState,
        cityId: '',
      }))
    }
  }, [form.countryId])

  useEffect(() => {
    const handleClickOutsideCityPanel = (event) => {
      if (!isCityPanelOpen) {
        return
      }

      const panelElement = cityPanelRef.current
      if (!panelElement) {
        return
      }

      if (panelElement.contains(event.target)) {
        return
      }

      setIsCityPanelOpen(false)
    }

    window.addEventListener('mousedown', handleClickOutsideCityPanel)

    return () => {
      window.removeEventListener('mousedown', handleClickOutsideCityPanel)
    }
  }, [isCityPanelOpen])

  useEffect(() => {
    const keyword = String(cityKeyword || '').trim()

    if (!form.countryId || keyword.length < 2) {
      setCities([])
      setIsLoadingCities(false)
      return undefined
    }

    const requestId = cityRequestIdRef.current + 1
    cityRequestIdRef.current = requestId

    const timeoutId = window.setTimeout(async () => {
      setIsLoadingCities(true)

      try {
        const payload = await mitrakamiApi.getHotelCities({
          countryId: form.countryId,
          keyword,
          limit: 30,
        })

        if (cityRequestIdRef.current !== requestId) {
          return
        }

        const rows = Array.isArray(payload?.cities) ? payload.cities : []
        setCities(rows)
      } catch {
        if (cityRequestIdRef.current === requestId) {
          setCities([])
        }
      } finally {
        if (cityRequestIdRef.current === requestId) {
          setIsLoadingCities(false)
        }
      }
    }, HOTEL_SEARCH_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [cityKeyword, form.countryId])

  const selectedBedLabel = useMemo(() => {
    const selected = HOTEL_BED_TYPE_OPTIONS.find((option) => option.key === form.bedType)
    return selected?.label || '-'
  }, [form.bedType])

  const durationNight = useMemo(() => {
    if (!form.checkInDate || !form.checkOutDate) {
      return 0
    }

    const checkIn = new Date(`${form.checkInDate}T00:00:00`)
    const checkOut = new Date(`${form.checkOutDate}T00:00:00`)

    if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) {
      return 0
    }

    const diffMs = checkOut.getTime() - checkIn.getTime()

    if (diffMs <= 0) {
      return 0
    }

    return Math.round(diffMs / (24 * 60 * 60 * 1000))
  }, [form.checkInDate, form.checkOutDate])

  const handleSearchHotels = async (event) => {
    event.preventDefault()
    setRequestError('')
    setSearchResult(null)

    const validationResult = validateHotelReservationForm(form)
    if (!validationResult.isValid) {
      setValidationErrors(validationResult.errors)
      return
    }

    setValidationErrors({})
    setIsSubmitting(true)

    try {
      const payload = mapHotelReservationSearchPayload({
        ...form,
        rooms: validationResult.rooms,
      })

      const response = await mitrakamiApi.searchHotels(payload)
      const items = Array.isArray(response?.items) ? response.items : []

      setSearchResult({
        totalHotels: Number(response?.meta?.total_results ?? items.length),
        items,
      })
      setStep('search-result')
    } catch (error) {
      const responseMessage = error?.response?.data?.message
      setRequestError(responseMessage || 'Pencarian hotel belum tersedia. Silakan coba beberapa saat lagi.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSelectHotel = async (hotel) => {
    setSelectedHotel(hotel)
    setSelectedRoom(null)
    setAvailableRoomsResult(null)
    setPricePolicyResult(null)
    setRequestError('')
    setIsLoadingRooms(true)

    try {
      const payload = mapHotelReservationSearchPayload(form)
      const roomsResponse = await mitrakamiApi.getHotelAvailableRooms({
        ...payload,
        hotel_id: hotel.hotel_id,
      })

      const rooms = Array.isArray(roomsResponse?.rooms) ? roomsResponse.rooms : []
      setAvailableRoomsResult({
        hotel: roomsResponse?.hotel || hotel,
        rooms,
      })

      if (rooms[0]) {
        setSelectedRoom(rooms[0])
      }

      setStep('room-select')
    } catch (error) {
      const responseMessage = error?.response?.data?.message
      setRequestError(responseMessage || 'Data kamar hotel belum tersedia.')
    } finally {
      setIsLoadingRooms(false)
    }
  }

  const handleChooseRoom = async (room) => {
    if (!selectedHotel) {
      return
    }

    setSelectedRoom(room)
    setPricePolicyResult(null)
    setRequestError('')
    setIsLoadingPricePolicy(true)

    try {
      const payload = mapHotelReservationSearchPayload(form)
      const response = await mitrakamiApi.getHotelPricePolicy({
        ...payload,
        hotel_id: selectedHotel.hotel_id,
        internal_code: selectedHotel.internal_code,
        breakfast: room.breakfast,
        room_id: room.room_id,
      })

      setPricePolicyResult(response?.data || null)
    } catch {
      setPricePolicyResult(null)
    } finally {
      setIsLoadingPricePolicy(false)
    }

    setStep('guest-detail')
  }

  const handleContinueToPayment = () => {
    const validation = validateHotelGuestForm(guestForm)
    if (!validation.isValid) {
      setGuestValidationErrors(validation.errors)
      return
    }

    setGuestValidationErrors({})
    setStep('payment-method')
  }

  const handleCheckout = async () => {
    if (!selectedHotel || !selectedRoom) {
      return
    }

    setCheckoutError('')
    setIsCheckingOut(true)

    try {
      const payload = mapHotelCheckoutPayload({
        searchForm: form,
        selectedHotel,
        selectedRoom,
        guestForm,
        autoIssue: paymentMethod === 'superpay',
      })

      const response = await mitrakamiApi.checkoutHotel(payload)
      setCheckoutResult(response?.data || null)

      const bookingStatus = String(
        response?.data?.detail?.bookingDetail?.bookingStatus
        || response?.data?.issued?.bookingStatus
        || response?.data?.booking?.bookingStatus
        || '',
      ).toLowerCase()

      if (bookingStatus.includes('cancel') || bookingStatus.includes('fail')) {
        setStep('payment-failed')
        return
      }

      setStep('payment-success')
    } catch (error) {
      const responseMessage = error?.response?.data?.message
      setCheckoutError(responseMessage || 'Checkout hotel gagal diproses.')
      setStep('payment-failed')
    } finally {
      setIsCheckingOut(false)
    }
  }

  const totalPayment = useMemo(() => {
    if (pricePolicyResult?.totalPrice != null) {
      return Number(pricePolicyResult.totalPrice)
    }

    if (selectedRoom?.price != null) {
      return Number(selectedRoom.price) * Number(form.rooms || 1)
    }

    return 0
  }, [form.rooms, pricePolicyResult?.totalPrice, selectedRoom?.price])

  const renderSearchStep = () => (
    <>
      <form onSubmit={handleSearchHotels} className="rounded-3xl border border-black/5 bg-surface p-5 shadow-soft">
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-secondary">Kewarganegaraan</label>
            <select
              value={form.countryId}
              onChange={(event) => {
                setForm((prevState) => ({
                  ...prevState,
                  countryId: event.target.value,
                  cityId: '',
                }))
                setValidationErrors((prevState) => ({ ...prevState, countryId: '', cityId: '' }))
              }}
              className="h-12 w-full rounded-xl border border-black/10 bg-white px-3 text-sm focus:border-[#2f834f] focus:outline-none"
              disabled={isLoadingCountries}
            >
              <option value="">Pilih kewarganegaraan</option>
              {countries.map((country) => (
                <option key={country.id} value={country.id}>
                  {country.name}
                </option>
              ))}
            </select>
            {validationErrors.countryId ? <p className="mt-1 text-xs text-red-500">{validationErrors.countryId}</p> : null}
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-secondary">Tujuan</label>
            <div className="relative" ref={cityPanelRef}>
              <input
                value={cityKeyword}
                onChange={(event) => {
                  const nextKeyword = event.target.value
                  setCityKeyword(nextKeyword)
                  setIsCityPanelOpen(true)
                  setForm((prevState) => ({
                    ...prevState,
                    cityId: '',
                  }))
                  setValidationErrors((prevState) => ({ ...prevState, cityId: '' }))
                }}
                onFocus={() => setIsCityPanelOpen(true)}
                placeholder={form.countryId ? 'Ketik nama kota tujuan' : 'Pilih kewarganegaraan dulu'}
                className="h-12 w-full rounded-xl border border-black/10 bg-white px-3 text-sm focus:border-[#2f834f] focus:outline-none"
                disabled={!form.countryId}
              />
              {isCityPanelOpen ? (
                <div className="absolute z-20 mt-2 w-full rounded-2xl border border-black/10 bg-white shadow-soft">
                  {isLoadingCities ? (
                    <div className="px-4 py-3 text-sm text-text-secondary">Memuat kota...</div>
                  ) : null}
                  {!isLoadingCities && cities.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-text-secondary">Kota tidak ditemukan.</div>
                  ) : null}
                  {!isLoadingCities && cities.length > 0 ? (
                    <div className="max-h-56 overflow-y-auto">
                      {cities.map((city) => (
                        <button
                          key={city.id}
                          type="button"
                          onClick={() => {
                            const label = formatCityLabel(city)
                            setForm((prevState) => ({
                              ...prevState,
                              cityId: String(city.id),
                            }))
                            setCityKeyword(label)
                            setIsCityPanelOpen(false)
                          }}
                          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-gray-50"
                        >
                          <span className="font-medium text-text-primary">{formatCityLabel(city)}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            {validationErrors.cityId ? <p className="mt-1 text-xs text-red-500">{validationErrors.cityId}</p> : null}
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-secondary">Nama hotel (opsional)</label>
            <input
              value={form.destinationKeyword}
              onChange={(event) => {
                setForm((prevState) => ({
                  ...prevState,
                  destinationKeyword: event.target.value,
                }))
              }}
              placeholder="Contoh: Aston, Harris"
              className="h-12 w-full rounded-xl border border-black/10 bg-white px-3 text-sm focus:border-[#2f834f] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-secondary">Check-in</label>
              <input
                type="date"
                value={form.checkInDate}
                onChange={(event) => {
                  const nextCheckInDate = event.target.value

                  setForm((prevState) => {
                    const fallbackCheckOut = getTomorrowDateIso(nextCheckInDate)
                    const shouldResetCheckOut = !prevState.checkOutDate || prevState.checkOutDate <= nextCheckInDate

                    return {
                      ...prevState,
                      checkInDate: nextCheckInDate,
                      checkOutDate: shouldResetCheckOut ? fallbackCheckOut : prevState.checkOutDate,
                    }
                  })

                  setValidationErrors((prevState) => ({
                    ...prevState,
                    checkInDate: '',
                    checkOutDate: '',
                  }))
                }}
                className="h-12 w-full rounded-xl border border-black/10 bg-white px-3 text-sm focus:border-[#2f834f] focus:outline-none"
              />
              {validationErrors.checkInDate ? <p className="mt-1 text-xs text-red-500">{validationErrors.checkInDate}</p> : null}
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-secondary">Check-out</label>
              <input
                type="date"
                value={form.checkOutDate}
                onChange={(event) => {
                  setForm((prevState) => ({
                    ...prevState,
                    checkOutDate: event.target.value,
                  }))
                  setValidationErrors((prevState) => ({ ...prevState, checkOutDate: '' }))
                }}
                className="h-12 w-full rounded-xl border border-black/10 bg-white px-3 text-sm focus:border-[#2f834f] focus:outline-none"
              />
              {validationErrors.checkOutDate ? <p className="mt-1 text-xs text-red-500">{validationErrors.checkOutDate}</p> : null}
            </div>
          </div>

          <div className="rounded-xl border border-black/10 bg-[#f7faf8] p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">Durasi</span>
              <span className="font-semibold text-[#2f834f]">{durationNight} Malam</span>
            </div>
            <div className="mt-1 text-xs text-text-secondary">
              {formatDateLabel(form.checkInDate)} - {formatDateLabel(form.checkOutDate)}
            </div>
          </div>

          <div className="rounded-xl border border-black/10 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold">Room Options</span>
              <button
                type="button"
                onClick={() => setIsRoomSheetOpen(true)}
                className="text-xs font-semibold text-primary"
              >
                Ubah
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-lg border border-black/10 bg-[#f8fafc] px-3 py-2 text-sm">
                <span className="text-text-secondary">Kamar</span>
                <select
                  value={form.rooms}
                  onChange={(event) => {
                    setForm((prevState) => ({
                      ...prevState,
                      rooms: sanitizeRoomCount(event.target.value),
                    }))
                  }}
                  className="rounded-md border border-black/10 bg-white px-2 py-1 text-sm"
                >
                  {Array.from({ length: HOTEL_ROOM_LIMITS.max }).map((_, index) => {
                    const value = index + 1

                    return (
                      <option key={value} value={value}>
                        {value} Kamar
                      </option>
                    )
                  })}
                </select>
              </div>

              <button
                type="button"
                onClick={() => setIsRoomSheetOpen(true)}
                className="flex w-full items-center justify-between rounded-lg border border-black/10 bg-[#f8fafc] px-3 py-2 text-sm"
              >
                <span className="text-text-secondary">Tipe tempat tidur</span>
                <span className="font-semibold">{selectedBedLabel}</span>
              </button>
            </div>

            {validationErrors.bedType ? <p className="mt-2 text-xs text-red-500">{validationErrors.bedType}</p> : null}
          </div>

          {requestError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {requestError}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
          >
            <AppIcon name="search" className="size-5" />
            {isSubmitting ? 'Mencari Hotel...' : 'Cari Hotel'}
          </button>
        </div>
      </form>

      {searchResult ? (
        <section className="mt-5 rounded-3xl border border-black/5 bg-surface p-4 shadow-soft">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold">Hasil Pencarian</h2>
            <span className="text-xs text-text-secondary">{searchResult.totalHotels} hotel</span>
          </div>

          {searchResult.items.length === 0 ? (
            <p className="text-sm text-text-secondary">Hotel tidak ditemukan untuk filter saat ini.</p>
          ) : (
            <div className="space-y-3">
              {searchResult.items.slice(0, 8).map((hotel) => (
                <button
                  key={hotel.hotel_id}
                  type="button"
                  onClick={() => handleSelectHotel(hotel)}
                  className="w-full rounded-2xl border border-black/10 p-3 text-left"
                >
                  <h3 className="text-sm font-semibold line-clamp-1">{hotel.name}</h3>
                  <p className="mt-1 text-xs text-text-secondary line-clamp-2">{hotel.address || 'Alamat belum tersedia'}</p>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-[#2f834f]">⭐ {Number(hotel.rating || 0).toFixed(1)}</span>
                    <span className="font-semibold text-primary">{formatCurrency(hotel.price_start)}/malam</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </>
  )

  const renderRoomSelectStep = () => (
    <section className="rounded-3xl border border-black/5 bg-surface p-4 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-bold">Pilih Tipe Kamar</h2>
        <button
          type="button"
          onClick={() => setStep('search-result')}
          className="text-xs font-semibold text-primary"
        >
          Ganti Hotel
        </button>
      </div>

      {isLoadingRooms ? (
        <p className="text-sm text-text-secondary">Memuat ketersediaan kamar...</p>
      ) : null}

      {!isLoadingRooms && availableRoomsResult?.rooms?.length ? (
        <div className="space-y-3">
          {availableRoomsResult.rooms.map((room) => (
            <button
              key={room.room_id}
              type="button"
              onClick={() => handleChooseRoom(room)}
              className="w-full rounded-2xl border border-black/10 p-3 text-left"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold">{room.name}</h3>
                  <p className="mt-1 text-xs text-text-secondary">{room.booking_type || 'booking'}</p>
                </div>
                <span className="text-sm font-bold text-primary">{formatCurrency(room.price)}</span>
              </div>
            </button>
          ))}
        </div>
      ) : null}

      {!isLoadingRooms && (!availableRoomsResult?.rooms || availableRoomsResult.rooms.length === 0) ? (
        <p className="text-sm text-text-secondary">Kamar tidak tersedia untuk hotel ini.</p>
      ) : null}
    </section>
  )

  const renderGuestStep = () => (
    <section className="rounded-3xl border border-black/5 bg-surface p-4 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-bold">Data Tamu</h2>
        <button
          type="button"
          onClick={() => setStep('room-select')}
          className="text-xs font-semibold text-primary"
        >
          Kembali
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-secondary">Nama lengkap</label>
          <input
            value={guestForm.fullName}
            onChange={(event) => {
              setGuestForm((prevState) => ({ ...prevState, fullName: event.target.value }))
              setGuestValidationErrors((prevState) => ({ ...prevState, fullName: '' }))
            }}
            className="h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm focus:border-[#2f834f] focus:outline-none"
            placeholder="Contoh: Budi Santoso"
          />
          {guestValidationErrors.fullName ? <p className="mt-1 text-xs text-red-500">{guestValidationErrors.fullName}</p> : null}
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-secondary">Email</label>
          <input
            value={guestForm.email}
            onChange={(event) => {
              setGuestForm((prevState) => ({ ...prevState, email: event.target.value }))
              setGuestValidationErrors((prevState) => ({ ...prevState, email: '' }))
            }}
            type="email"
            className="h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm focus:border-[#2f834f] focus:outline-none"
            placeholder="nama@email.com"
          />
          {guestValidationErrors.email ? <p className="mt-1 text-xs text-red-500">{guestValidationErrors.email}</p> : null}
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-secondary">Nomor telepon</label>
          <input
            value={guestForm.phone}
            onChange={(event) => {
              setGuestForm((prevState) => ({ ...prevState, phone: event.target.value }))
              setGuestValidationErrors((prevState) => ({ ...prevState, phone: '' }))
            }}
            className="h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm focus:border-[#2f834f] focus:outline-none"
            placeholder="081234567890"
          />
          {guestValidationErrors.phone ? <p className="mt-1 text-xs text-red-500">{guestValidationErrors.phone}</p> : null}
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-secondary">Permintaan khusus (opsional)</label>
          <textarea
            value={guestForm.requestDescription}
            onChange={(event) => {
              setGuestForm((prevState) => ({ ...prevState, requestDescription: event.target.value }))
            }}
            rows={3}
            className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:border-[#2f834f] focus:outline-none"
            placeholder="Contoh: kamar bebas asap rokok"
          />
        </div>

        {selectedRoom ? (
          <div className="rounded-xl border border-black/10 bg-[#f8fafc] p-3 text-xs text-text-secondary">
            <p className="font-semibold text-text-primary">{selectedRoom.name}</p>
            <p className="mt-1">Estimasi: {formatCurrency(totalPayment)}</p>
            {isLoadingPricePolicy ? <p className="mt-1 text-[#2f834f]">Memuat kebijakan harga...</p> : null}
          </div>
        ) : null}

        <button
          type="button"
          onClick={handleContinueToPayment}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-white transition-colors hover:bg-primary-hover"
        >
          Lanjut ke Pembayaran
        </button>
      </div>
    </section>
  )

  const renderPaymentStep = () => (
    <section className="rounded-3xl border border-black/5 bg-surface p-4 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-bold">Metode Pembayaran</h2>
        <button
          type="button"
          onClick={() => setStep('guest-detail')}
          className="text-xs font-semibold text-primary"
        >
          Kembali
        </button>
      </div>

      <div className="space-y-2">
        {[
          { key: 'superpay', label: 'SuperPay (Auto Issued)' },
          { key: 'va', label: 'Virtual Account' },
          { key: 'bank-transfer', label: 'Transfer Bank' },
        ].map((method) => (
          <label key={method.key} className="flex cursor-pointer items-center justify-between rounded-xl border border-black/10 px-3 py-2">
            <span className="text-sm">{method.label}</span>
            <input
              type="radio"
              name="hotel_payment_method"
              checked={paymentMethod === method.key}
              onChange={() => setPaymentMethod(method.key)}
              className="text-primary"
            />
          </label>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-black/10 bg-[#f8fafc] p-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-secondary">Total</span>
          <span className="font-bold text-primary">{formatCurrency(totalPayment)}</span>
        </div>
      </div>

      {checkoutError ? <p className="mt-3 text-xs text-red-500">{checkoutError}</p> : null}

      <button
        type="button"
        disabled={isCheckingOut}
        onClick={handleCheckout}
        className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
      >
        {isCheckingOut ? 'Memproses Pembayaran...' : 'Bayar Sekarang'}
      </button>
    </section>
  )

  const renderSuccessStep = () => (
    <section className="rounded-3xl border border-green-200 bg-green-50 p-5 shadow-soft">
      <div className="flex flex-col items-center text-center">
        <AppIcon name="check_circle" className="size-12 text-green-600" />
        <h2 className="mt-2 text-lg font-bold text-green-700">Pembayaran Sukses</h2>
        <p className="mt-1 text-sm text-green-700/80">Reservasi hotel Anda berhasil diproses.</p>
        <div className="mt-4 w-full rounded-xl bg-white p-3 text-left text-sm text-text-secondary">
          <p><span className="font-semibold text-text-primary">Reservation:</span> {checkoutResult?.reservation_no || '-'}</p>
          <p className="mt-1"><span className="font-semibold text-text-primary">Status:</span> {checkoutResult?.detail?.bookingDetail?.bookingStatus || checkoutResult?.issued?.bookingStatus || checkoutResult?.booking?.bookingStatus || '-'}</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/app/history')}
          className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white"
        >
          Lihat Riwayat
        </button>
      </div>
    </section>
  )

  const renderFailedStep = () => (
    <section className="rounded-3xl border border-red-200 bg-red-50 p-5 shadow-soft">
      <div className="flex flex-col items-center text-center">
        <AppIcon name="error" className="size-12 text-red-500" />
        <h2 className="mt-2 text-lg font-bold text-red-600">Pembayaran Gagal</h2>
        <p className="mt-1 text-sm text-red-600/80">Silakan coba lagi atau ganti metode pembayaran.</p>
        {checkoutError ? <p className="mt-2 text-xs text-red-600">{checkoutError}</p> : null}
        <div className="mt-4 flex w-full gap-2">
          <button
            type="button"
            onClick={() => setStep('payment-method')}
            className="flex-1 rounded-xl border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-600"
          >
            Coba Lagi
          </button>
          <button
            type="button"
            onClick={() => navigate('/app/home')}
            className="flex-1 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white"
          >
            Ke Beranda
          </button>
        </div>
      </div>
    </section>
  )

  return (
    <div className="min-h-screen bg-background-app text-text-primary">
      <div className="mx-auto w-full max-w-md min-h-screen bg-background-app relative overflow-hidden pb-28">
        <div className="absolute top-0 left-0 h-56 w-full rounded-b-4xl bg-[#2f834f]" />

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
              <h1 className="text-xl font-bold">Reservasi Hotel</h1>
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

          {step === 'search' || step === 'search-result' ? renderSearchStep() : null}
          {step === 'room-select' ? renderRoomSelectStep() : null}
          {step === 'guest-detail' ? renderGuestStep() : null}
          {step === 'payment-method' ? renderPaymentStep() : null}
          {step === 'payment-success' ? renderSuccessStep() : null}
          {step === 'payment-failed' ? renderFailedStep() : null}
        </div>

        <MobileBottomNav currentTab="home" />

        {isRoomSheetOpen ? (
          <div className="fixed inset-0 z-40 mx-auto flex w-full max-w-md items-end bg-black/35">
            <button
              type="button"
              aria-label="Tutup pilihan kamar"
              onClick={() => setIsRoomSheetOpen(false)}
              className="absolute inset-0"
            />

            <section className="relative z-10 w-full rounded-t-3xl bg-white p-5 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-bold">Kamar 1</h3>
                <button
                  type="button"
                  onClick={() => setIsRoomSheetOpen(false)}
                  className="rounded-full p-1 text-text-secondary hover:bg-black/5"
                  aria-label="Tutup"
                >
                  <AppIcon name="close" className="size-4" />
                </button>
              </div>

              <div className="divide-y divide-black/10">
                {HOTEL_BED_TYPE_OPTIONS.map((option) => {
                  const isActive = form.bedType === option.key

                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => {
                        setForm((prevState) => ({
                          ...prevState,
                          bedType: option.key,
                        }))
                        setValidationErrors((prevState) => ({ ...prevState, bedType: '' }))
                        setIsRoomSheetOpen(false)
                      }}
                      className="flex w-full items-center justify-between py-3 text-left"
                    >
                      <span className="text-sm font-medium">{option.label}</span>
                      {isActive ? <AppIcon name="check" className="size-4 text-primary" /> : null}
                    </button>
                  )
                })}
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  )
}
