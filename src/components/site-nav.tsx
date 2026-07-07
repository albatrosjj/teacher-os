import Link from "next/link";

const navItems = [
  { label: "Classes", href: "/classes" },
  { label: "Students", href: "/students" },
  { label: "Exams", href: "/exams" },
  { label: "Performance", href: "/performance" },
  { label: "Reports", href: "/reports" },
  { label: "Voice Note", href: "/voice" },
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
              <Link
                href={item.href}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
