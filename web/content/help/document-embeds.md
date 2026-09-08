---
title: Document Embeds
---

# Document Embeds

Embed the content of another note inline using `![[note-name]]` syntax.
This is different from a wikilink — the full rendered content appears in place.

## Full note embed

:::example
![[meeting-notes]]
:::

Renders the entire content of `meeting-notes.md` at that point in the document.
If the note exists in your vault, the preview panel above shows the live embed; otherwise you will see an *Embed not found* placeholder with the same UI.

## Section embed

:::example
![[meeting-notes#Action items]]
:::

Renders only the content under the **Action items** heading in that note.

## Wikilink vs embed

:::example
See [[project-plan]] for the overview.

![[project-plan#Goals]]
:::

Use `[[note]]` for a clickable link. Use `![[note]]` or `![[note#Section]]` to render content inline.

## Nesting

Embeds render up to 2 levels deep to prevent infinite loops.

## Use cases

- **Home page** — embed summaries from project notes
- **Meeting notes** — embed the relevant spec or design doc
- **Weekly journal** — embed highlights from daily notes
- **Index pages** — embed child documents into a parent overview

:::example
> [!TIP]
> Combine embeds with wikilinks: use `[[note]]` when you want a clickable link,
> and `![[note]]` when you want the full content rendered inline.
:::
