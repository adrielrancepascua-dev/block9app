import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: false, // Disabled to prevent stale loading state cache
  aggressiveFrontEndNavCaching: false, // Disabled during development to prevent caching issues
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
  }
});

/** @type {import("next").NextConfig} */
const nextConfig = {
  turbopack: {},
};

export default withPWA(nextConfig);
