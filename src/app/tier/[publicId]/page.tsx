import { redirect } from "next/navigation";
import { animalByPublicId } from "@/lib/animal-downloads";
import { requireScope } from "@/lib/tenant";
export default async function StableAnimalPage({ params }: { params: Promise<{ publicId: string }> }) {
  const animal = await animalByPublicId(await requireScope(), (await params).publicId);
  if (animal) redirect(`/tiere/${encodeURIComponent(animal.slug)}`);
  return <main className="mx-auto max-w-2xl px-4 py-20"><h1 className="text-3xl font-semibold">Steckbrief nicht verfügbar</h1><p className="mt-4">Dieser Tiersteckbrief ist derzeit nicht öffentlich verfügbar.</p></main>;
}
