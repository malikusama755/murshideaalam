"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { navItems } from "@/lib/nav";

export function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="nav-wrap">
      <button
        type="button"
        className="nav-toggle"
        aria-expanded={open}
        aria-controls="site-sections"
        onClick={() => setOpen((current) => !current)}
      >
        {open ? "Close menu" : "Menu"}
      </button>
      <nav id="site-sections" className={open ? "site-nav open" : "site-nav"} aria-label="Sections">
        {navItems.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link key={item.href} href={item.href} className={active ? "active" : undefined} aria-current={active ? "page" : undefined}>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
