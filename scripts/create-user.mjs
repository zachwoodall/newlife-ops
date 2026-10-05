/**
 * Creates (or re-points) a staff login in Supabase Auth and links it to the
 * matching row in `people`. Run: npm run user:create -- email@example.com
 *
 * Reads SUPABASE_SERVICE_ROLE_KEY from .env.local. The password is read from
 * SETUP_USER_PASSWORD so it never passes through a command line or a log.
 */

import "dotenv/config";

const email = process.argv[2];
const password = process.env.SETUP_USER_PASSWORD;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!email) {
  console.error("\n  Usage: npm run user:create -- someone@newlifecanton.com\n");
  process.exit(1);
}
if (!key) {
  console.error("\n  SUPABASE_SERVICE_ROLE_KEY is not set in .env.local\n");
  process.exit(1);
}
if (!password) {
  console.error("\n  SETUP_USER_PASSWORD is not set in .env.local\n");
  process.exit(1);
}

const res = await fetch(`${url}/auth/v1/admin/users`, {
  method: "POST",
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ email, password, email_confirm: true }),
});

const body = await res.json();

if (!res.ok) {
  console.error(`\n  Failed (${res.status}): ${body.msg ?? body.message ?? JSON.stringify(body)}\n`);
  process.exit(1);
}

console.log(`\n  Created login for ${email}`);
console.log(`  Confirmed: ${body.email_confirmed_at ? "yes" : "no"}\n`);
