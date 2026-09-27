/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      ...['home', 'skills', 'progress', 'profile', 'badges', 'daily', 'login', 'signup', 'onboarding', 'role'].map((route) => ({
        source: `/${route}`,
        destination: `/app/${route}`,
        permanent: false,
      })),
      ...['levels', 'sessions', 'p'].map((route) => ({
        source: `/${route}/:path*`,
        destination: `/app/${route}/:path*`,
        permanent: false,
      })),
    ]
  },
}

module.exports = nextConfig
