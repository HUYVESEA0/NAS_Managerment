import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import DashboardLayout from './layouts/DashboardLayout'
import Login from './pages/Login'
import Home from './pages/Home'
import FileSystem from './pages/FileSystem'
import Admin from './pages/Admin'
import UserManagement from './pages/UserManagement'
import NetworkScanner from './pages/NetworkScanner'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Route */}
          <Route path="/login" element={<Login />} />

          {/* Protected Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Home />} />
            <Route
              path="files"
              element={
                <ProtectedRoute requirePermissions={['READ_FILES', 'BROWSE_FILES']}>
                  <FileSystem />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin"
              element={
                <ProtectedRoute requirePermissions={['MANAGE_HIERARCHY', 'WRITE_HIERARCHY']}>
                  <Admin />
                </ProtectedRoute>
              }
            />
            <Route
              path="users"
              element={
                <ProtectedRoute requireAdmin={true}>
                  <UserManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="network"
              element={
                <ProtectedRoute requirePermissions={['MANAGE_HIERARCHY']}>
                  <NetworkScanner />
                </ProtectedRoute>
              }
            />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
