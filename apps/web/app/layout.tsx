import type { Metadata } from "next";
import "@fontsource/instrument-serif/latin-400.css";
import "@fontsource/instrument-serif/latin-400-italic.css";
import "@fontsource-variable/manrope";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "./globals.css";
import "./impact.css";
import "./studio.css";
import { StudioCursor } from "@/components/studio-cursor";
import { Navigation } from "@/components/navigation";
import { Footer } from "@/components/footer";
import { ImpactSessionProvider } from "@/components/impact-session";
import { MotionProvider } from "@/components/motion-provider";

export const metadata: Metadata = {
  title: {
    default: "ShellForge — The Interactive Command Laboratory",
    template: "%s · ShellForge",
  },
  description:
    "Describe the operation. Understand the command. Inspect the consequences. Bash proposals and static review, without execution.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <MotionProvider>
          <a className="skip-link" href="#main">
            Skip to content
          </a>
          <Navigation />
          <ImpactSessionProvider>{children}</ImpactSessionProvider>
          <StudioCursor />
          <Footer />
        </MotionProvider>
      </body>
    </html>
  );
}
