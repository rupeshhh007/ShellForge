import Link from "next/link";

export function Footer() {
  return (
    <footer className="site-footer">
      <Link href="/" className="footer-brand">
        ShellForge<span> / A more deliberate shell.</span>
      </Link>
      <div>
        <span>Made to understand. Never to execute.</span>
        <a href="https://rareui.com">Interactions adapted from Rare UI ↗</a>
      </div>
      <a href="https://github.com/rupeshhh007/ShellForge">
        Source & research ↗
      </a>
    </footer>
  );
}
