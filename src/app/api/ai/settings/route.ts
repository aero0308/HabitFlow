import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { encryptKey, decryptKey, maskKey } from "@/lib/ai/encryption";
import { AIProvider, NVIDIA_MODELS, testProviderConnection } from "@/lib/ai/providers";
import { apiOk, apiError } from "@/lib/api";

/**
 * POST /api/ai/settings
 * Body: { provider: AIProvider, apiKey: string, model?: string }
 * Encrypts the API key and saves the provider + chosen model + encrypted key
 * to the user's record.
 *
 * `model` is optional and currently only used for the NVIDIA provider
 * (where the user can pick between multiple chat-optimised models in the
 * Settings UI). For Groq, the server uses its built-in default.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const { provider, apiKey, model } = body as {
      provider: AIProvider;
      apiKey: string;
      model?: string;
    };

    if (!provider || !apiKey) {
      return apiError("Provider and API key are required", 400, "VALIDATION");
    }

    const validProviders = ["groq", "nvidia"];
    if (!validProviders.includes(provider)) {
      return apiError("Invalid provider", 400, "VALIDATION");
    }

    // Validate the model when one is supplied. For NVIDIA, must be in the
    // known free-tier list. For Groq, we ignore the field entirely.
    let modelToSave: string | null = null;
    if (provider === "nvidia") {
      if (model) {
        const known = NVIDIA_MODELS.find((m) => m.id === model);
        if (!known) {
          return apiError(
            `Unknown NVIDIA model: ${model}`,
            400,
            "VALIDATION",
          );
        }
        modelToSave = known.id;
      } else {
        modelToSave = NVIDIA_MODELS[0].id; // default to first
      }
    }

    const encrypted = encryptKey(apiKey);
    await db.user.update({
      where: { id: user.id },
      data: {
        aiProvider: provider,
        aiModel: modelToSave,
        aiApiKeyEncrypted: encrypted,
      },
    });

    return apiOk({ ok: true, maskedKey: maskKey(apiKey), model: modelToSave });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : "Failed to save AI settings");
  }
}

/**
 * DELETE /api/ai/settings
 * Clears the user's AI provider + chosen model + encrypted key.
 */
export async function DELETE() {
  try {
    const user = await requireUser();
    await db.user.update({
      where: { id: user.id },
      data: {
        aiProvider: null,
        aiModel: null,
        aiApiKeyEncrypted: null,
      },
    });
    return apiOk({ ok: true });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : "Failed to clear AI settings");
  }
}

/**
 * GET /api/ai/settings
 * Returns the current AI config (provider + chosen model + masked key,
 * never the raw key).
 */
export async function GET() {
  try {
    const user = await requireUser();
    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: { aiProvider: true, aiModel: true, aiApiKeyEncrypted: true },
    });

    if (!dbUser?.aiProvider || !dbUser?.aiApiKeyEncrypted) {
      return apiOk({ provider: null, model: null, maskedKey: null });
    }

    const plainKey = decryptKey(dbUser.aiApiKeyEncrypted);
    return apiOk({
      provider: dbUser.aiProvider,
      model: dbUser.aiModel,
      maskedKey: maskKey(plainKey),
    });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : "Failed to get AI settings");
  }
}
