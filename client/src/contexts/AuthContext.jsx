import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);

    // Khởi tạo từ localStorage
    useEffect(() => {
        const savedToken = localStorage.getItem('nas_token');
        const savedUser = localStorage.getItem('nas_user');

        if (savedToken && savedUser) {
            setToken(savedToken);
            setUser(JSON.parse(savedUser));

            // Verify token còn hợp lệ
            api.get('/users/me')
                .then(res => {
                    setUser(res.data);
                    localStorage.setItem('nas_user', JSON.stringify(res.data));
                })
                .catch(() => {
                    // Token hết hạn
                    logout();
                })
                .finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, []);

    const login = async (username, password) => {
        const response = await api.post('/auth/login', { username, password });
        const { token: newToken, user: userData } = response.data;

        setToken(newToken);
        setUser(userData);
        localStorage.setItem('nas_token', newToken);
        localStorage.setItem('nas_user', JSON.stringify(userData));

        return userData;
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('nas_token');
        localStorage.removeItem('nas_user');
    };

    const isAdmin = () => {
        return user?.permissions?.includes('ALL') || user?.roleName === 'Admin';
    };

    const hasPermission = (...perms) => {
        if (!user?.permissions) return false;
        if (user.permissions.includes('ALL')) return true;
        return perms.some(p => user.permissions.includes(p));
    };

    const value = {
        user,
        token,
        loading,
        login,
        logout,
        isAdmin,
        hasPermission,
        isAuthenticated: !!token && !!user
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
