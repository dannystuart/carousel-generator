import type { Metadata } from "next";
import { Instrument_Serif, JetBrains_Mono, Schibsted_Grotesk } from "next/font/google";
import { COPY } from "@/data/copy";
import "./globals.css";

// A high-contrast editorial serif against a technical grotesque and a real code
// face: the tool is precise, but it is not a spreadsheet.
const display = Instrument_Serif({
  variable: "--font-instrument-serif",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
});

const sans = Schibsted_Grotesk({
  variable: "--font-schibsted",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

// Every search-facing string comes from the copydeck — see src/data/copy.ts.
// The card, the title and the description all read from the one place, so a
// change to any of them cannot leave the others behind.
export const metadata: Metadata = {
  title: COPY.title,
  description: COPY.description,
  openGraph: {
    title: COPY.title,
    description: COPY.description,
    type: "website",
    images: [{ url: "/social-card.png", width: 1200, height: 630, alt: COPY.socialCardAlt }],
  },
  twitter: {
    card: "summary_large_image",
    title: COPY.title,
    description: COPY.description,
    images: [{ url: "/social-card.png", alt: COPY.socialCardAlt }],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
