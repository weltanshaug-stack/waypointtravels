# Why later days lose their photos — and how to fix it

## What's actually happening

The itinerary sends every activity's search phrase to the server in one batch, and the server hands out photos **in day order, first come first served**. Early days claim the good matches; later days get whatever is left. Four things in the current code cause this, all confirmed by reading `src/lib/waypoint/images.server.ts`:

1. **Exclusive claiming, in order.** Every chosen photo is added to a "used" set so no two events repeat. Events processed later find their best candidates already taken.
2. **The rescue search is capped at 12 events.** Events with no first-pass match get a second, activity-only search — but only the first 12. Since the unresolved list follows day order, later days skip the rescue entirely.
3. **The last-resort destination pool holds only 8 photos** (one Wikipedia request, limit 8). After 8 fallbacks it is empty, so remaining events get *no* candidates at all and the card falls back to a bundled local travel photo — which reads as a wrong/generic image.
4. **Search failures are silent.** A search that times out (6s) returns an empty list, and a burst test against the free photo API showed occasional timeouts under load. Those events go straight to fallback.

Net effect: days 1–2 look great, later days show generic or bundled photos.

## The fix

Make photo assignment fair across the whole trip instead of first-come-first-served, and make the fallback pool deep enough that it never runs dry.

- **Two-pass assignment.** Collect scored candidates for every event first, then assign photos globally: each event's best *unique* option is chosen in order of confidence, not day order. A later day with a strong exact match keeps it; a weaker match yields instead.
- **Allow a repeat before allowing a blank.** If an event's only relevant options are all taken, reuse a relevant photo rather than dropping to a generic one. Relevance outranks uniqueness at the bottom of the ladder — uniqueness stays enforced wherever there is any alternative.
- **Rescue every unresolved event, not the first 12.** Raise the cap to cover a full itinerary and run the activity-only searches in small concurrent batches so the free API isn't hammered.
- **Retry timed-out searches once** with a slightly longer timeout, so a slow request doesn't silently cost an event its photo.
- **Deepen the fallback pool.** Request more destination photos (larger Wikipedia limit, plus one broad "<destination> city" photo search) so the pool has enough distinct images for a 7-day trip, and keep the existing per-category backup search (museum, market, hike, restaurant …) as the preferred fallback.
- **Never return an empty candidate list** for an event while any relevant or destination photo remains unused.

## Technical notes

All changes are in `src/lib/waypoint/images.server.ts`; `ActivityImage.tsx` and `TripGuide.tsx` stay as they are (the client contract — an ordered array of candidate URLs per query — does not change).

- Restructure `fetchImagesForQueries` into: gather → score → global assign → rescue → category fallback → destination fallback.
- Global assign: build `{ query, candidates[], score }`, sort assignment order by top-candidate score descending, then claim uniquely; a second sweep fills any still-empty query allowing reuse of its own best relevant candidate.
- `searchOpenverse`: single retry on `AbortError`/timeout, 6s then 9s.
- Destination pool: Wikipedia `gsrlimit` 8 → 20, plus one `searchOpenverse("<destination> city")` merged and deduped by image identity.
- Request budget stays roughly the same order of magnitude: 1 per unique event + bounded rescues + ~1 per category + 2 shared destination requests.

## Verification

Run a full demo trip (7 days) and confirm every event on every day shows a real, on-topic photo, with no repeats and no bundled-placeholder cards.
