import apiClient, { ensureCsrfCookie } from './apiClient'

export const mitrakamiApi = {
  loginMember: async ({ distributorId, password, remember = false }) => {
    if (import.meta.env.MODE !== 'capacitor') {
      try {
        await ensureCsrfCookie()
      } catch {
        // Browser deployments may use Sanctum cookies; token APIs can still
        // accept login without the optional CSRF preflight.
      }
    }

    const { data: loginData } = await apiClient.post('/api/auth/login', {
      distributor_id: distributorId,
      password,
      remember,
    })

    return {
      ...loginData,
      user: loginData?.user ?? null,
    }
  },
  getAuthenticatedUser: async () => {
    const { data } = await apiClient.get('/api/auth/user')
    return data
  },
  logoutMember: async () => {
    const { data } = await apiClient.post('/api/auth/logout')
    return data
  },
  getCurrentMember: async () => {
    const { data } = await apiClient.get('/api/member/profile')
    return data
  },
  getDashboardSummary: async () => {
    const { data } = await apiClient.get('/api/member/dashboard')
    return data
  },
  getActiveTopUp: async () => {
    const { data } = await apiClient.get('/api/member/topups/active')
    return data
  },
  createTopUpOrder: async ({ amount, bankCode }) => {
    await ensureCsrfCookie()
    const { data } = await apiClient.post('/api/member/topups', {
      amount,
      bank_code: bankCode,
    })
    return data
  },
  cancelActiveTopUp: async () => {
    await ensureCsrfCookie()
    const { data } = await apiClient.post('/api/member/topups/active/cancel')
    return data
  },
  confirmTopUpOrder: async ({ reference }) => {
    await ensureCsrfCookie()
    const { data } = await apiClient.post('/api/member/topups/confirm', {
      reference,
    })
    return data
  },
  getTransactionHistory: async (params = {}) => {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
    )

    const { data } = await apiClient.get('/api/member/transactions/history', {
      params: cleanParams,
    })

    return data
  },
  getPulsaInit: async () => {
    const { data } = await apiClient.get('/api/member/pulsa/init')
    return data
  },
  getPulsaProducts: async ({ operatorCode, productType, supplierCode }) => {
    const { data } = await apiClient.get('/api/member/pulsa/products', {
      params: {
        operator_code: operatorCode,
        product_type: productType,
        supplier_code: supplierCode,
      },
    })

    return data
  },
  getSavedCustomerNumbers: async ({ service = 'pulsa' } = {}) => {
    const { data } = await apiClient.get('/api/member/pulsa/saved-numbers', {
      params: {
        service,
      },
    })

    return data
  },
  saveCustomerNumber: async ({ customerNumber, operatorCode, operatorName, label, service = 'pulsa' }) => {
    await ensureCsrfCookie()

    const { data } = await apiClient.post('/api/member/pulsa/saved-numbers', {
      customer_number: customerNumber,
      operator_code: operatorCode,
      operator_name: operatorName,
      label,
      service,
    })

    return data
  },
  deleteCustomerNumber: async ({ id, service = 'pulsa' }) => {
    await ensureCsrfCookie()

    const { data } = await apiClient.delete(`/api/member/pulsa/saved-numbers/${id}`, {
      params: {
        service,
      },
    })

    return data
  },
  savePulsaCustomerNumber: async ({ customerNumber, operatorCode, operatorName, label }) => {
    const data = await mitrakamiApi.saveCustomerNumber({
      customerNumber,
      operatorCode,
      operatorName,
      label,
      service: 'pulsa',
    })
    return data
  },
  deletePulsaCustomerNumber: async ({ id }) => {
    const data = await mitrakamiApi.deleteCustomerNumber({
      id,
      service: 'pulsa',
    })
    return data
  },
  createPulsaOrder: async ({ operatorCode, customerNumber, productType, productCode, supplierCode, saveNumber }) => {
    await ensureCsrfCookie()

    const { data } = await apiClient.post('/api/member/pulsa/orders', {
      operator_code: operatorCode,
      customer_number: customerNumber,
      product_type: productType,
      product_code: productCode,
      supplier_code: supplierCode,
      save_number: saveNumber,
    })

    return data
  },
  getBillServices: async () => {
    const { data } = await apiClient.get('/api/member/bills/services')
    return data
  },
  getBillProducts: async ({ serviceCode, supplierCode }) => {
    const { data } = await apiClient.get('/api/member/bills/products', {
      params: {
        service_code: serviceCode,
        supplier_code: supplierCode,
      },
    })

    return data
  },
  createBillInquiry: async ({ serviceCode, customerNumber, productCode }) => {
    await ensureCsrfCookie()

    const { data } = await apiClient.post('/api/member/bills/inquiry', {
      service_code: serviceCode,
      customer_number: customerNumber,
      product_code: productCode,
    })

    return data
  },
  createBillOrder: async ({ serviceCode, customerNumber, productCode, supplierCode }) => {
    await ensureCsrfCookie()

    const { data } = await apiClient.post('/api/member/bills/orders', {
      service_code: serviceCode,
      customer_number: customerNumber,
      product_code: productCode,
      supplier_code: supplierCode,
    })

    return data
  },
  getVoucherGameProducts: async () => {
    const data = await mitrakamiApi.getBillProducts({ serviceCode: 'voucher-games' })
    return data
  },
  createVoucherGameOrder: async ({ customerNumber, productCode }) => {
    const data = await mitrakamiApi.createBillOrder({
      serviceCode: 'voucher-games',
      customerNumber,
      productCode,
    })

    return data
  },
  getFlightAirlines: async ({ flightScope } = {}) => {
    const cleanParams = Object.fromEntries(
      Object.entries({
        flight_scope: flightScope,
      }).filter(([, value]) => value !== undefined && value !== null && value !== ''),
    )

    const { data } = await apiClient.get('/api/member/flights/airlines', {
      params: cleanParams,
    })

    return data
  },
  searchFlightAirports: async ({ keyword, flightScope, limit } = {}) => {
    const cleanParams = Object.fromEntries(
      Object.entries({
        keyword,
        flight_scope: flightScope,
        limit,
      }).filter(([, value]) => value !== undefined && value !== null && value !== ''),
    )

    const { data } = await apiClient.get('/api/member/flights/airports', {
      params: cleanParams,
    })

    return data
  },
  searchFlights: async (payload = {}) => {
    const { data } = await apiClient.post('/api/member/flights/search', payload)
    return data
  },
  getHotelCountries: async ({ keyword, limit } = {}) => {
    const cleanParams = Object.fromEntries(
      Object.entries({
        keyword,
        limit,
      }).filter(([, value]) => value !== undefined && value !== null && value !== ''),
    )

    const { data } = await apiClient.get('/api/member/hotels/countries', {
      params: cleanParams,
    })

    return data
  },
  getHotelCities: async ({ countryId, keyword, limit } = {}) => {
    const cleanParams = Object.fromEntries(
      Object.entries({
        country_id: countryId,
        keyword,
        limit,
      }).filter(([, value]) => value !== undefined && value !== null && value !== ''),
    )

    const { data } = await apiClient.get('/api/member/hotels/cities', {
      params: cleanParams,
    })

    return data
  },
  searchHotels: async (payload = {}) => {
    const { data } = await apiClient.post('/api/member/hotels/search', payload)
    return data
  },
  getHotelAvailableRooms: async (payload = {}) => {
    const { data } = await apiClient.post('/api/member/hotels/available-rooms', payload)
    return data
  },
  getHotelPricePolicy: async (payload = {}) => {
    const { data } = await apiClient.post('/api/member/hotels/price-policy', payload)
    return data
  },
  createHotelBooking: async (payload = {}) => {
    await ensureCsrfCookie()
    const { data } = await apiClient.post('/api/member/hotels/booking', payload)
    return data
  },
  issueHotelBooking: async ({ reservationNo }) => {
    await ensureCsrfCookie()
    const { data } = await apiClient.post('/api/member/hotels/issued', {
      reservation_no: reservationNo,
    })
    return data
  },
  getHotelBookingDetail: async ({ reservationNo, osRefNo, agentOsRef } = {}) => {
    const { data } = await apiClient.post('/api/member/hotels/booking-detail', {
      reservation_no: reservationNo,
      os_ref_no: osRefNo,
      agent_os_ref: agentOsRef,
    })
    return data
  },
  checkoutHotel: async (payload = {}) => {
    await ensureCsrfCookie()
    const { data } = await apiClient.post('/api/member/hotels/checkout', payload)
    return data
  },
}
