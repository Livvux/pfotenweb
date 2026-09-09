"use client";

import Image from "next/image";
import { useState } from "react";

export function AnimalGallery({
  images,
  name,
}: {
  images: { id: number; url: string }[];
  name: string;
}) {
  const [active, setActive] = useState(0);
  const current = images[active];

  return (
    <div>
      <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-bone">
        {current ? (
          <Image
            src={current.url}
            unoptimized={current.url.startsWith("/uploads/t")}
            alt={`${name} – Foto ${active + 1} von ${images.length}`}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 60vw"
            className="object-cover"
          />
        ) : null}
      </div>
      {images.length > 1 ? (
        <div className="mt-3 flex gap-3">
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Foto ${i + 1} zeigen`}
              aria-current={i === active}
              className={`relative h-20 w-24 overflow-hidden rounded-xl transition ${
                i === active
                  ? "ring-2 ring-brand-700"
                  : "opacity-70 hover:opacity-100"
              }`}
            >
              <Image
                src={img.url}
            unoptimized={img.url.startsWith("/uploads/t")}
                alt=""
                fill
                sizes="96px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
