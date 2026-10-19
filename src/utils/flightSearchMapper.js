import { DEFAULT_AIRLINE_CODE } from '../constants/flightSearch'
import { sanitizePassengers } from './flightSearchValidation'

const removeEmptyValues = (payload) => {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => {
      if (value === undefined || value === null || value === '') {
        return false
      }

      return true
    }),
  )
}

const mapAirportCode = (airport) => {
  return String(airport?.iata_code || airport?.code || '').trim().toUpperCase()
}

export const mapFlightSearchPayload = (form) => {
  const passengers = sanitizePassengers(form?.passengers)

  const payload = {
    flight_scope: form?.flightScope,
    airline_code: form?.airlineCode === DEFAULT_AIRLINE_CODE ? undefined : form?.airlineCode,
    trip_type: form?.roundTrip ? 'round_trip' : 'one_way',
    origin_code: mapAirportCode(form?.origin),
    destination_code: mapAirportCode(form?.destination),
    departure_date: form?.departureDate,
    return_date: form?.roundTrip ? form?.returnDate : undefined,
    cabin_class: form?.cabinClass,
    passengers,
  }

  return removeEmptyValues(payload)
}
