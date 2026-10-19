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

const normalizeGuestName = (fullName = '') => {
  const cleanName = String(fullName).trim().replace(/\s+/g, ' ')

  if (!cleanName) {
    return {
      firstName: '',
      lastName: '',
    }
  }

  const [firstName, ...restNames] = cleanName.split(' ')

  return {
    firstName,
    lastName: restNames.join(' ') || '-',
  }
}

const normalizePhone = (phone = '') => {
  const numeric = String(phone).replace(/[^0-9]/g, '')

  if (!numeric) {
    return ''
  }

  if (numeric.startsWith('62')) {
    return numeric
  }

  if (numeric.startsWith('0')) {
    return `62${numeric.slice(1)}`
  }

  return `62${numeric}`
}

const generateAgentOsRef = () => {
  const timestamp = Date.now().toString(36).toUpperCase()
  const randomToken = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `HTL-${timestamp}-${randomToken}`
}

export const mapHotelCheckoutPayload = ({
  searchForm,
  selectedHotel,
  selectedRoom,
  guestForm,
  autoIssue = true,
}) => {
  const guestName = normalizeGuestName(guestForm?.fullName)
  const normalizedPhone = normalizePhone(guestForm?.phone)

  const payload = {
    pax_passport: searchForm?.paxPassport || 'ID',
    country_id: searchForm?.countryId,
    city_id: searchForm?.cityId,
    check_in_date: searchForm?.checkInDate,
    check_out_date: searchForm?.checkOutDate,
    rooms: Number(searchForm?.rooms || 1),
    bed_type: searchForm?.bedType,
    internal_code: selectedHotel?.internal_code || selectedHotel?.raw?.internalCode,
    hotel_id: selectedHotel?.hotel_id,
    breakfast: selectedRoom?.breakfast,
    room_id: selectedRoom?.room_id,
    request_description: guestForm?.requestDescription,
    guest_title: 'MR',
    guest_first_name: guestName.firstName,
    guest_last_name: guestName.lastName,
    guest_phone: normalizedPhone,
    guest_email: String(guestForm?.email || '').trim(),
    agent_os_ref: guestForm?.agentOsRef || generateAgentOsRef(),
    contact_name: String(guestForm?.fullName || '').trim(),
    contact_phone: normalizedPhone,
    auto_issue: Boolean(autoIssue),
  }

  return removeEmptyValues(payload)
}
