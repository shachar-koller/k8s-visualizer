import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "KubeScope — See your cluster. Understand Kubernetes.",
  description:
    "Explore Kubernetes with a deterministic, interactive cluster simulator. Watch controllers, scheduling, networking, and self-healing in action.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
