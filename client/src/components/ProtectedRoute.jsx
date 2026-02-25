import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * Protected Route wrapper
 * Redirect về /login nếu chưa đăng nhập
 * Kiểm tra quyền nếu có requirePermissions
 */
const ProtectedRoute = ({ children, requirePermissions = [], requireAdmin = false }) => {
    const { isAuthenticated, loading, hasPermission, isAdmin } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-100">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-500">Checking authentication...</p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (requireAdmin && !isAdmin()) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center bg-white rounded-xl shadow-sm border border-red-100 p-8 max-w-md">
                    <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-semibold text-gray-800 mb-2">Access Denied</h2>
                    <p className="text-gray-500">You need admin privileges to access this page.</p>
                </div>
            </div>
        );
    }

    if (requirePermissions.length > 0 && !hasPermission(...requirePermissions)) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center bg-white rounded-xl shadow-sm border border-orange-100 p-8 max-w-md">
                    <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-semibold text-gray-800 mb-2">Insufficient Permissions</h2>
                    <p className="text-gray-500">You don't have the required permissions to access this page.</p>
                    <p className="text-xs text-gray-400 mt-2">Required: {requirePermissions.join(', ')}</p>
                </div>
            </div>
        );
    }

    return children;
};

export default ProtectedRoute;
