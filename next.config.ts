import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The annotated-PDF route reads the handwriting font from disk at runtime.
  outputFileTracingIncludes: {
    "/exams/[examId]/annotated": ["./src/features/exams/fonts/*"],
  },
  experimental: {
    serverActions: {
      // Exam-paper photos (front + back) are sent to the grading action.
      bodySizeLimit: "15mb",
    },
  },
};

export default nextConfig;
