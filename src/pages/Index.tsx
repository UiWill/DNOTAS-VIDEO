import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logo from "@/assets/logo.png";
import loginBg from "@/assets/login-bg.jpg";

const Index = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/dashboard");
      }
    };
    checkSession();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast.success("Login realizado com sucesso!");
      // Evita race-condition entre navegação e atualização do AuthProvider em produção
      window.location.assign("/dashboard");
    } catch (error: any) {
      toast.error(error.message || "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background">
      {/* Background com animação */}
      <div 
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${loginBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />
      
      {/* Overlay com gradiente nas cores da logo */}
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(43,90%,55%)]/25 via-background/70 to-[hsl(43,90%,40%)]/15" />
      <div className="absolute inset-0 bg-black/40" />

      {/* Card de login */}
      <div className="relative z-10 w-full max-w-md px-4 opacity-0 animate-fade-in" style={{ animationDelay: '0.1s', animationFillMode: 'forwards' }}>
        <div className="rounded-xl border border-border/50 bg-card/95 backdrop-blur-sm p-8 shadow-2xl">
          {/* Logo */}
          <div className="flex justify-center mb-8 opacity-0 animate-fade-in" style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}>
            <img 
              src={logo} 
              alt="DNOTAS TREINAMENTOS"
              className="h-52 w-auto object-contain"
              decoding="async"
              width={208}
              height={208}
            />
          </div>

          {/* Título */}
          <h1 className="text-center text-2xl font-semibold text-foreground mb-8 opacity-0 animate-fade-in" style={{ animationDelay: '0.3s', animationFillMode: 'forwards' }}>
            Treinamentos e Tutoriais Exclusivos
          </h1>

          {/* Formulário */}
          <form onSubmit={handleLogin} className="space-y-5 opacity-0 animate-fade-in" style={{ animationDelay: '0.4s', animationFillMode: 'forwards' }}>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm text-muted-foreground">
                E-mail
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 bg-background/50 border-border/70 focus:border-primary"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm text-muted-foreground">
                Senha
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-12 bg-background/50 border-border/70 focus:border-primary"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-base"
            >
              {loading ? "Entrando..." : "Entrar na plataforma"}
            </Button>
          </form>

          {/* Link de cadastro */}
          <p className="mt-6 text-center text-sm text-muted-foreground opacity-0 animate-fade-in" style={{ animationDelay: '0.5s', animationFillMode: 'forwards' }}>
            Não tem acesso ainda?{" "}
            <button
              onClick={() => navigate("/auth")}
              className="text-primary hover:underline font-medium"
            >
              Solicitar cadastro
            </button>
          </p>

          {/* Footer */}
          <div className="mt-10 flex flex-col items-center gap-4 text-sm text-muted-foreground opacity-0 animate-fade-in" style={{ animationDelay: '0.6s', animationFillMode: 'forwards' }}>
            <span className="text-xs">Desenvolvido por:</span>
            <img 
              src={logo} 
              alt="DNOTAS TREINAMENTOS"
              className="h-28 w-auto object-contain"
              loading="lazy"
              decoding="async"
              width={112}
              height={112}
            />
            <p className="text-[10px] text-muted-foreground/60">
              © {new Date().getFullYear()} DNOTAS TREINAMENTOS
            </p>
          </div>
        </div>
      </div>
    </main>
  );
};

export default Index;
