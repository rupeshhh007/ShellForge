import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main" className="page-shell empty-page">
      <p className="mono">404 / Beyond the workbench</p>
      <h1>Nothing forged here.</h1>
      <p>This page does not exist.</p>
      <Link href="/forge" className="button">
        Enter the Forge ↗
      </Link>
    </main>
  );
}
