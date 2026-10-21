"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const links = [
  ["/lab", "Impact Lab"],
  ["/forge", "The Forge"],
  ["/xray", "X-Ray"],
  ["/manual", "Field Manual"],
  ["/bench", "The Bench"],
];

export function Navigation() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <Link
        className="wordmark"
        href="/"
        onClick={() => setOpen(false)}
        aria-label="ShellForge home"
      >
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="m5 7 12 9L5 25M19 25h9" />
        </svg>
        ShellForge<span className="wordmark-dot">2.0</span>
      </Link>
      <span className="brand-caption">The command workshop</span>
      <button
        className="menu-button"
        type="button"
        aria-expanded={open}
        aria-controls="main-navigation"
        onClick={() => setOpen(!open)}
      >
        {open ? "Close −" : "Menu +"}
      </button>
      <nav
        id="main-navigation"
        className={open ? "main-nav open" : "main-nav"}
        aria-label="Main navigation"
      >
        {links.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            aria-current={pathname === href ? "page" : undefined}
            onClick={() => setOpen(false)}
          >
            {label}
            <span aria-hidden="true">↗</span>
          </Link>
        ))}
      </nav>
    </header>
  );
}
