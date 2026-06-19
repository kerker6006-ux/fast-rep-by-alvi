import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | undefined;

    const initializeAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;

      setSession(session);
      setLoading(false);

      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (_event, nextSession) => {
          setSession(nextSession);
        }
      );
      unsubscribe = () => subscription.unsubscribe();
    };

    initializeAuth().catch(() => {
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
