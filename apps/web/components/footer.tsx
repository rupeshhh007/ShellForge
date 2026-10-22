import Link from "next/link";

export function Footer() {
  return (
    <footer className="site-footer">
      <Link href="/" className="footer-brand">
        ShellForge<span> / The interactive command laboratory.</span>
      </Link>
      <div>
        <span>Made to understand. Never to execute.</span>
        <Link href="/manual" aria-label="Field Manual">Field Manual ↗</Link><Link href="/xray">X-Ray ↗</Link>
      </div>
      <a href="https://github.com/rupeshhh007/ShellForge">
        Source & research ↗
      </a>
    </footer>
  );
}
