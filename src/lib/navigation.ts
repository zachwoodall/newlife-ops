/**
 * The shape of the navigation.
 *
 * Four places in the top bar, each holding the pages that belong together.
 * Routes are unchanged: notifications already stored URLs like /tasks/<id>
 * and /announcements/<id>, and moving pages would break every one of them.
 * This is only about how you get there.
 */

export type NavChild = { href: string; label: string };
export type NavSection = {
  href: string;
  label: string;
  children: NavChild[];
};

export const SECTIONS: NavSection[] = [
  { href: "/", label: "Home", children: [] },
  {
    href: "/tasks",
    label: "Tasks",
    children: [
      { href: "/tasks", label: "Directory" },
      { href: "/weekly", label: "This week" },
      { href: "/calendar", label: "Calendar" },
    ],
  },
  {
    href: "/announcements",
    label: "Team",
    children: [
      { href: "/announcements", label: "Announcements" },
      { href: "/checkins", label: "Check-ins" },
      { href: "/messages", label: "Messages" },
      { href: "/department", label: "Department" },
    ],
  },
  { href: "/files", label: "Files", children: [] },
];

/** Pages reachable from the account menu rather than the main bar. */
export const ACCOUNT_LINKS: NavChild[] = [{ href: "/admin", label: "Staff access" }];

/**
 * Which section a path belongs to. Home only matches exactly, since every
 * path starts with "/".
 */
export function sectionFor(pathname: string): NavSection | null {
  for (const section of SECTIONS) {
    if (section.href === "/") {
      if (pathname === "/") return section;
      continue;
    }
    if (section.children.some((c) => pathname.startsWith(c.href))) return section;
    if (pathname.startsWith(section.href)) return section;
  }
  return null;
}

/** Which tab within a section is current. */
export function childFor(pathname: string, section: NavSection): NavChild | null {
  // Longest match first, so /tasks does not win over a longer sibling.
  const sorted = [...section.children].sort((a, b) => b.href.length - a.href.length);
  return sorted.find((c) => pathname.startsWith(c.href)) ?? null;
}
