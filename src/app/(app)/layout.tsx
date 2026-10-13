import { createClient } from "@/lib/supabase/server";
import { getCurrentPerson } from "@/lib/current-person";
import { countDueSoon } from "@/lib/tasks-data";
import { countUnread } from "@/lib/messages-data";
import { countUnreadNotifications } from "@/lib/notifications-data";
import { signOut } from "./actions";
import { Nav, SectionTabs } from "./nav";
import { AccountMenu } from "./account-menu";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const current = await getCurrentPerson();
  const dueSoon = current?.person ? await countDueSoon(current.person.id) : 0;
  const unread = current?.person ? await countUnread(current.person.id) : 0;
  const alerts = current?.person ? await countUnreadNotifications() : 0;

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-border border-b">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-3 px-6 py-3">
          <div className="flex items-center gap-2">
            <div className="bg-brand-500 size-6 rounded" aria-hidden />
            <span className="font-semibold">Church Management</span>
          </div>

          <Nav dueSoon={dueSoon} />

          <AccountMenu
            email={user?.email ?? ""}
            alerts={alerts}
            unread={unread}
            signOut={signOut}
          />
        </div>
      </header>

      <SectionTabs />

      {children}
    </div>
  );
}
