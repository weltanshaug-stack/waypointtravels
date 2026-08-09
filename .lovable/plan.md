# Why some itinerary images never appear

## What's actually happening

There are three separate causes, and only one of them is a network problem.

**1. Many events get zero candidate photos at all (main cause).**
The image service only keeps a photo if it scores at least 68–80 out of 100, and scoring starts from word overlap between the event text and the photo's title/tags. If no word from the event matches, the score is 0 and the photo is discarded — even when it is a perfectly good picture. Checked live against the photo API: a search for "coffee breakfast Lisbon" returns real Lisbon bakery photos titled "Pasteis de Belem", which share no words with "coffee breakfast", so every one is thrown away. Photos narrower than 640px are also dropped. The result is an empty list for that event.

**2. An empty list shows a skeleton forever, not a fallback.**
In the image component, when there are no candidates the "exhausted" state is never reached (it requires at least one candidate), so the card stays in the pulsing loading state permanently. That is the "image never loads" the user sees — it isn't loading, there is simply nothing to load, and no fallback is ever shown.

**3. There is no last-resort destination photo, and photos are hotlinked.**
The fallback ladder stops at "the activity, anywhere" — it never falls back to a plain city/landmark photo. Separately, accepted URLs point at third-party photo hosts, which can rate-limit, expire or block hotlinking, so a card that did resolve can still end up empty on some loads. All ~45 events are fetched in one request, so one failed or rate-limited request wipes out every image on the page at once.

## The fix

**Guarantee a photo for every event**
- Keep the strict scoring for choosing the *best* photo, but stop letting it produce nothing: after the strict tiers, add relaxed tiers (lower threshold, then best-available) and finally a destination-level photo ("<city> landmark", "<city> cityscape") so every event ends with a non-empty candidate list.
- Score on partial word matching rather than exact whole-word containment, so "breakfast pastry" still matches a bakery photo.
- Lower the small-image cut-off from 640px to 400px; the layout upscales fine and this recovers a large share of otherwise-good photos.

**Never leave a card stuck loading**
- In the image component, treat "no candidates" as exhausted so the branded placeholder shows instead of an endless skeleton.
- Reset the loaded/error state properly when the candidate list changes, and cap the per-candidate timeout so a hanging URL moves on faster.
- Add a shared, always-valid destination image as the final candidate for every card.

**Make the fetch resilient**
- Split the single 45-query request into smaller batches so one failure or rate-limit only affects a few cards, not the whole page, and let each batch retry independently.
- Keep the successful-URL session cache so re-renders and revisions don't re-resolve images.

## Technical notes

- `src/lib/waypoint/images.server.ts` — relaxed/destination tiers appended to `poolFor`, partial-match scoring in `scoreCandidate`, width floor in `isDisqualified`, guarantee non-empty arrays from `fetchImagesForQueries`.
- `src/components/waypoint/ActivityImage.tsx` — `exhausted` true when the candidate list is empty, state reset on candidate identity change, shorter load timeout.
- `src/components/waypoint/TripGuide.tsx` — chunked image queries with per-chunk `useQuery`, merged into one lookup map.
- Global de-duplication of primary photos stays; the destination fallback is allowed to repeat, since a relevant repeat beats a blank card.
