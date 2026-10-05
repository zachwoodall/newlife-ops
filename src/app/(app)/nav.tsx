"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/department", label: "My Department" },
  { href: "/tasks", label: "Task Directory" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1" aria-label="Main">
      {LINKS.map((link) => {
        const active =
          link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "bg-brand-500 rounded-md px-3 py-1.5 text-sm font-medium text-white"
                : "text-muted hover:bg-brand-50 hover:text-brand-700 rounded-md px-3 py-1.5 text-sm font-medium transition-colors dark:hover:bg-neutral-800"
            }
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
