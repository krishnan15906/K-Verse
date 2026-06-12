/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
   
  turbopack: {},
  experimental: {
    turbo: false
  },

  images: {
    unoptimized: true,
  },
 
}
export default nextConfig
