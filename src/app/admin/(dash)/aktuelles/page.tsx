import Link from "next/link";
import { formatDate, getAllPosts } from "@/lib/posts";
import { deletePost } from "@/lib/actions/posts";
import { requireAdmin } from "@/lib/auth";
import { ConfirmButton } from "@/components/admin/confirm-button";

export default async function AdminAktuellesPage() {
  const { scope } = await requireAdmin();
  const all = await getAllPosts(scope);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
          Aktuelles
        </h1>
        <Link
          href="/admin/aktuelles/neu"
          className="rounded-full bg-brand-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          + Neuer Beitrag
        </Link>
      </div>

      {all.length === 0 ? (
        <p className="mt-8 text-sm text-ink/50">Noch keine Beiträge.</p>
      ) : (
        <ul className="mt-6 divide-y divide-stone-100 rounded-2xl bg-white ring-1 ring-stone-200">
          {all.map((post) => (
            <li key={post.id} className="flex items-center gap-4 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink">{post.title}</p>
                <p className="text-sm text-ink/50">
                  {formatDate(post.createdAt)} ·{" "}
                  {post.published ? (
                    <span className="text-brand-700">veröffentlicht</span>
                  ) : (
                    <span className="text-accent-700">Entwurf</span>
                  )}
                </p>
              </div>
              <Link
                href={`/admin/aktuelles/${post.id}`}
                className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-100"
              >
                Bearbeiten
              </Link>
              <form action={deletePost}>
                <input type="hidden" name="id" value={post.id} />
                <ConfirmButton question={`„${post.title}“ wird gelöscht.`} />
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
