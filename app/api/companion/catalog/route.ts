import { publicCatalog } from "@/lib/catalog";
import { companionRoute } from "@/lib/api/companion";

/** Public data, but behind the token so it can't be scraped anonymously. */
export const GET = companionRoute(null, async () => ({ games: publicCatalog() }));
