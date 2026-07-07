import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Exam-paper photos (front + back) are sent to the grading action.
      bodySizeLimit: "15mb",
    },
  },
};

export default nextConfig;
