/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  webpack: (config) => {
    // 添加对 .node 文件的支持
    config.externals = config.externals || {};
    config.externals['@prisma/client'] = '@prisma/client';
    return config;
  },
};

export default nextConfig;
