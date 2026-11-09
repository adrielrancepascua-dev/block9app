"use client";

import GoogleSignInCard from "@/components/GoogleSignInCard";

export default function RegisterPage() {
  return (
    <GoogleSignInCard
      subtitle="Creating an account opens Google. After that, you choose your name, email, and password."
      buttonLabel="Continue with Google"
      prompt="Already joined?"
      href="/login"
      linkLabel="Sign in"
      nextPath="/welcome"
      autoStart
    />
  );
}
