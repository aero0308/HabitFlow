/**
 * Unified AI provider abstraction.
 *
 * Supported providers (BYOK — Bring Your Own Key):
 *   - groq    — OpenAI-compatible. Fastest inference, 131K context, JSON mode.
 *   - nvidia  — NVIDIA NIM. OpenAI-compatible. Large model catalog,
 *               up to 40 RPM, no per-token billing. NVIDIA exposes multiple
 *               chat-optimised models per key, so we surface them in a
 *               sub-picker (`NVIDIA_MODELS`) and persist the chosen model
 *               alongside the provider in `User.aiModel`.
 *
 * All providers are called server-side only — API keys are never
 * exposed to the browser after the initial save (which encrypts them).
 *
 * Every outbound request is wrapped in an AbortController-based timeout
 * so a hung provider connection never keeps a Next.js request alive past
 * its useful lifetime. The default timeout is 30s for narrative calls
 * (we raise it for streaming via streamChat.ts).
 */

const DEFAULT_TIMEOUT_MS = 30_000;

export type AIProvider = "groq" | "nvidia";

export interface GenerateArgs {
  apiKey: string;
  provider: AIProvider;
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  /** When true, request JSON-only output (response_format: json_object). */
  jsonMode?: boolean;
  /** Override the per-request timeout (ms). Defaults to 30s. */
  timeoutMs?: number;
  /**
   * Override the model id (e.g. "nvidia/nemotron-3-super-120b-a12b").
   * If omitted, falls back to the provider's default in `MODELS`.
   */
  model?: string;
}

export interface GenerateResult {
  text: string;
  model: string;
}

export class AIProviderError extends Error {
  constructor(
    public provider: AIProvider,
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "AIProviderError";
  }
}

/**
 * Default model per provider. Used when the caller doesn't pass `model`.
 * For NVIDIA, the user can pick from `NVIDIA_MODELS` in the Settings UI;
 * their choice is persisted as `User.aiModel` and passed through here.
 */
const MODELS: Record<AIProvider, string> = {
  groq: "openai/gpt-oss-120b",
  nvidia: "nvidia/nemotron-3-super-120b-a12b",
};

/**
 * Endpoints for OpenAI-compatible providers. NVIDIA NIM uses
 * https://integrate.api.nvidia.com/v1/chat/completions.
 */
const ENDPOINTS: Record<AIProvider, string> = {
  groq: "https://api.groq.com/openai/v1/chat/completions",
  nvidia: "https://integrate.api.nvidia.com/v1/chat/completions",
};

/**
 * Models exposed in the NVIDIA NIM provider picker (Settings → AI Coach).
 * `tier: "free"` models are fully free on the NVIDIA developer plan — they
 * are the ones we recommend by default. Future paid options can be appended
 * here without touching the rest of the codebase.
 */
export const NVIDIA_MODELS: Array<{
  id: string;
  label: string;
  tier: "free" | "paid";
  description?: string;
}> = [
  {
    id: "nvidia/nemotron-3-super-120b-a12b",
    label: "Nemotron 3 Super (FREE)",
    tier: "free",
    description: "120B params · best quality · 40 RPM cap",
  },
  {
    id: "nvidia/nemotron-3.5-lightning-30b-a3b",
    label: "Nemotron 3.5 Lightning (FREE — Fastest)",
    tier: "free",
    description: "30B MoE · lowest latency · great for chat",
  },
];

export async function generateNarrative(
  args: GenerateArgs,
): Promise<GenerateResult> {
  const model = args.model ?? MODELS[args.provider];
  const maxTokens = args.maxTokens ?? 600;
  const timeoutMs = args.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  switch (args.provider) {
    case "groq":
    case "nvidia":
      return callOpenAICompatible(args.apiKey, args.provider, model, args.systemPrompt, args.userPrompt, maxTokens, args.jsonMode, timeoutMs);
    default:
      throw new AIProviderError(args.provider, 400, `Unknown provider: ${args.provider}`);
  }
}

/* ============================================================================
   Shared OpenAI-compatible caller.
   ----------------------------------------------------------------------------
   Both Groq and NVIDIA NIM implement OpenAI's /v1/chat/completions spec:
     POST <endpoint>
       Authorization: Bearer <apiKey>
       Body: { model, max_tokens, messages, response_format? }

   NVIDIA NIM auth: a bearer token starting with "nvapi-...".
============================================================================ */

