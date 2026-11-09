"use client";

import GoogleSignInCard from "@/components/GoogleSignInCard";

export default function RegisterPage() {
  return (
    <GoogleSignInCard
      subtitle="Sign up with Google. After that, pick any name you want."
      buttonLabel="Continue with Google"
      prompt="Already joined?"
      href="/login"
      linkLabel="Sign in"
    />
  );
}
