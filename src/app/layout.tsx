import type { Metadata } from "next";
import { Figtree, Source_Serif_4 } from "next/font/google";
import Link from "next/link";
import { SiteNav } from "@/components/SiteNav";
import { navItems } from "@/lib/nav";
import "./globals.css";

const serif = Source_Serif_4({
  variable: "--font-serif",
  subsets: ["latin"],
});

const sans = Figtree({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Murshid-e-Alam Hazrat Pir Ghulam Habib Naqshbandi (R.A.)",
    template: "%s · Murshid-e-Alam",
  },
  description: "Bayaans, teachings, and remembrance of Hazrat Pir Ghulam Habib Naqshbandi (R.A.).",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} h-full antialiased`}>
      <body>
        <div className="shell">
          <header className="brand">
            <Link href="/" className="brand-mark">
              <img src="/archive/besm.gif" alt="" />
              <span>
                <span className="eyebrow">Naqshbandi · Chakwal</span>
                <span className="site-title">Murshid-e-Alam</span>
                <span className="site-sub">Hazrat Pir Ghulam Habib Naqshbandi (R.A.)</span>
              </span>
            </Link>
          </header>
          <SiteNav />
          <main className="content">{children}</main>
          <footer className="site-footer">
            <nav className="footer-links" aria-label="Footer">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href}>
                  {item.label}
                </Link>
              ))}
            </nav>
            <p>Murshid-e-Alam · Hazrat Pir Ghulam Habib Naqshbandi (R.A.)</p>
          </footer>
        </div>
      </body>
    </html>
  );
}
