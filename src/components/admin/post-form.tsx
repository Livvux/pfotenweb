"use client";

import { an } from "@/lib/anrede";
import { useAnrede } from "@/components/anrede-provider";
import { useActionState } from "react";
import type { Post } from "@/lib/posts";
import { createPost, updatePost, type PostFormState } from "@/lib/actions/posts";
import { CheckboxField, FormAlert, TextArea, TextField } from "./fields";

const initial: PostFormState = {};

export function PostForm({ post }: { post?: Post }) {
  const address = useAnrede();
  const [state, formAction, pending] = useActionState(
    post ? updatePost : createPost,
    initial,
  );
  const feld = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-5">
      {post ? <input type="hidden" name="id" value={post.id} /> : null}

      <TextField
        name="title"
        label="Titel"
        required
        defaultValue={post?.title}
        error={feld.title}
      />

      <TextArea
        name="body"
        label="Beitrag"
        required
        rows={10}
        defaultValue={post?.body}
        error={feld.body}
        hint="Leerzeilen werden auf der Webseite zu Absätzen."
      />

      <CheckboxField
        name="published"
        label="Veröffentlicht (öffentlich sichtbar)"
        defaultChecked={post?.published ?? false}
        hint={an(address, "Ohne Häkchen bleibt der Beitrag ein Entwurf, den nur Sie sehen.", "Ohne Häkchen bleibt der Beitrag ein Entwurf, den nur du siehst.")}
      />

      {/* Genau ein role="alert" pro Formular, siehe Kommentar in fields.tsx */}
      <FormAlert state={state} />

      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-brand-800 px-7 py-3 font-semibold text-white transition hover:bg-brand-700 active:scale-[0.98] disabled:opacity-60"
      >
        {pending ? "Speichert …" : post ? "Änderungen speichern" : "Beitrag anlegen"}
      </button>
    </form>
  );
}
