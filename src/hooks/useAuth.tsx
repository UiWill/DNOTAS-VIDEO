import { useState, useEffect, useRef, createContext, useContext, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type AppRole = "admin" | "manager" | "viewer" | "vip" | "aprovacao" | "mark";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  userRoles: AppRole[];
  isAdmin: boolean;
  isMark: boolean;
  signOut: () => Promise<void>;
  refreshRoles: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRoles, setUserRoles] = useState<AppRole[]>([]);
  const hadSessionRef = useRef(false);

  useEffect(() => {
    const syncUserProfile = async (authUser: User) => {
      try {
        const metadata = authUser.user_metadata ?? {};
        const name = typeof metadata.name === "string" ? metadata.name.trim() : "";
        const phone = typeof metadata.phone === "string" ? metadata.phone.trim() : "";

        const payload: Database["public"]["Tables"]["profiles"]["Insert"] = {
          id: authUser.id,
          email: authUser.email ?? "",
        };

        if (name) payload.name = name;
        if (phone) payload.phone = phone;

        const { error } = await supabase.from("profiles").upsert([payload], { onConflict: "id" });
        if (error) console.warn("Falha ao sincronizar perfil:", error.message);
      } catch (error) {
        console.warn("Erro ao sincronizar perfil:", error);
      }
    };

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // feedback para evitar “logout silencioso” em produção
        const hadSession = hadSessionRef.current;
        hadSessionRef.current = !!session;

        if (event === "SIGNED_OUT" && hadSession) {
          toast.message("Sessão encerrada.");
        }

        setSession(session);
        setUser(session?.user ?? null);

        // Defer role fetching with setTimeout
        if (session?.user) {
          setTimeout(() => {
            fetchUserRoles(session.user.id);
            syncUserProfile(session.user);
          }, 0);
        } else {
          setUserRoles([]);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      hadSessionRef.current = !!session;
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchUserRoles(session.user.id);
        syncUserProfile(session.user);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserRoles = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role, expires_at")
        .eq("user_id", userId);

      if (error) {
        console.error("Error fetching roles:", error);
        return;
      }

      const now = new Date();
      const activeRoles = (data ?? [])
        .filter((r) => 
          r.role === "admin" || !r.expires_at || new Date(r.expires_at) > now
        )
        .map((r) => r.role as AppRole);

      setUserRoles(activeRoles);
    } catch (error) {
      console.error("Error fetching roles:", error);
    }
  };

  const signOut = async () => {
    // Em alguns casos o backend responde 403 session_not_found (sessão já revogada/expirada),
    // e o SDK pode não limpar o storage local. Aqui garantimos o logout local sempre.
    try {
      await supabase.auth.signOut({ scope: "global" });
    } catch {
      // ignore
    }

    // Força limpeza local (token/sessão) independentemente do retorno do backend
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        // Chaves padrão do supabase-js (ex: sb-<project>-auth-token)
        if (k.startsWith("sb-") && (k.includes("-auth-token") || k.includes("-auth-token-code-verifier"))) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch (e) {
      console.warn("Falha ao limpar storage de auth:", e);
    }

    // Zera estado do contexto para refletir imediatamente no app
    hadSessionRef.current = false;
    setSession(null);
    setUser(null);
    setUserRoles([]);
  };

  const isAdmin = userRoles.includes("admin");
  const isMark = userRoles.includes("mark") || isAdmin;

  const refreshRoles = async () => {
    if (user) await fetchUserRoles(user.id);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, userRoles, isAdmin, isMark, signOut, refreshRoles }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
