"use client";

import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Mail, Lock, User as UserIcon, CheckCircle2, Target, Flame, TrendingUp } from "lucide-react";
import { useAuth } from "@/features/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { LogoDots } from "@/components/shared/logo-dots";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
  remember: z.boolean().optional(),
});
type LoginForm = z.infer<typeof loginSchema>;

const registerSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Min 8 characters"),
  name: z.string().min(1, "Name is required").max(80),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, {
  message: "Passwords do not match",
  path: ["confirm"],
});
type RegisterForm = z.infer<typeof registerSchema>;

const features = [
  { icon: Target, title: "Track habits", desc: "Daily, weekly, or custom schedules" },
  { icon: Flame, title: "Build streaks", desc: "Stay motivated with streak tracking" },
  { icon: TrendingUp, title: "See progress", desc: "Beautiful charts and heatmaps" },
];

const TYPEWRITER_PHRASES = [
  "Build better habits.",
  "Track your streaks.",
  "Visualize your progress.",
  "Stay consistent.",
];

function useTypewriter(phrases: string[], speed = 80, pause = 1800) {
  const [text, setText] = useState("");
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const textRef = useRef("");
  const phraseIdxRef = useRef(0);
  const charIdxRef = useRef(0);
  const isDeletingRef = useRef(false);

  useEffect(() => {
    textRef.current = text;
  }, [text]);
  useEffect(() => {
    phraseIdxRef.current = phraseIdx;
  }, [phraseIdx]);
  useEffect(() => {
    charIdxRef.current = charIdx;
  }, [charIdx]);
  useEffect(() => {
    isDeletingRef.current = isDeleting;
  }, [isDeleting]);

  useEffect(() => {
    const tick = () => {
      const current = phrases[phraseIdxRef.current];
      const ci = charIdxRef.current;
      const del = isDeletingRef.current;

      if (!del && ci < current.length) {
        setText(current.slice(0, ci + 1));
        setCharIdx(ci + 1);
      } else if (!del && ci === current.length) {
        setIsDeleting(true);
      } else if (del && ci > 0) {
        setText(current.slice(0, ci - 1));
        setCharIdx(ci - 1);
      } else if (del && ci === 0) {
        setIsDeleting(false);
        setPhraseIdx((phraseIdxRef.current + 1) % phrases.length);
      }
    };

    const current = phrases[phraseIdxRef.current];
    const ci = charIdxRef.current;
    const del = isDeletingRef.current;
    const delay = del ? speed / 2 : (!del && ci === current.length) ? pause : speed;

    const timer = setTimeout(tick, delay);
    return () => clearTimeout(timer);
  }, [text, phraseIdx, charIdx, isDeleting, phrases, speed, pause]);

  return text;
}

