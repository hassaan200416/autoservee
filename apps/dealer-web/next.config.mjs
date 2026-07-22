/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@autoserve/shared-types", "@autoserve/supabase-client", "@autoserve/shared-ui"],
};
export default nextConfig;
