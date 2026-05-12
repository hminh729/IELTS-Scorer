import React, { createContext, useContext, useState, useEffect } from 'react';
import { API } from '../config';

interface AuthContextType {
  user: any;
  token: string | null;
  login: (token: string, username: string) => void;
  logout: () => void;
  updateUser: (newData: any) => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<any>(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser && token ? JSON.parse(savedUser) : null;
  });

  useEffect(() => {
    const fetchProfile = async () => {
      if (token && user?.username) {
        try {
          const res = await fetch(`${API}/user/profile?user_id=${user.username}`);
          if (res.ok) {
            const profile = await res.json();
            updateUser(profile);
          }
        } catch (err) {
          console.error("Failed to fetch profile:", err);
        }
      }
    };
    
    fetchProfile();
    
    // Heartbeat every 2 minutes to keep "Online" status
    const interval = setInterval(fetchProfile, 120000);
    return () => clearInterval(interval);
  }, [token]);

  const login = (newToken: string, username: string) => {
    localStorage.setItem('token', newToken);
    const userData = { username };
    localStorage.setItem('user', JSON.stringify(userData));
    setToken(newToken);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  const updateUser = (newData: any) => {
    setUser((prev: any) => {
      const updated = { ...prev, ...newData };
      localStorage.setItem('user', JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, updateUser, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
