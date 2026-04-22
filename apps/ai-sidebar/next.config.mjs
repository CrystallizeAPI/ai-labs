/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow Crystallize image domains
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'media.crystallize.com',
      },
    ],
  },
  // Crystallize embeds this app in an iframe from https://app.crystallize.com.
  // Next.js owns all CORS + Private Network Access headers directly, so they apply
  // whether the app is reached via localhost, an ngrok tunnel, or a production URL.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: 'https://app.crystallize.com' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Private-Network', value: 'true' },
        ],
      },
    ];
  },
};

export default nextConfig;
