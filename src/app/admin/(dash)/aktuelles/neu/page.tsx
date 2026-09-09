import Link from "next/link";
import { PostForm } from "@/components/admin/post-form";

export default function NeuerBeitragPage() {
  return (
    <div className="max-w-2xl">
      <Link
        href="/admin/aktuelles"
        className="text-sm font-medium text-stone-500 transition hover:text-stone-700"
      >
        ← Aktuelles
      </Link>
      <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink">
        Neuer Beitrag
      </h1>
      <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200 md:p-8">
        <PostForm />
      </div>
    </div>
  );
}
