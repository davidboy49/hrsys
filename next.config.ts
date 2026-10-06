import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  experimental: {
    // photo upload (2 MB) and Excel import (4 MB) go through server actions; Vercel caps request bodies at 4.5 MB
    serverActions: { bodySizeLimit: "4.5mb" },
  },
  images: { remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }] },
}

export default nextConfig
