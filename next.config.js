module.exports = {
  webpack: (config) => {
    config.resolve.fallback = { 
      canvas: false,
      fs: false 
    };
    return config;
  },
  async headers() {
    return [
      {
        source: '/_next/static/pdf.worker.min.js',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/javascript',
          },
        ],
      },
    ];
  }
};