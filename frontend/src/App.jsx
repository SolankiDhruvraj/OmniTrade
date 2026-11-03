import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute.jsx'
import { ProtectedAdminRoute } from './components/ProtectedAdminRoute.jsx'
import { Shell } from './components/Shell.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { AddAccountPage } from './pages/AddAccountPage.jsx'
import { AccountsPage } from './pages/AccountsPage.jsx'
import { AcceptInvitationPage } from './pages/AcceptInvitationPage.jsx'
import { InvitationsPage } from './pages/InvitationsPage.jsx'
import { AdminAccountsPage } from './pages/AdminAccountsPage.jsx'
import { AdminTransactionsPage } from './pages/AdminTransactionsPage.jsx'
import { AdminLogsPage } from './pages/AdminLogsPage.jsx'
import { AuthPage } from './pages/AuthPage.jsx'
import { OrdersPage } from './pages/OrdersPage.jsx'
import { PositionsPage } from './pages/PositionsPage.jsx'
import { HoldingsPage } from './pages/HoldingsPage.jsx'
import { SecurityPage } from './pages/SecurityPage.jsx'
import { TradePage } from './pages/TradePage.jsx'
import { ResetPasswordPage } from './pages/ResetPasswordPage.jsx'
import { ApiDocsPage } from './pages/ApiDocsPage.jsx'

const App = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<AuthPage />} />
          <Route path="/register" element={<Navigate to="/login" replace />} />
          <Route path="/accept-invite" element={<AcceptInvitationPage />} />
          <Route path="/forgot-password" element={<ResetPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route
            path="/"
            element={(
              <ProtectedRoute>
                <Shell />
              </ProtectedRoute>
            )}
          >
            <Route index element={<TradePage />} />
            <Route path="accounts" element={<AccountsPage />} />
            <Route path="accounts/add" element={<AddAccountPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="holdings" element={<HoldingsPage />} />
            <Route path="positions" element={<PositionsPage />} />
            <Route path="logs" element={<AdminLogsPage />} />
            <Route path="security" element={<SecurityPage />} />
            <Route path="api-guide" element={<ApiDocsPage />} />
            <Route
              path="admin/invitations"
              element={(
                <ProtectedAdminRoute>
                  <InvitationsPage />
                </ProtectedAdminRoute>
              )}
            />
            <Route
              path="admin/accounts"
              element={(
                <ProtectedAdminRoute>
                  <AdminAccountsPage />
                </ProtectedAdminRoute>
              )}
            />
            <Route
              path="admin/transactions"
              element={(
                <ProtectedAdminRoute>
                  <AdminTransactionsPage />
                </ProtectedAdminRoute>
              )}
            />
            <Route
              path="admin/logs"
              element={<AdminLogsPage />}
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
