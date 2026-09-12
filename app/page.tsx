import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

/** Root: signed in → dashboard, otherwise → sign-in. */
export default async function Page() {
  redirect((await getSession()) ? "/dashboard" : "/sign-in");
}
