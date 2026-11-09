"use client";

import GoogleSignInCard from "@/components/GoogleSignInCard";

export default function LoginPage() {
  return (
    <GoogleSignInCard
      subtitle="Sign in with the Google account you used for Block 9."
      buttonLabel="Continue with Google"
      prompt="New here?"
      href="/register"
      linkLabel="Create an account"
    />
  );
}
