import Link from "next/link";
import { BookOpen, Play, Sparkles } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link href="/" className="brand" aria-label="Slay Tracker home">
        <span className="brand-mark" aria-hidden="true">
          <Sparkles size={19} strokeWidth={3} />
        </span>
        <span>SLAY TRACKER</span>
      </Link>
      <nav className="site-nav" aria-label="Main navigation">
        <Link href="/cards">
          <BookOpen size={17} />
          <span>Cards</span>
        </Link>
        <Link href="/play" className="nav-play">
          <Play size={16} fill="currentColor" />
          <span>Play</span>
        </Link>
      </nav>
    </header>
  );
}
