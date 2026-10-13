"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SECTIONS, sectionFor, childFor } from "@/lib/navigation";

function Badge({ count, active }: { count: number; active: boolean }) {
  if (count <= 0) return null;
  return (
    <span
      title={`${count}`}
      className={
        active
          ? "ml-1.5 rounded-full bg-white/25 px-1.5 py-0.5 text-[11px] font-semibold"
          : "ml-1.5 rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] font-semibold text-white"
      }
    >
      {count}
    </span>
  );
}

export function Nav({ dueSoon = 0 }: { dueSoon?: number }) {
  const pathname = usePathname();
  const current = sectionFor(pathname);

  return (
    <nav className="flex gap-1" aria-label="Main">
      {SECTIONS.map((section) => {
        const active = current?.href === section.href;
        return (
          <Link
            key={section.href}
            href={section.href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "bg-brand-500 rounded-md px-3 py-1.5 text-sm font-medium text-white"
                : "text-muted hover:bg-brand-50 hover:text-brand-700 rounded-md px-3 py-1.5 text-sm font-medium transition-colors dark:hover:bg-neutral-800"
            }
          >
            {section.label}
            {section.href === "/" && <Badge count={dueSoon} active={active} />}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * The tabs within a section. Rendered once in the layout rather than by each
 * page, so a page can never forget them or disagree about which is current.
 */
export function SectionTabs() {
  const pathname = usePathname();
  const section = sectionFor(pathname);
  if (!section || section.children.length === 0) return null;

  const current = childFor(pathname, section);

  return (
    <div className="border-border border-b">
      <div className="mx-auto flex w-full max-w-5xl gap-4 px-6">
        {section.children.map((child) => {
          const active = current?.href === child.href;
          return (
            <Link
              key={child.href}
              href={child.href}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "border-brand-500 -mb-px border-b-2 py-2.5 text-sm font-medium"
                  : "text-muted hover:text-brand-700 -mb-px border-b-2 border-transparent py-2.5 text-sm font-medium"
              }
            >
              {child.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
