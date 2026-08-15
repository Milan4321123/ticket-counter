/** @type {import('next').NextConfig} */

const isProd = process.env.NODE_ENV === 'production';

// Content-Security-Policy. 'unsafe-inline' is required for Next.js's inline
// hydration bootstrap and this app's inline style attributes; everything else
// is locked to same-origin plus PayPal (so switching PAYMENT_MODE to paypal
// keeps working). The real wins here are frame-ancestors (anti-clickjacking of
// the admin + checkout), object-src 'none', and base-uri 'self'.
const PAYPAL = 'https://www.paypal.com https://www.paypalobjects.com';
const csp = [
  `default-src 'self'`,
  `base-uri 'self'`,
  `object-src 'none'`,
  `frame-ancestors 'self'`,
  `form-action 'self' https://www.paypal.com`,
  // 'unsafe-eval' is dev-only: next dev's hot-reload runtime needs eval, and
  // without it every page's JS dies silently (dead buttons). Never in prod.
  `script-src 'self' 'unsafe-inline'${isProd ? '' : " 'unsafe-eval'"} ${PAYPAL}`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob: ${PAYPAL} https://*.paypal.com`,
  `font-src 'self' data:`,
  `media-src 'self' blob:`,
  `connect-src 'self' ${PAYPAL} https://api-m.paypal.com https://api-m.sandbox.paypal.com`,
  `frame-src https://www.paypal.com`,
  `worker-src 'self' blob:`,
  `manifest-src 'self'`,
  ...(isProd ? ['upgrade-insecure-requests'] : []),
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  // Belt-and-braces clickjacking protection for browsers that predate CSP frame-ancestors.
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  // Door scanner needs the camera; nothing needs mic or location.
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), browsing-topics=()' },
  // Only meaningful over HTTPS (browsers ignore it on http), so it is safe to
  // send always, but we scope it to production to avoid pinning localhost.
  ...(isProd
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]
    : []),
];

const nextConfig = {
  // Both ship native binaries and must stay outside the bundler.
  serverExternalPackages: ['better-sqlite3', 'sharp'],
  experimental: {
    // This app has a middleware, and Next.js silently TRUNCATES request bodies
    // at 10 MB in that case — a 40 MB video upload then arrives cut in half and
    // fails multipart parsing with an unhelpful error. Must stay comfortably
    // above MAX_VIDEO_BYTES (60 MB) plus the multipart envelope. The upload
    // routes still enforce the real per-file caps on the streamed bytes.
    middlewareClientMaxBodySize: '68mb',
  },
  // Never leak the framework version in the Server/X-Powered-By headers.
  poweredByHeader: false,
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // Belt-and-braces: never let admin pages or API responses be cached by
      // shared proxies/CDNs.
      {
        source: '/admin/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store, must-revalidate' }],
      },
      {
        source: '/api/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store, must-revalidate' }],
      },
      // Order + ticket pages carry buyer PII and a scannable QR: never let a
      // shared proxy cache them or a search engine index them.
      {
        source: '/order/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, must-revalidate' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
      {
        source: '/ticket/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, must-revalidate' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
      {
        source: '/scan/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, must-revalidate' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ];
  },
};

export default nextConfig;