function BrandPanel() {
  const typed = useTypewriter(TYPEWRITER_PHRASES);

  return (
    <div className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 text-white p-8 lg:p-16 flex-col justify-between relative overflow-hidden dark:from-indigo-950 dark:via-violet-950 dark:to-purple-950">
      {/* Flowing color blobs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-indigo-400/40 blur-3xl" style={{ animation: "blob-move-1 8s ease-in-out infinite" }} />
      <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full bg-violet-400/40 blur-3xl" style={{ animation: "blob-move-2 10s ease-in-out infinite" }} />
      <div className="absolute top-1/2 left-1/2 w-64 h-64 rounded-full bg-purple-400/30 blur-3xl" style={{ animation: "blob-move-3 12s ease-in-out infinite" }} />
      <div className="absolute bottom-1/4 left-0 w-72 h-72 rounded-full bg-cyan-400/20 blur-3xl" style={{ animation: "blob-move-1 9s ease-in-out infinite reverse" }} />
      <style>{`
        @keyframes blob-move-1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(40px, -30px) scale(1.1); }
          66% { transform: translate(-20px, 40px) scale(0.9); }
        }
        @keyframes blob-move-2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-30px, 20px) scale(1.15); }
          66% { transform: translate(20px, -40px) scale(0.85); }
        }
        @keyframes blob-move-3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(30px, 30px) scale(1.2); }
        }
      `}</style>
      {/* Dot pattern */}
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
        backgroundSize: "24px 24px",
      }} />
      <div className="relative z-10">
        <div className="flex flex-col items-start gap-1 mb-12">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center shadow-lg">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <span className="text-2xl font-bold tracking-tight">HabitFlow</span>
          </div>
          <div className="ml-12">
            <LogoDots />
          </div>
        </div>
        <h1 className="text-3xl lg:text-5xl font-bold leading-tight mb-2 min-h-[2.5em] lg:min-h-[1.5em]">
          {typed}
          <span className="inline-block w-0.5 h-8 lg:h-10 bg-white/80 ml-1 animate-pulse align-middle" />
        </h1>
        <p className="text-white/80 text-lg max-w-md mb-10">
          A simple, beautiful habit tracker that helps you stay consistent, celebrate streaks, and visualize your progress.
        </p>
        <div className="space-y-4 max-w-md">
          {features.map((f) => (
            <div key={f.title} className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center flex-shrink-0 shadow-lg">
                <f.icon className="w-5 h-5" />
              </div>
              <div>
                <div className="font-semibold">{f.title}</div>
                <div className="text-white/70 text-sm">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="relative z-10 text-white/60 text-sm mt-10">
        © {new Date().getFullYear()} HabitFlow. Track smarter.
      </div>
    </div>
  );
}

export function AuthScreen({ initialMode = "login", onBack }: { initialMode?: "login" | "register"; onBack?: () => void }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">(initialMode);

  const loginForm = useForm<LoginForm>({ resolver: zodResolver(loginSchema), defaultValues: { remember: true } });
  const registerForm = useForm<RegisterForm>({ resolver: zodResolver(registerSchema), defaultValues: { name: "", email: "", password: "", confirm: "" } });

  const onLogin = loginForm.handleSubmit(async (data) => {
    try {
      await login(data.email, data.password, data.remember);
      toast.success("Welcome back!");
    } catch (e) {
      toast.error((e as Error).message);
    }
  });

  const onRegister = registerForm.handleSubmit(async (data) => {
    try {
      await register(data.email, data.password, data.name);
      toast.success("Account created!");
    } catch (e) {
      toast.error((e as Error).message);
    }
  });

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      <BrandPanel />

      {/* Right: Form (full screen on mobile) */}
      <div className="flex-1 lg:flex-1 flex items-center justify-center p-6 lg:p-16 relative min-h-screen lg:min-h-0">
        {onBack && (
          <button
            onClick={onBack}
            className="absolute top-4 right-4 lg:top-6 lg:right-6 w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors z-10"
            aria-label="Close and go back to landing page"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex lg:hidden flex-col items-center gap-1 mb-8">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg">
                <CheckCircle2 className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold tracking-tight">HabitFlow</span>
            </div>
            <div className="ml-12">
              <LogoDots />
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground">
              {mode === "login" ? "Welcome back" : "Create your account"}
            </h2>
            <p className="text-muted-foreground mt-1">
              {mode === "login"
                ? "Sign in to continue tracking your habits."
                : "Start building better habits today."}
            </p>
          </div>

          {mode === "login" ? (
            <form onSubmit={onLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="email" type="email" placeholder="you@example.com" className="pl-9" {...loginForm.register("email")} />
                </div>
                {loginForm.formState.errors.email && (
                  <p className="text-xs text-destructive">{loginForm.formState.errors.email.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="password" type="password" placeholder="••••••••" className="pl-9" {...loginForm.register("password")} />
                </div>
                {loginForm.formState.errors.password && (
                  <p className="text-xs text-destructive">{loginForm.formState.errors.password.message}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="remember" onCheckedChange={(v) => loginForm.setValue("remember", v === true)} defaultChecked />
                <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">Remember me for 7 days</Label>
              </div>
              <Button type="submit" className="w-full bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white" disabled={loginForm.formState.isSubmitting}>
                {loginForm.formState.isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Sign in
              </Button>
            </form>
          ) : (
            <form onSubmit={onRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="name" placeholder="Alex" className="pl-9" {...registerForm.register("name")} />
                </div>
                {registerForm.formState.errors.name && (
                  <p className="text-xs text-destructive">{registerForm.formState.errors.name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="remail">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="remail" type="email" placeholder="you@example.com" className="pl-9" {...registerForm.register("email")} />
                </div>
                {registerForm.formState.errors.email && (
                  <p className="text-xs text-destructive">{registerForm.formState.errors.email.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="rpassword">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="rpassword" type="password" placeholder="At least 8 characters" className="pl-9" {...registerForm.register("password")} />
                </div>
                {registerForm.formState.errors.password && (
                  <p className="text-xs text-destructive">{registerForm.formState.errors.password.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="confirm" type="password" placeholder="Repeat password" className="pl-9" {...registerForm.register("confirm")} />
                </div>
                {registerForm.formState.errors.confirm && (
                  <p className="text-xs text-destructive">{registerForm.formState.errors.confirm.message}</p>
                )}
              </div>
              <Button type="submit" className="w-full bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white" disabled={registerForm.formState.isSubmitting}>
                {registerForm.formState.isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create account
              </Button>
            </form>
          )}

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "login" ? (
              <>
                Don&apos;t have an account?{" "}
                <button onClick={() => setMode("register")} className="text-foreground font-medium hover:underline">
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button onClick={() => setMode("login")} className="text-foreground font-medium hover:underline">
                  Sign in
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
