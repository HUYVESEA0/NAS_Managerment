import React, { Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { LanguageProvider } from './contexts/LanguageContext'
import { ThemeProvider } from './contexts/ThemeContext'
import ProtectedRoute from './components/ProtectedRoute'
import DashboardLayout from './layouts/DashboardLayout'
import './index.css'

// Lazy Load Pages for Code Splitting (Core Web Vitals SEO)
const Login = React.lazy(() => import('./pages/Login'))
const Home = React.lazy(() => import('./pages/Home'))
const FileSystem = React.lazy(() => import('./pages/FileSystem'))
const Admin = React.lazy(() => import('./pages/Admin'))
const UserManagement = React.lazy(() => import('./pages/UserManagement'))
const NetworkScanner = React.lazy(() => import('./pages/NetworkScanner'))
const NetworkTopology = React.lazy(() => import('./pages/NetworkTopology'))
const SystemStatus = React.lazy(() => import('./pages/SystemStatus'))
const ActivityLog = React.lazy(() => import('./pages/ActivityLog'))
const Profile = React.lazy(() => import('./pages/Profile'))
const Spreadsheet = React.lazy(() => import('./pages/Spreadsheet'))

const PageLoader = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-base)' }}>
    <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid var(--accent-blue)', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
  </div>
);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <LanguageProvider>
          <AuthProvider>
            <Suspense fallback={<PageLoader />}>
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
                    path="system"
                    element={
                      <ProtectedRoute requirePermissions={['MANAGE_HIERARCHY']}>
                        <SystemStatus />
                      </ProtectedRoute>
                    }
                  />
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
                  <Route
                    path="topology"
                    element={
                      <ProtectedRoute requirePermissions={['MANAGE_HIERARCHY']}>
                        <NetworkTopology />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="logs"
                    element={
                      <ProtectedRoute requireAdmin={true}>
                        <ActivityLog />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="profile" element={<Profile />} />
                  <Route
                    path="spreadsheet"
                    element={
                      <ProtectedRoute requirePermissions={['READ_FILES', 'BROWSE_FILES']}>
                        <Spreadsheet />
                      </ProtectedRoute>
                    }
                  />
                </Route>
              </Routes>
            </Suspense>
          </AuthProvider>
        </LanguageProvider>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>,
)
