import { createContext, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from './api.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!getToken());

  useEffect(() => {
    if (!getToken()) return;
    api.get('/auth/me').then((d) => setUser(d.user)).catch(() => setToken(null)).finally(() => setLoading(false));
  }, []);

  // A 401 anywhere (expired token, password changed elsewhere) signs the user out
  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, []);

  const authenticate = async (path, body) => {
    const d = await api.post(path, body);
    setToken(d.token);
    setUser(d.user);
    return d.user;
  };

  const value = {
    user,
    loading,
    login: (email, password) => authenticate('/auth/login', { email, password }),
    register: (form) => authenticate('/auth/register', form),
    logout: () => { setToken(null); setUser(null); },
    updateUser: (u) => setUser((prev) => ({ ...prev, ...u })),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
