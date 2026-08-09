import type { AIProvider } from "../backend/src/contracts";

export class OpenAICompatibleProvider implements AIProvider {
  constructor(private readonly configuration = { baseUrl: process.env.SILQ_AI_BASE_URL, apiKey: process.env.SILQ_AI_API_KEY, model: process.env.SILQ_AI_MODEL }) {}
  async complete(request: { prompt: string; context?: string }): Promise<string> {
    const { baseUrl, apiKey, model } = this.configuration; if (!baseUrl || !apiKey || !model) throw new Error("AI is not configured. Set SILQ_AI_BASE_URL, SILQ_AI_API_KEY, and SILQ_AI_MODEL in the desktop process environment.");
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model, messages: [{ role: "system", content: "You are Silq Studio's precise quantum-programming assistant." }, { role: "user", content: `${request.prompt}\n\nSource:\n${request.context ?? ""}` }], temperature: 0.2 }) });
    if (!response.ok) throw new Error(`AI provider returned ${response.status}.`); const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> }; const content = payload.choices?.[0]?.message?.content; if (!content) throw new Error("AI provider returned no completion."); return content;
  }
}
