import { PASSENGER_LIMITS } from '../constants/flightSearch'

const normalizePassengerCount = (value, { min, max }) => {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue)) {
    return min
  }

  const boundedValue = Math.max(min, Math.min(max, Math.trunc(numericValue)))
  return boundedValue
}

export const sanitizePassengers = (passengers = {}) => {
  return {
    adults: normalizePassengerCount(passengers.adults, PASSENGER_LIMITS.adults),
    children: normalizePassengerCount(passengers.children, PASSENGER_LIMITS.children),
    infants: normalizePassengerCount(passengers.infants, PASSENGER_LIMITS.infants),
  }
}

const resolveAirportComparableCode = (airport) => {
  const iataCode = String(airport?.iata_code || airport?.code || '').trim().toUpperCase()
  const cityName = String(airport?.city_name || airport?.city || airport?.name || '').trim().toLowerCase()

  return iataCode || cityName
}

const getTodayDateIso = () => {
  const now = new Date()
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return localDate.toISOString().slice(0, 10)
}

export const validateFlightSearchForm = (form) => {
  const errors = {}
  const passengers = sanitizePassengers(form?.passengers)

  if (!form?.origin) {
    errors.origin = 'Kota asal wajib dipilih.'
  }

  if (!form?.destination) {
    errors.destination = 'Kota tujuan wajib dipilih.'
  }

  const originComparableCode = resolveAirportComparableCode(form?.origin)
  const destinationComparableCode = resolveAirportComparableCode(form?.destination)

  if (
    originComparableCode
    && destinationComparableCode
    && originComparableCode === destinationComparableCode
  ) {
    errors.destination = 'Kota asal dan tujuan tidak boleh sama.'
  }

  if (!form?.departureDate) {
    errors.departureDate = 'Tanggal berangkat wajib dipilih.'
  }

  const todayDate = getTodayDateIso()

  if (form?.departureDate && form.departureDate < todayDate) {
    errors.departureDate = 'Tanggal berangkat tidak boleh sebelum hari ini.'
  }

  if (form?.roundTrip) {
    if (!form?.returnDate) {
      errors.returnDate = 'Tanggal pulang wajib dipilih untuk perjalanan pulang pergi.'
    }

    if (form?.departureDate && form?.returnDate && form.returnDate < form.departureDate) {
      errors.returnDate = 'Tanggal pulang tidak boleh sebelum tanggal berangkat.'
    }
  }

  const totalPassengers = passengers.adults + passengers.children + passengers.infants

  if (passengers.adults < PASSENGER_LIMITS.adults.min) {
    errors.passengers = 'Minimal satu penumpang dewasa diperlukan.'
  }

  if (passengers.infants > passengers.adults) {
    errors.passengers = 'Jumlah bayi tidak boleh melebihi jumlah dewasa.'
  }

  if (totalPassengers > PASSENGER_LIMITS.total.max) {
    errors.passengers = 'Total penumpang melebihi batas maksimum.'
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    passengers,
  }
}
