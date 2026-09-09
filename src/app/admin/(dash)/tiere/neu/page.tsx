import Link from "next/link";
import { AnimalForm } from "@/components/admin/animal-form";

export default function NeuesTierPage() {
  return (
    <div className="max-w-2xl">
      <Link
        href="/admin/tiere"
        className="text-sm font-medium text-stone-500 transition hover:text-stone-700"
      >
        ← Tiere
      </Link>
      <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink">
        Neues Tier anlegen
      </h1>
      <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200 md:p-8">
        <AnimalForm />
      </div>
    </div>
  );
}
