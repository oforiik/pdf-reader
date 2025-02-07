module.exports = {
  webpack: (config) => {
    config.resolve.fallback = { 
      canvas: false,
      fs: false 
    };
    return config;
  },
  experimental: {
    serverComponentsExternalPackages: ['pdfjs-dist']
  }
};