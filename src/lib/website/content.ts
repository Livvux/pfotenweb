import { getDonations } from "../donations";
import { getAnimals } from "../animals";
import { getPublishedPosts } from "../posts";
import type { TenantScope } from "../tenant";
export type WebsiteContent = {
  animals: { title: string; text: string; image: string; href: string }[];
  posts: { title: string; text: string; image: string; href: string }[];
  hasDonations: boolean;
};
export async function websiteContent(scope: TenantScope): Promise<WebsiteContent> {
  const [animals, posts, donations] = await Promise.all([getAnimals(scope, { status: "vermittelbar", limit: 12, coverOnly: true }), getPublishedPosts(scope, 12), getDonations(scope)]);
  return {
    animals: animals.map(a => ({ title: a.name, text: a.breed ?? "", image: a.images[0]?.url ?? "", href: `/tiere/${a.slug}` })),
    posts: posts.map(p => ({ title: p.title, text: p.body.slice(0, 180), image: "", href: `/aktuelles/${p.slug}` })),
    hasDonations: Boolean(donations.iban && donations.accountHolder),
  };
}
