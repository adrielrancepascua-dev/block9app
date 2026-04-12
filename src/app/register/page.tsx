"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Mail, Lock, User, Code } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    secretCode: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = "Full name is required";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Invalid email format";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    if (!formData.secretCode.trim()) {
      newErrors.secretCode = "Section secret code is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: formData.fullName.trim(),
          email: formData.email.trim(),
          password: formData.password,
          secretCode: formData.secretCode.trim(),
        }),
      });

      const result = await response.json().catch(() => ({ message: "Registration failed." }));

      if (!response.ok) {
        toast.error(result.message || "Sign up failed. Please try again.");
        setIsSubmitting(false);
        return;
      }

      toast.success("Account created! You can sign in now.");
      setFormData({ fullName: "", email: "", password: "", secretCode: "" });
      setErrors({});

      setTimeout(() => {
        router.push("/login");
      }, 1200);
    } catch (err: any) {
      console.error("Unexpected error during registration:", err.message);
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      {/* Background Image */}
      <div
        className="fixed inset-0 z-[-1] bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=1920&q=80')",
        }}
      >
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>
      </div>

      {/* Register Card */}
      <div className="w-full max-w-md rounded-2xl border border-white/20 bg-white/10 p-8 shadow-xl backdrop-blur-md dark:border-white/10 dark:bg-slate-950/60">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white drop-shadow-lg">
            Create Account
          </h1>
          <p className="mt-2 text-sm text-white/80">Join Block9 today</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Full Name */}
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-white/90">
              Full Name
            </label>
            <div className="relative mt-2">
              <User className="absolute left-3 top-3 h-5 w-5 text-white/50" />
              <input
                id="fullName"
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleInputChange}
                placeholder="John Doe"
                disabled={isSubmitting}
                className={`w-full rounded-lg border bg-white/10 py-2.5 pl-10 pr-4 text-white placeholder-white/50 backdrop-blur-md transition focus:outline-none focus:ring-2 disabled:opacity-50 ${
                  errors.fullName
                    ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/30"
                    : "border-white/20 focus:border-blue-400 focus:ring-blue-400/30"
                }`}
              />
            </div>
            {errors.fullName && (
              <p className="mt-1 text-xs text-red-300">{errors.fullName}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-white/90">
              Email
            </label>
            <div className="relative mt-2">
              <Mail className="absolute left-3 top-3 h-5 w-5 text-white/50" />
              <input
                id="email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="you@example.com"
                disabled={isSubmitting}
                className={`w-full rounded-lg border bg-white/10 py-2.5 pl-10 pr-4 text-white placeholder-white/50 backdrop-blur-md transition focus:outline-none focus:ring-2 disabled:opacity-50 ${
                  errors.email
                    ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/30"
                    : "border-white/20 focus:border-blue-400 focus:ring-blue-400/30"
                }`}
              />
            </div>
            {errors.email && (
              <p className="mt-1 text-xs text-red-300">{errors.email}</p>
            )}
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-white/90">
              Password
            </label>
            <div className="relative mt-2">
              <Lock className="absolute left-3 top-3 h-5 w-5 text-white/50" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="••••••••"
                disabled={isSubmitting}
                className={`w-full rounded-lg border bg-white/10 py-2.5 pl-10 pr-10 text-white placeholder-white/50 backdrop-blur-md transition focus:outline-none focus:ring-2 disabled:opacity-50 ${
                  errors.password
                    ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/30"
                    : "border-white/20 focus:border-blue-400 focus:ring-blue-400/30"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-white/50 transition hover:text-white/80"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-xs text-red-300">{errors.password}</p>
            )}
          </div>

          {/* Section Secret Code */}
          <div>
            <label htmlFor="secretCode" className="block text-sm font-medium text-white/90">
              Section Secret Code
            </label>
            <div className="relative mt-2">
              <Code className="absolute left-3 top-3 h-5 w-5 text-white/50" />
              <input
                id="secretCode"
                type="text"
                name="secretCode"
                value={formData.secretCode}
                onChange={handleInputChange}
                placeholder="Enter code"
                disabled={isSubmitting}
                className={`w-full rounded-lg border bg-white/10 py-2.5 pl-10 pr-4 text-white placeholder-white/50 uppercase tracking-wider backdrop-blur-md transition focus:outline-none focus:ring-2 disabled:opacity-50 ${
                  errors.secretCode
                    ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/30"
                    : "border-white/20 focus:border-blue-400 focus:ring-blue-400/30"
                }`}
              />
            </div>
            {errors.secretCode && (
              <p className="mt-1 text-xs text-red-300">{errors.secretCode}</p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-8 w-full rounded-lg bg-blue-600 py-2.5 font-medium text-white shadow-lg transition hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="h-5 w-5 animate-spin"
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
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Creating Account...
              </span>
            ) : (
              "Create Account"
            )}
          </button>

          {/* Login Link */}
          <div className="pt-4 text-center">
            <p className="text-sm text-white/80">
              Already have an account?{" "}
              <a
                href="/login"
                className="font-medium text-blue-300 transition hover:text-blue-200 hover:underline"
              >
                Sign in
              </a>
            </p>
          </div>
        </form>

        {/* Info Box */}
        <div className="mt-6 rounded-lg border border-blue-400/30 bg-blue-500/10 p-3">
          <p className="text-xs text-blue-200">
            <strong>Tip:</strong> Use your class section secret code to create an account, then sign in.
          </p>
        </div>
      </div>
    </div>
  );
}
