import { requireOwner } from "@/lib/auth";
import { loadWebsite } from "@/lib/website/service";
import { websiteContent } from "@/lib/website/content";
import { stateMediaRefs } from "@/lib/website/schema";
import { getSettings } from "@/lib/tenant";
import { WebsiteEditor } from "@/components/website/editor";
export default async function Page() {
  const { scope } = await requireOwner();
  const [{ state, revision }, settings, content] = await Promise.all([loadWebsite(scope), getSettings(scope.tenantId), websiteContent(scope)]);
  return <div><h1 className="mb-6 font-display text-3xl font-semibold">Website gestalten</h1><WebsiteEditor initial={state} revision={revision} images={[...new Set([...stateMediaRefs(state), ...(settings?.websiteMedia.map(m => m.url) ?? []), settings?.heroImageUrl, settings?.logoUrl].filter((url): url is string => !!url))]} content={content}/></div>;
}