async function callOpenAICompatible(
  apiKey: string,
  provider: AIProvider,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  jsonMode?: boolean,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<GenerateResult> {
  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  };
  // Only Groq reliably supports OpenAI's response_format: json_object.
  // NVIDIA NIM's structured-output validator is much stricter than OpenAI's
  // and rejects the model's output (HTTP 422 "Failed to validate JSON")
  // whenever the JSON doesn't perfectly conform — which our complex schemas
  // frequently trigger. For NVIDIA we instead embed strong "respond ONLY
  // with JSON" instructions in the prompt and rely on the existing
  // `looseJsonParse` recovery logic to extract JSON from prose / fences.
  if (jsonMode && provider === "groq") {
    body.response_format = { type: "json_object" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(ENDPOINTS[provider], {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...(provider === "nvidia"
          ? { Accept: "application/json" }
          : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    if (e instanceof Error && e.name === "AbortError") {
      throw new AIProviderError(
        provider,
        408,
        `Request timed out after ${Math.round(timeoutMs / 1000)}s. The provider is taking too long to respond — please try again.`,
      );
    }
    // Network / DNS / TLS errors land here
    throw new AIProviderError(
      provider,
      502,
      `Network error contacting ${provider}: ${e instanceof Error ? e.message : "unknown"}`,
    );
  }
  clearTimeout(timer);

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    let message = `${provider} request failed (${res.status})`;
    try {
      const json = JSON.parse(errBody) as {
        error?: { message?: string } | string;
        message?: string;
      };
      const nested = json.error;
      const nestedMsg =
        typeof nested === "string" ? nested : nested?.message;
      message = nestedMsg ?? json.message ?? message;
    } catch {
      if (errBody) message = errBody.slice(0, 200);
    }
    // Friendlier 401 / 403 / 404 / 410 / 422 / 429 messages
    if (res.status === 401 || res.status === 403) {
      // NVIDIA NIM uses 403 (Forbidden) for invalid keys in addition to 401.
      message = `Your ${provider} API key is invalid or unauthorized (status ${res.status}). Please re-enter it in Settings.`;
    } else if (res.status === 404) {
      message = provider === "nvidia"
        ? `Model "${model}" was not found on NVIDIA NIM (404). Pick a different model in Settings.`
        : `${provider} model "${model}" was not found (404).`;
    } else if (res.status === 410) {
      // NVIDIA NIM returns 410 (Gone) for invalid keys AND for deprecated
      // models — the body usually has more detail, but make the message
      // actionable either way.
      message = provider === "nvidia"
        ? `NVIDIA NIM rejected this request (410). Your key may be invalid, or the model "${model}" is no longer available. Verify your key at https://build.nvidia.com/keys and pick a different model in Settings.`
        : `${provider} endpoint is unavailable (410). Please try again.`;
    } else if (res.status === 422) {
      // NVIDIA NIM's structured-output validator failed to parse the model's
      // output. We already disable response_format for nvidia above, so
      // this shouldn't normally happen — but if it does, give a clear hint.
      message = provider === "nvidia"
        ? `NVIDIA NIM could not parse the model output as valid JSON (422). Please try again — the model may have produced malformed output.`
        : `${provider} rejected the response (422): ${message}`;
    } else if (res.status === 429) {
      message = `${provider} rate limit reached. Please wait a moment and try again.`;
    }
    throw new AIProviderError(provider, res.status, message);
  }

  const json = await res.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = json.choices?.[0]?.message?.content ?? "";
  return { text, model };
}

/**
 * Sends a tiny test prompt ("Respond with 'pong'") to verify the key works.
 * Used by the Settings "Test connection" button.
 *
 * Note: We give this 30s instead of the default 15s because some NVIDIA NIM
 * models (notably Nemotron 3.5 Lightning) have a noticeable cold-start delay
 * on the first request after a key is saved. 30s gives the model enough time
 * to wake up without the user seeing a "Request timed out after 15s" error.
 */
export async function testProviderConnection(
  apiKey: string,
  provider: AIProvider,
  model?: string,
): Promise<GenerateResult> {
  return generateNarrative({
    apiKey,
    provider,
    model,
    systemPrompt: "Respond with exactly: pong",
    userPrompt: "Respond with exactly: pong",
    maxTokens: 10,
    timeoutMs: 30_000,
  });
}
