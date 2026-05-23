import type { LlmClient, LlmRequest, LlmResponse } from "../types";

/** The minimal slice of the Anthropic SDK that diff-story relies on. */
export interface AnthropicLike {
  messages: {
    create(body: {
      model: string;
      max_tokens: number;
      system: string;
      messages: { role: "user"; content: string }[];
    }): Promise<{
      content: { type: string; text?: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    }>;
  };
}

/** Adapt an Anthropic SDK instance to diff-story's provider-neutral LlmClient. */
export function createAnthropicClient(sdk: AnthropicLike): LlmClient {
  return {
    async complete(request: LlmRequest): Promise<LlmResponse> {
      const response = await sdk.messages.create({
        model: request.model,
        max_tokens: request.maxTokens,
        system: request.system,
        messages: [{ role: "user", content: request.user }],
      });

      const text = response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text ?? "")
        .join("");

      return {
        text,
        inputTokens: response.usage?.input_tokens ?? 0,
        outputTokens: response.usage?.output_tokens ?? 0,
      };
    },
  };
}
