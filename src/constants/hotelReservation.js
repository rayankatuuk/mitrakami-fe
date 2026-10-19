export const HOTEL_BED_TYPE_OPTIONS = [
  { key: 'single', label: 'Single' },
  { key: 'twin', label: 'Twin' },
  { key: 'double', label: 'Double' },
]

export const HOTEL_ROOM_LIMITS = {
  min: 1,
  max: 5,
}

export const HOTEL_SEARCH_DEBOUNCE_MS = 350

export const createInitialHotelReservationForm = () => ({
  paxPassport: 'ID',
  countryId: '',
  cityId: '',
  destinationKeyword: '',
  checkInDate: '',
  checkOutDate: '',
  rooms: 1,
  bedType: 'double',
})
