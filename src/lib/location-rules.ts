import { z } from "zod";

const latitude = z.number().finite().min(-85).max(85);
const longitude = z.number().finite().min(-180).max(180);
export const locationSchema = z
  .object({
    enabled: z.boolean().default(false),
    address: z.string().trim().max(300).default(""),
    lat: latitude.nullable().default(null),
    lng: longitude.nullable().default(null),
    height: z.enum(["compact", "standard", "large"]).default("standard"),
    zoom: z.number().int().min(3).max(18).default(15),
    centerLat: latitude.nullable().default(null),
    centerLng: longitude.nullable().default(null),
    markerColor: z
      .string()
      .regex(/^#[a-fA-F0-9]{6}$/)
      .nullable()
      .default(null),
    directions: z.string().trim().max(2000).default(""),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.enabled &&
      (!value.address || value.lat === null || value.lng === null)
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          "Für eine aktive Karte bitte Besuchsadresse und beide Koordinaten angeben.",
      });
    }
    if (
      (value.lat === null) !== (value.lng === null) ||
      (value.centerLat === null) !== (value.centerLng === null)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Bitte immer beide Koordinaten angeben.",
      });
    }
  });
export type ShelterLocation = z.infer<typeof locationSchema>;
export const locationDefaults: ShelterLocation = locationSchema.parse({});
export function routeLinks(lat: number, lng: number) {
  const target = `${lat},${lng}`;
  return [
    {
      name: "Apple Maps",
      href: `https://maps.apple.com/?daddr=${encodeURIComponent(target)}`,
    },
    {
      name: "Google Maps",
      href: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(target)}`,
    },
    {
      name: "OpenStreetMap",
      href: `https://www.openstreetmap.org/directions?route=${encodeURIComponent(`;${target}`)}`,
    },
  ];
}
