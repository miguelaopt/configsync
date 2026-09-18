import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

/** Root: signed in → dashboard; visitors → pricing until the landing page lands. */
export default async function Page() {
  redirect((await getSession()) ? "/dashboard" : "/pricing");
}
