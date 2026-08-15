import type { Metadata } from "next";
import { headers } from "next/headers";
import Script from "next/script";
import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";

const description = "Explore how ground motion, site conditions, and structural design influence earthquake response in an interactive Three.js simulator.";

export async function generateMetadata(): Promise<Metadata> {
  const incomingHeaders = await headers();
  const host = incomingHeaders.get("x-forwarded-host") ?? incomingHeaders.get("host") ?? "localhost:3000";
  const protocol = incomingHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    title: "SEISMIC — Structural Response Lab",
    description,
    icons: { icon: "/favicon.png", shortcut: "/favicon.png" },
    openGraph: {
      title: "SEISMIC — Structural Response Lab",
      description,
      type: "website",
      images: [{ url: `${origin}/og.png`, width: 1731, height: 909, alt: "SEISMIC structural response simulator" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "SEISMIC — Structural Response Lab",
      description,
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <Script
          id="microsoft-clarity"
          strategy="beforeInteractive"
        >{`(function(c,l,a,r,i,t,y){
          c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
          t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
          y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
        })(window, document, "clarity", "script", "y2tlzpkgbx");`}</Script>
        <Script
          id="linkedin-profile-badge-script"
          src="https://platform.linkedin.com/badges/js/profile.js"
          strategy="afterInteractive"
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
