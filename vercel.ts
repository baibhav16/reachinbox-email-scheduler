const apiOrigin = process.env.RENDER_API_ORIGIN?.replace(/\/$/, '');

export const config = {
  framework: 'vite',
  installCommand: 'npm ci',
  buildCommand: 'npm run build --workspace @reachinbox/web',
  outputDirectory: 'apps/web/dist',
  rewrites: [
    ...(apiOrigin
      ? [
          { source: '/api/:path*', destination: `${apiOrigin}/api/:path*` },
          { source: '/admin/queues', destination: `${apiOrigin}/admin/queues` },
          { source: '/admin/queues/:path*', destination: `${apiOrigin}/admin/queues/:path*` }
        ]
      : []),
    { source: '/(.*)', destination: '/index.html' }
  ]
};
