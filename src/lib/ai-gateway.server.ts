import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText } from "ai";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";
export const WAYPOINT_MODEL = "openai/gpt-5.6-sol";

/**
 * Lovable AI Gateway provider. The custom fetch injects gateway-required
 * body fields (reasoning effort + JSON response format) that the
 * openai-compatible provider does not model directly.
 */
export function createGateway(apiKey: string) {
  return createOpenAICompatible({
    name: "lovable-gateway",
    baseURL: GATEWAY_URL,
    headers: { "Lovable-API-Key": apiKey },
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
      return fetch(input as string | URL | Request, init);
    },
  });
}

export class AiUnavailableError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = "AiUnavailableError";
    this.status = status;
  }
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

/**
 * Runs one agent step. Streams the gateway response (long reasoning calls must
 * stream) and parses the structured JSON payload.
 */
export async function runAgentStep<T>(args: {
  system: string;
  prompt: string;
  label: string;
}): Promise<T> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new AiUnavailableError("AI is not configured for this project.");

  const gateway = createGateway(apiKey);

  try {
    const result = streamText({
      model: gateway(WAYPOINT_MODEL),
      system: args.system,
      prompt: args.prompt,
      temperature: 0.7,
    });
    const text = await result.text;
    return extractJson(text) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = /429|rate limit/i.test(message)
      ? 429
      : /402|credit/i.test(message)
        ? 402
        : 500;
    console.error(`[waypoint:${args.label}] gateway failure`, message);
    throw new AiUnavailableError(
      status === 429
        ? "The AI agents are rate limited right now. Please retry in a moment."
        : status === 402
          ? "AI credits are exhausted for this workspace. Add credits to keep planning."
          : `The ${args.label} agent could not complete. Please retry.`,
      status,
    );
  }
}
