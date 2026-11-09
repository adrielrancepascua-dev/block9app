"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { useAuth } from "@/context/SupabaseAuthContext";
import { AuthScreen, authButtonClass, authInputClass } from "@/components/auth-ui";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const router = useRouter();
  const { signIn } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsAuthenticating(true);

    try {
      await signIn(email.trim(), password);
      router.push("/");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to sign in. Check your email and password.";
      setError(message);
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <AuthScreen title="Welcome back" subtitle="Sign in to see the class schedule, wall, and chat.">
      {error ? (
        <div className="mb-4 rounded-xl border border-rose-300/40 bg-rose-500/15 px-3 py-2.5 text-sm text-rose-50">
          {error}
        </div>
      ) : null}

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-white/90">
            Email
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-3.5 h-5 w-5 text-white/55" />
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@school.edu"
              className={authInputClass(false)}
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-white/90">
            Password
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-3.5 h-5 w-5 text-white/55" />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              className={`${authInputClass(false)} pr-12`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute right-3 top-3 rounded-md p-1 text-white/60 transition hover:text-white"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <button type="submit" disabled={isAuthenticating} className={authButtonClass}>
          {isAuthenticating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {isAuthenticating ? "Signing in" : "Sign in"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-white/75">
        New to Block9?{" "}
        <Link href="/register" className="font-semibold text-sky-200 hover:text-white">
          Create an account
        </Link>
      </p>
    </AuthScreen>
  );
}
