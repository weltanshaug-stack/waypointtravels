# Why the plan sometimes doesn't load — and how to fix it

## What the logs show

Every recent failed generation logs the same thing on the server:

```text
[waypoint:itinerary planner] gateway failure No output generated. Check the stream for errors.
```

Two facts from the logs:

1. These failures happen fast (about 0.2–2s), far faster than a real generation (8–34s).
2. The failed attempts do **not** appear in the AI request log at all — the last successful AI call was at 00:19, while failures continue through 00:29. So the request is being rejected before it becomes a model run.
3. The workspace AI budget is nearly used up: 4 credits left of today's 5, bonus grant at 0. A normal plan costs roughly 0.3–0.5 credits, and each attempt currently fires several calls in quick succession.

So the plan "sometimes doesn't load" because the AI call is being rejected (quota/rate limiting), and our code turns that into a vague "could not complete" message instead of telling you what actually happened.

## The real bug in our code

We stream the model response and only read the final text. When the gateway rejects the request, the streaming helper throws the generic `No output generated` error and the actual status (rate limited / out of credits) is thrown away. That's why the app shows a generic failure and a Retry button that immediately fails again.

## What to change

1. **Surface the real error.** Capture stream error parts and the underlying response status in the AI helper so a rejection reports "rate limited", "out of AI credits", or the real gateway message — instead of `No output generated`.
2. **Show it to the traveller.** The planner page error banner should show the specific reason, and for rate-limit/credit cases suggest waiting rather than offering an instant retry that will fail.
3. **Add one bounded retry with backoff** for transient rejections (a single retry after ~2–3s), so a momentary rate limit no longer kills the whole run.
4. **Stop duplicate calls.** Guard `generate`, `adapt`, and the demo trigger so an in-flight run can't be started again (and the `?demo=true` effect can't double-fire). This alone cuts wasted AI spend per attempt.
5. **Trim per-run cost.** The audit (Trip Check) pass currently runs automatically after every plan and every revision, doubling spend. Make it run once per plan and skip it when a plan call has already failed.

## Also worth knowing

Fixing the code makes the failure honest and cheaper, but if the daily AI allowance is exhausted, generations will still be blocked until it resets or more credits are added. After the fix the app will say so clearly.

## Technical notes

- `src/lib/ai-gateway.server.ts`: read the full stream (`fullStream`) to catch `error` parts, inspect the gateway HTTP response status/body in the custom `fetch`, map 429/402/401 precisely, and rethrow `AiUnavailableError` with the true reason; add a single backoff retry.
- `src/routes/plan.tsx`: in-flight guards for `generate`/`adapt`, hardened demo `useRef` guard, error banner text driven by the returned reason, hide Retry for quota errors.
- `src/lib/waypoint/orchestrator.server.ts` / `trip.functions.ts`: no schema changes; only the audit-trigger policy in `plan.tsx` changes.
- No database or auth changes.
