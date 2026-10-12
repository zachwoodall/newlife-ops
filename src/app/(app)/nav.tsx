"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/department", label: "My Department" },
  { href: "/tasks", label: "Task Directory" },
  { href: "/weekly", label: "This Week" },
  { href: "/calendar", label: "Calendar" },
  { href: "/announcements", label: "Announcements" },
  { href: "/messages", label: "Messages" },
  { href: "/notifications", label: "Alerts" },
  { href: "/search", label: "Search" },
];

export function Nav({
  dueSoon = 0,
  unread = 0,
  alerts = 0,
}: {
  dueSoon?: number;
  unread?: number;
  alerts?: number;
}) {
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
            {link.href === "/messages" && unread > 0 && (
              <span
                title={`${unread} unread`}
                className={
                  active
                    ? "ml-1.5 rounded-full bg-white/25 px-1.5 py-0.5 text-[11px] font-semibold"
                    : "ml-1.5 rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] font-semibold text-white"
                }
              >
                {unread}
              </span>
            )}
            {link.href === "/notifications" && alerts > 0 && (
              <span
                title={`${alerts} unread`}
                className={
                  active
                    ? "ml-1.5 rounded-full bg-white/25 px-1.5 py-0.5 text-[11px] font-semibold"
                    : "ml-1.5 rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] font-semibold text-white"
                }
              >
                {alerts}
              </span>
            )}
            {link.href === "/" && dueSoon > 0 && (
              <span
                title={`${dueSoon} due today or overdue`}
                className={
                  active
                    ? "ml-1.5 rounded-full bg-white/25 px-1.5 py-0.5 text-[11px] font-semibold"
                    : "ml-1.5 rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] font-semibold text-white"
                }
              >
                {dueSoon}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
