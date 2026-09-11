import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        // The landing lives at /home; the bare domain just points at it.
        // Temporary (307) because moving the landing back to / stays an option
        // and a 308 would be cached by browsers forever.
        source: "/",
        destination: "/home",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
