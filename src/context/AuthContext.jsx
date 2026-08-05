import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Auth } from '../api/entities.js';
import { getToken, setToken } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    if (!getToken()) { setLoading(false); return; }
    try {
      const { user } = await Auth.me();
      setUser(user);
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMe(); }, [loadMe]);

  const login = async (email, password, opts = {}) => {
    const { code, remember = true } = opts;
    const { token, user } = await Auth.login(email, password, code);
    setToken(token, remember);
    setUser(user);
    return user;
  };

  const refreshUser = async () => { try { const { user } = await Auth.me(); setUser(user); return user; } catch { return null; } };

  const register = async (data) => {
    const res = await Auth.register(data);
    if (res.token) { setToken(res.token); setUser(res.user); }
    return res; // pode ser { needsVerification: true }
  };

  const updateProfile = async (data) => {
    const { user } = await Auth.updateProfile(data);
    setUser(user);
    return user;
  };

  const logout = () => { setToken(null); setUser(null); };

  const canAccess = (screenKey) => {
    if (!user) return false;
    if (screenKey === 'help' || screenKey === 'triggers') return true; // Ajuda e Gatilhos disponiveis a todos
    if (user.role === 'admin') return true;
    return (user.allowed_screens || []).includes(screenKey);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, register, logout, canAccess, updateProfile, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
