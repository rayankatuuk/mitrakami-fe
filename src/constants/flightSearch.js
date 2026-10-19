export const FLIGHT_SCOPE_OPTIONS = [
  { key: 'domestic', label: 'Domestik' },
  { key: 'international', label: 'International' },
]

export const CABIN_CLASS_OPTIONS = [
  { key: 'economy', label: 'Economy' },
  { key: 'premium_economy', label: 'Premium Economy' },
  { key: 'business', label: 'Business' },
  { key: 'first', label: 'First Class' },
]

export const PASSENGER_LIMITS = {
  adults: {
    min: 1,
    max: 9,
  },
  children: {
    min: 0,
    max: 8,
  },
  infants: {
    min: 0,
    max: 4,
  },
  total: {
    max: 9,
  },
}

export const PASSENGER_DEFAULTS = {
  adults: 1,
  children: 0,
  infants: 0,
}

export const DEFAULT_AIRLINE_CODE = 'all'

export const FLIGHT_SEARCH_DEBOUNCE_MS = 350

export const createInitialFlightSearchForm = () => ({
  flightScope: FLIGHT_SCOPE_OPTIONS[0].key,
  airlineCode: DEFAULT_AIRLINE_CODE,
  roundTrip: false,
  origin: null,
  destination: null,
  departureDate: '',
  returnDate: '',
  passengers: {
    ...PASSENGER_DEFAULTS,
  },
  cabinClass: CABIN_CLASS_OPTIONS[0].key,
})
