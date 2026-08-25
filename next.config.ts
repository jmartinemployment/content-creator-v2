import type { NextConfig } from "next";

const NOINDEX = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];

const SECURED = ["/app/:path*", "/auth/:path*", "/api/:path*"];

const nextConfig: NextConfig = {
  async headers() {
    const secured = SECURED.map((source) => ({ source, headers: NOINDEX }));
    return process.env.ALLOW_INDEXING === "true"
      ? secured
      : [{ source: "/:path*", headers: NOINDEX }];
  },
};

export default nextConfig;
