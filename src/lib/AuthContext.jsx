import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    let mounted = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      setIsLoadingAuth(false);
    });

    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        if (!mounted) return;
        if (error) console.error('Could not restore the Supabase session:', error.message);
        setUser(session?.user ?? null);
      })
      .catch((error) => {
        if (!mounted) return;
        console.error('Could not reach Supabase Auth:', error);
        setUser(null);
      })
      .finally(() => { if (mounted) setIsLoadingAuth(false); });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const logout = async (shouldRedirect = true) => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
    if (shouldRedirect) window.location.assign('/');
  };

  const navigateToLogin = () => {
    const next = `${window.location.pathname}${window.location.search}`;
    window.location.assign(`/login?next=${encodeURIComponent(next)}`);
  };

  const checkUserAuth = async () => {
    setIsLoadingAuth(true);
    const { data: { user: currentUser }, error } = await supabase.auth.getUser();
    if (error && error.name !== 'AuthSessionMissingError') console.error('Could not check the Supabase session:', error.message);
    setUser(currentUser ?? null);
    setIsLoadingAuth(false);
    return currentUser ?? null;
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: Boolean(user),
      isLoadingAuth,
      isLoadingPublicSettings: false,
      authError: null,
      appPublicSettings: null,
      logout,
      navigateToLogin,
      checkAppState: checkUserAuth,
      checkUserAuth,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
