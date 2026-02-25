/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["192.168.1.37"],
  env: {
    NEXT_PUBLIC_USE_MOCKS: process.env.NEXT_PUBLIC_USE_MOCKS ?? process.env.VITE_USE_MOCKS,
    NEXT_PUBLIC_ANUBIS_BASE_URL:
      process.env.NEXT_PUBLIC_ANUBIS_BASE_URL ?? process.env.VITE_ANUBIS_BASE_URL,
    NEXT_PUBLIC_ANUBIS_APP_ID: process.env.NEXT_PUBLIC_ANUBIS_APP_ID ?? process.env.VITE_ANUBIS_APP_ID,
    NEXT_PUBLIC_GOOGLE_CLIENT_ID:
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? process.env.VITE_GOOGLE_CLIENT_ID,
    NEXT_PUBLIC_FANTASY_API_BASE_URL:
      process.env.NEXT_PUBLIC_FANTASY_API_BASE_URL ?? process.env.VITE_FANTASY_API_BASE_URL
  }
};

export default nextConfig;
