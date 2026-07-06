import Link from "next/link";

const navItems = [
  { label: "Classes", href: "/classes" },
  // Not yet implemented — enabled as their routes ship.
  { label: "Students", href: null },
  { label: "Exams", href: null },
  { label: "Analytics", href: null },
] as const;

export function SiteNav() {
  return (
    <header className="border-border bg-background/95 sticky top-0 z-40 border-b backdrop-blur">
      <nav className="mx-auto flex h-14 w-full max-w-5xl items-center gap-6 px-6">
        <Link href="/" className="font-semibold tracking-tight">
          TeacherOS
        </Link>
        <ul className="flex items-center gap-4 text-sm">
          {navItems.map((item) => (
            <li key={item.label}>
              {item.href ? (
                <Link
                  href={item.href}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className="text-muted-foreground/50 cursor-default"
                  title="Coming soon"
                >
                  {item.label}
                </span>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
