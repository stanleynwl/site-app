import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSerwist } from "@serwist/turbopack";

const nextConfig: NextConfig = {
  experimental: {
    // Claim-photo uploads go through a server action; the 1 MB default is too
    // small for phone/scanner JPEGs.
    serverActions: { bodySizeLimit: "10mb" },
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withSerwist(withNextIntl(nextConfig));
