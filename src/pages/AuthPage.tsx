import { useState, useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import Footer from "@/components/Footer";
import loginBg from "@/assets/login-bg.jpg";
import logo from "@/assets/logo.png";

// Schema base para login (validações simples)
const loginSchema = z.object({
  email: z.string().trim().email("E-mail inválido"),
  password: z.string().min(1, "Senha é obrigatória"),
});

// Schema para cadastro com validações mais rigorosas
const signupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Nome deve ter pelo menos 3 caracteres")
    .max(80, "Nome deve ter no máximo 80 caracteres"),
  phone: z
    .string()
    .trim()
    .min(10, "Informe um número válido com DDD")
    .max(20, "Número muito longo"),
  email: z
    .string()
    .trim()
    .min(1, "E-mail é obrigatório")
    .email("E-mail inválido")
    .max(255, "E-mail muito longo")
    .refine(
      (email) => {
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return emailRegex.test(email);
      },
      { message: "Formato de e-mail inválido" }
    )
    .refine(
      (email) => {
        const blockedDomains = [
          "tempmail.com",
          "throwaway.com",
          "guerrillamail.com",
          "10minutemail.com",
          "mailinator.com",
          "yopmail.com",
        ];
        const domain = email.split("@")[1]?.toLowerCase();
        return !blockedDomains.includes(domain);
      },
      { message: "E-mails temporários não são permitidos" }
    ),
  password: z
    .string()
    .min(8, "A senha deve ter no mínimo 8 caracteres")
    .max(64, "A senha deve ter no máximo 64 caracteres")
    .refine(
      (password) => /[A-Z]/.test(password),
      { message: "A senha deve conter pelo menos uma letra maiúscula" }
    )
    .refine(
      (password) => /[a-z]/.test(password),
      { message: "A senha deve conter pelo menos uma letra minúscula" }
    )
    .refine(
      (password) => /[0-9]/.test(password),
      { message: "A senha deve conter pelo menos um número" }
    )
    .refine(
      (password) => /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/`~]/.test(password),
      { message: "A senha deve conter pelo menos um caractere especial (!@#$%^&*)" }
    ),
});

type AuthFormValues = z.infer<typeof signupSchema>;

const AuthPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);

  // Usa schema diferente dependendo do modo
  const currentSchema = mode === "signup" ? signupSchema : loginSchema;

  const form = useForm<AuthFormValues>({
    resolver: zodResolver(currentSchema),
    defaultValues: {
      email: "",
      password: "",
      name: "",
      phone: "",
    },
  });

  // Reset do form quando muda de modo para limpar erros
  useEffect(() => {
    form.reset();
  }, [mode, form]);

  useEffect(() => {
    if (!authLoading && user) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, authLoading, navigate]);

  const onSubmit = async (values: AuthFormValues) => {
    setLoading(true);
    try {
      if (mode === "signup") {
        const redirectTo = `${window.location.origin}/`;
        const { error } = await supabase.auth.signUp({
          email: values.email,
          password: values.password,
          options: {
            emailRedirectTo: redirectTo,
            data: {
              name: values.name?.trim() || undefined,
              phone: values.phone?.trim() || undefined,
            },
          },
        });
        if (error) throw error;
        toast({
          title: "Cadastro realizado",
          description: "Você já pode fazer login.",
        });
        setMode("login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: values.email,
          password: values.password,
        });
        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            throw new Error("E-mail ou senha incorretos.");
          }
          throw error;
        }
        toast({ title: "Bem-vindo(a)", description: "Login realizado com sucesso." });
        // Evita race-condition entre navegação e atualização do AuthProvider em produção
        window.location.assign("/dashboard");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Não foi possível completar a operação.";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-background flex flex-col">
      {/* Background com animação */}
      <div
        className="absolute inset-0 animate-slow-zoom"
        style={{
          backgroundImage: `url(${loginBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      
      {/* Overlay escuro minimalista */}
      <div className="absolute inset-0 bg-black/65" />
      
      <div className="relative z-10 flex flex-grow items-center justify-center px-4 py-10">
        <Card className="glass-panel w-full max-w-md border border-border/80 shadow-xl animate-fade-in">
          <CardHeader className="space-y-4 text-center">
            {/* Logo maior */}
            <div className="mx-auto inline-block bg-black rounded-xl overflow-hidden p-3">
              <img
                src={logo}
                alt="DNOTAS TREINAMENTOS"
                className="h-32 w-auto object-contain"
                decoding="async"
                width={160}
                height={128}
              />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-2xl font-bold tracking-tight">
                {mode === "login" ? "Treinamentos e Tutoriais Exclusivos" : "Criar conta"}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {mode === "login" 
                  ? "Entre para acessar as transmissões" 
                  : "Cadastre-se para começar"}
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              {mode === "signup" && (
                <>
                  <div className="space-y-2.5 text-left">
                    <Label htmlFor="name">Nome completo</Label>
                    <Input
                      id="name"
                      type="text"
                      autoComplete="name"
                      disabled={loading}
                      className="bg-card/50"
                      {...form.register("name")}
                    />
                    {form.formState.errors.name && (
                      <p className="text-[12px] text-destructive">
                        {form.formState.errors.name.message as string}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2.5 text-left">
                    <Label htmlFor="phone">WhatsApp (com DDD)</Label>
                    <Input
                      id="phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      disabled={loading}
                      className="bg-card/50"
                      {...form.register("phone")}
                    />
                    {form.formState.errors.phone && (
                      <p className="text-[12px] text-destructive">
                        {form.formState.errors.phone.message as string}
                      </p>
                    )}
                  </div>
                </>
              )}
              <div className="space-y-2.5 text-left">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  disabled={loading}
                  className="bg-card/50"
                  {...form.register("email")}
                />
                {form.formState.errors.email && (
                  <p className="text-[12px] text-destructive">
                    {form.formState.errors.email.message}
                  </p>
                )}
              </div>
              <div className="space-y-2.5 text-left">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  disabled={loading}
                  className="bg-card/50"
                  {...form.register("password")}
                />
                {form.formState.errors.password && (
                  <p className="text-[12px] text-destructive">
                    {form.formState.errors.password.message}
                  </p>
                )}
                {mode === "signup" && (
                  <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                    <p className="font-medium">A senha deve conter:</p>
                    <ul className="list-inside list-disc space-y-0.5 pl-1">
                      <li>Mínimo de 8 caracteres</li>
                      <li>Uma letra maiúscula</li>
                      <li>Uma letra minúscula</li>
                      <li>Um número</li>
                      <li>Um caractere especial (!@#$%^&*)</li>
                    </ul>
                  </div>
                )}
              </div>
              <Button type="submit" className="mt-4 w-full glow-ring" disabled={loading}>
                {loading ? "Processando..." : mode === "login" ? "Entrar na plataforma" : "Finalizar cadastro"}
              </Button>
            </form>

            <div className="mt-5 text-center text-sm text-muted-foreground">
              {mode === "login" ? (
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className="underline-offset-2 hover:text-foreground hover:underline"
                >
                  Não tem conta? <span className="font-medium text-primary">Cadastre-se</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className="underline-offset-2 hover:text-foreground hover:underline"
                >
                  Já possui conta? <span className="font-medium text-primary">Fazer login</span>
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <div className="relative z-10">
        <Footer />
      </div>
    </main>
  );
};

export default AuthPage;
