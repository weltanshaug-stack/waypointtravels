import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText } from "ai";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";
export const WAYPOINT_MODEL = "openai/gpt-5.6-sol";

export class AiUnavailableError extends Error {
  status: number;
  /** Present so the app's error middleware forwards this instead of
   *  replacing it with a generic 500 HTML page (which blanks the screen). */
  statusCode: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = "AiUnavailableError";
    this.status = status;
    this.statusCode = status;
  }
}


/** Captures the true gateway failure so stream errors don't hide it. */
type GatewayFailure = { status: number; body: string } | null;

/**
 * Lovable AI Gateway provider. The custom fetch injects gateway-required
 * body fields (reasoning effort + JSON response format) that the
 * openai-compatible provider does not model directly, and records the real
 * HTTP status of a rejected call.
 */
export function createGateway(apiKey: string, onFailure?: (failure: GatewayFailure) => void) {
  return createOpenAICompatible({
    name: "lovable",
    baseURL: GATEWAY_URL,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: async (input, init) => {
      if (init?.body && typeof init.body === "string") {
        try {
          const body = JSON.parse(init.body) as Record<string, unknown>;
          body["reasoning_effort"] = "none";
          body["response_format"] = { type: "json_object" };
          init = { ...init, body: JSON.stringify(body) };
        } catch {
          /* leave body untouched when it is not JSON */
        }
      }
      const response = await fetch(input as string | URL | Request, init);
      if (!response.ok && onFailure) {
        // Clone so the SDK can still read the body if it wants to.
        let body = "";
        try {
          body = await response.clone().text();
        } catch {
          /* ignore unreadable bodies */
        }
        onFailure({ status: response.status, body: body.slice(0, 500) });
      }
      return response;
    },
  });
}

function extractJson(raw: string): unknown {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new AiUnavailableError("The planning agent returned an unreadable response.");
  }
}

function describe(status: number, label: string, detail: string): string {
  if (status === 429) {
    return "Waypoint's AI is rate limited right now. Wait about a minute and try again.";
  }
  if (status === 402) {
    return "This workspace has run out of AI credits, so new trips can't be generated until credits are added.";
  }
  if (status === 401 || status === 403) {
    return "Waypoint's AI access was rejected. The AI key needs to be reconnected.";
  }
  const trimmed = detail.trim();
  return trimmed
    ? `The ${label} agent could not complete: ${trimmed}`
    : `The ${label} agent could not complete. Please retry.`;
}

/** Extracts a human-usable reason out of a gateway body/message. */
function detailFrom(failure: GatewayFailure, fallback: string): string {
  if (!failure) return fallback;
  try {
    const parsed = JSON.parse(failure.body) as { error?: { message?: string }; message?: string };
    return parsed.error?.message ?? parsed.message ?? failure.body;
  } catch {
    return failure.body || fallback;
  }
}

async function attempt<T>(args: { system: string; prompt: string; label: string }): Promise<T> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new AiUnavailableError("AI is not configured for this project.");

  let failure: GatewayFailure = null;
  const gateway = createGateway(apiKey, (f) => {
    failure = f;
  });

  try {
    const result = streamText({
      model: gateway(WAYPOINT_MODEL),
      system: args.system,
      prompt: args.prompt,
      temperature: 0.7,
      maxRetries: 0,
    });

    // Read the full stream so provider error parts surface instead of being
    // collapsed into the SDK's generic "No output generated" message.
    let text = "";
    let streamError: unknown = null;
    for await (const part of result.fullStream) {
      if (part.type === "text-delta") {
        text += (part as { text?: string; textDelta?: string }).text
          ?? (part as { textDelta?: string }).textDelta
          ?? "";
      } else if (part.type === "error") {
        streamError = (part as { error?: unknown }).error;
      }
    }

    if (!text.trim()) {
      const current = failure as GatewayFailure;
      const message =
        streamError instanceof Error
          ? streamError.message
          : streamError
            ? String(streamError)
            : "";
      throw new AiUnavailableError(
        describe(current?.status ?? 500, args.label, detailFrom(current, message)),
        current?.status ?? 500,
      );
    }

    return extractJson(text) as T;
  } catch (error) {
    if (error instanceof AiUnavailableError) {
      console.error(`[waypoint:${args.label}] ${error.status} ${error.message}`);
      throw error;
    }
    const current = failure as GatewayFailure;
    const raw = error instanceof Error ? error.message : String(error);
    const status = current?.status ?? (/429|rate limit/i.test(raw) ? 429 : /402|credit/i.test(raw) ? 402 : 500);
    console.error(`[waypoint:${args.label}] gateway failure ${status} ${detailFrom(current, raw)}`);
    throw new AiUnavailableError(describe(status, args.label, detailFrom(current, raw)), status);
  }
}

/**
 * Runs one agent step. Streams the gateway response (long reasoning calls must
 * stream) and parses the structured JSON payload. Transient rejections (429 /
 * 5xx) get one backoff retry; every other status is terminal.
 */
export async function runAgentStep<T>(args: {
  system: string;
  prompt: string;
  label: string;
}): Promise<T> {
  try {
    return await attempt<T>(args);
  } catch (error) {
    const retryable =
      error instanceof AiUnavailableError && (error.status === 429 || error.status >= 500);
    if (!retryable) throw error;
    await new Promise((resolve) => setTimeout(resolve, 2500));
    return attempt<T>(args);
  }
}
