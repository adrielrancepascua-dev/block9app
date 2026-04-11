"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/SupabaseAuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const router = useRouter();
  const { signIn } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsAuthenticating(true);

    try {
      await signIn(email, password);
      // Successful login, navigate to home
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Failed to sign in. Please check your credentials.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      {/* 
        Background 
        A vibrant background so the glassmorphic card pops nicely! 
      */}
      <div
        className="fixed inset-0 z-[-1] bg-cover bg-center"
        style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=1920&q=80')",
        }}
      />

      {/* Glassmorphic Login Card */}
      <div className="w-full max-w-md rounded-2xl border border-white/20 bg-white/10 p-8 shadow-2xl backdrop-blur-xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white drop-shadow-md">
            Welcome Back
          </h1>
          <p className="mt-2 text-sm text-slate-100 drop-shadow">
            Sign in to your account
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-500/50 bg-red-500/20 p-3 text-sm text-white backdrop-blur-md">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-white drop-shadow"
            >
              Email Address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@example.com"
              className="mt-2 block w-full rounded-lg border border-white/30 bg-white/20 px-4 py-3 text-white placeholder-white/50 backdrop-blur-sm transition-all focus:border-white/50 focus:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-white drop-shadow"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-2 block w-full rounded-lg border border-white/30 bg-white/20 px-4 py-3 text-white placeholder-white/50 backdrop-blur-sm transition-all focus:border-white/50 focus:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
            />
          </div>

          <button
            type="submit"
            disabled={isAuthenticating}
            className="group relative flex w-full justify-center overflow-hidden rounded-lg border border-white/20 bg-white/20 px-4 py-3 text-sm font-semibold text-white shadow-lg backdrop-blur-md transition-all hover:bg-white/30 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-white/50 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isAuthenticating ? (
              <>
                <svg
                  className="-ml-1 mr-3 h-5 w-5 animate-spin text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Signing In...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
