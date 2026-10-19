import { HOTEL_ROOM_LIMITS } from '../constants/hotelReservation'

const getTodayDateIso = () => {
  const now = new Date()
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return localDate.toISOString().slice(0, 10)
}

export const sanitizeRoomCount = (value) => {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue)) {
    return HOTEL_ROOM_LIMITS.min
  }

  return Math.max(HOTEL_ROOM_LIMITS.min, Math.min(HOTEL_ROOM_LIMITS.max, Math.trunc(numericValue)))
}

export const validateHotelReservationForm = (form) => {
  const errors = {}
  const rooms = sanitizeRoomCount(form?.rooms)

  if (!form?.countryId) {
    errors.countryId = 'Kewarganegaraan wajib dipilih.'
  }

  if (!form?.cityId) {
    errors.cityId = 'Kota tujuan wajib dipilih.'
  }

  if (!form?.checkInDate) {
    errors.checkInDate = 'Tanggal check-in wajib dipilih.'
  }

  if (!form?.checkOutDate) {
    errors.checkOutDate = 'Tanggal check-out wajib dipilih.'
  }

  const todayDate = getTodayDateIso()

  if (form?.checkInDate && form.checkInDate < todayDate) {
    errors.checkInDate = 'Tanggal check-in tidak boleh sebelum hari ini.'
  }

  if (form?.checkInDate && form?.checkOutDate && form.checkOutDate <= form.checkInDate) {
    errors.checkOutDate = 'Tanggal check-out harus setelah check-in.'
  }

  if (!form?.bedType) {
    errors.bedType = 'Tipe tempat tidur wajib dipilih.'
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    rooms,
  }
}
