"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff, KeyRound, Loader2, Lock, Mail, User } from "lucide-react";
import { AuthScreen, authButtonClass, authInputClass } from "@/components/auth-ui";

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
      newErrors.email = "Enter a valid email address";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 6) {
      newErrors.password = "Use at least 6 characters";
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
        return;
      }

      toast.success("Account created. You can sign in now.");
      setFormData({ fullName: "", email: "", password: "", secretCode: "" });
      setErrors({});
      router.push("/login");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unexpected error";
      console.error("Unexpected error during registration:", message);
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
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  return (
    <AuthScreen title="Create your account" subtitle="Join the Block9 class board with your section code.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Full name" htmlFor="fullName" error={errors.fullName}>
          <User className="pointer-events-none absolute left-3.5 top-3.5 h-5 w-5 text-white/55" />
          <input
            id="fullName"
            type="text"
            name="fullName"
            autoComplete="name"
            value={formData.fullName}
            onChange={handleInputChange}
            placeholder="Your full name"
            disabled={isSubmitting}
            className={authInputClass(Boolean(errors.fullName))}
          />
        </Field>

        <Field label="Email" htmlFor="email" error={errors.email}>
          <Mail className="pointer-events-none absolute left-3.5 top-3.5 h-5 w-5 text-white/55" />
          <input
            id="email"
            type="email"
            name="email"
            autoComplete="email"
            value={formData.email}
            onChange={handleInputChange}
            placeholder="you@school.edu"
            disabled={isSubmitting}
            className={authInputClass(Boolean(errors.email))}
          />
        </Field>

        <Field label="Password" htmlFor="password" error={errors.password}>
          <Lock className="pointer-events-none absolute left-3.5 top-3.5 h-5 w-5 text-white/55" />
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            name="password"
            autoComplete="new-password"
            value={formData.password}
            onChange={handleInputChange}
            placeholder="At least 6 characters"
            disabled={isSubmitting}
            className={`${authInputClass(Boolean(errors.password))} pr-12`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            className="absolute right-3 top-3 rounded-md p-1 text-white/60 transition hover:text-white"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </Field>

        <Field label="Section secret code" htmlFor="secretCode" error={errors.secretCode}>
          <KeyRound className="pointer-events-none absolute left-3.5 top-3.5 h-5 w-5 text-white/55" />
          <input
            id="secretCode"
            type="text"
            name="secretCode"
            autoComplete="off"
            value={formData.secretCode}
            onChange={handleInputChange}
            placeholder="Section code"
            disabled={isSubmitting}
            className={`${authInputClass(Boolean(errors.secretCode))} uppercase tracking-[0.08em]`}
          />
        </Field>

        <button type="submit" disabled={isSubmitting} className={authButtonClass}>
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {isSubmitting ? "Creating account" : "Create account"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-white/75">
        Already registered?{" "}
        <Link href="/login" className="font-semibold text-sky-200 hover:text-white">
          Sign in
        </Link>
      </p>
      <p className="mt-4 text-center text-xs leading-relaxed text-white/55">
        Ask your section for the code, then sign in with the email you used here.
      </p>
    </AuthScreen>
  );
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-white/90">
        {label}
      </label>
      <div className="relative">{children}</div>
      {error ? <p className="mt-1.5 text-xs text-rose-200">{error}</p> : null}
    </div>
  );
}
