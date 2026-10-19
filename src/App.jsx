import { Navigate, Route, Routes } from 'react-router-dom'
import DashboardPage from './pages/DashboardPage'
import FlightTicketSearchPage from './pages/FlightTicketSearchPage'
import BillsPage from './pages/BillsPage'
import HistoryPage from './pages/HistoryPage'
import HotelReservationSearchPage from './pages/HotelReservationSearchPage'
import LoginPage from './pages/LoginPage'
import PaketTeleponPage from './pages/PaketTeleponPage'
import ProfilePage from './pages/ProfilePage'
import PulsaPage from './pages/PulsaPage'
import TransactionDetailPage from './pages/TransactionDetailPage'
import TopUpFailedPage from './pages/TopUpFailedPage'
import TopUpEwalletPage from './pages/TopUpEwalletPage'
import TopUpSaldoPage from './pages/TopUpSaldoPage'
import TopUpSuccessPage from './pages/TopUpSuccessPage'
import VoucherGamesPage from './pages/VoucherGamesPage'
import ProtectedRoute from './components/ProtectedRoute'
import { isAuthenticated } from './utils/authStorage'

function App() {
  const defaultRoute = isAuthenticated() ? '/app/home' : '/login'

  return (
    <Routes>
      <Route path="/" element={<Navigate to={defaultRoute} replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="*" element={<Navigate to={defaultRoute} replace />} />

      <Route
        path="/app/home"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/bills"
        element={
          <ProtectedRoute>
            <BillsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/history"
        element={
          <ProtectedRoute>
            <HistoryPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/history/transaction"
        element={
          <ProtectedRoute>
            <TransactionDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/transfer"
        element={
          <ProtectedRoute>
            <DashboardPage currentTab="transfer" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/account"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/pulsa"
        element={
          <ProtectedRoute>
            <PulsaPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/flights/search"
        element={
          <ProtectedRoute>
            <FlightTicketSearchPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/hotels/reservation"
        element={
          <ProtectedRoute>
            <HotelReservationSearchPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/paket-telepon"
        element={
          <ProtectedRoute>
            <PaketTeleponPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/topup-ewallet"
        element={
          <ProtectedRoute>
            <TopUpEwalletPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/voucher-games"
        element={
          <ProtectedRoute>
            <VoucherGamesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/topup"
        element={
          <ProtectedRoute>
            <TopUpSaldoPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/topup/success"
        element={
          <ProtectedRoute>
            <TopUpSuccessPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/topup/failed"
        element={
          <ProtectedRoute>
            <TopUpFailedPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

export default App
