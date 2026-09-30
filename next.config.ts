import type {NextConfig} from "next";
const nextConfig:NextConfig={
  // Internal preview only; has no effect on production origins or authentication.
  allowedDevOrigins:["terminal.local"],
};
export default nextConfig;
