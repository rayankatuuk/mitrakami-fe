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

export const mapHotelReservationSearchPayload = (form) => {
  const payload = {
    pax_passport: form?.paxPassport,
    country_id: form?.countryId,
    city_id: form?.cityId,
    destination_keyword: form?.destinationKeyword,
    check_in_date: form?.checkInDate,
    check_out_date: form?.checkOutDate,
    rooms: Number(form?.rooms || 1),
    bed_type: form?.bedType,
  }

  return removeEmptyValues(payload)
}
