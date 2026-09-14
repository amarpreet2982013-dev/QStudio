import type { AIProvider } from "../backend/src/contracts";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export class OpenAICompatibleProvider implements AIProvider {
  constructor(private readonly configuration = { baseUrl: process.env.SILQ_AI_BASE_URL, apiKey: process.env.SILQ_AI_API_KEY, model: process.env.SILQ_AI_MODEL }) {}
  async complete(request: { prompt: string; context?: string }): Promise<string> {
    const { baseUrl, apiKey, model } = this.configuration; if (!baseUrl || !apiKey || !model) throw new Error("AI is not configured.");
    let endpoint: URL;
    try { endpoint = new URL(baseUrl); } catch { throw new Error("AI provider URL is invalid."); }
    const local = endpoint.hostname === "localhost" || endpoint.hostname === "127.0.0.1" || endpoint.hostname === "::1";
    if ((endpoint.protocol !== "https:" && !(endpoint.protocol === "http:" && local)) || endpoint.username || endpoint.password) throw new Error("AI provider URL must use HTTPS or a local HTTP endpoint.");
    if (!local) {
      const addresses = await lookup(endpoint.hostname, { all: true });
      if (addresses.some(({ address }) => isPrivateAddress(address))) throw new Error("AI provider URL resolves to a private network address.");
    }
    endpoint.pathname = `${endpoint.pathname.replace(/\/$/, "")}/chat/completions`;
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model, messages: [{ role: "system", content: "You are Silq Studio's precise quantum-programming assistant." }, { role: "user", content: `${request.prompt}\n\nSource:\n${request.context ?? ""}` }], temperature: 0.2 }), signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`AI provider returned ${response.status}.`);
    const text = await response.text(); if (text.length > 5_000_000) throw new Error("AI provider response is too large.");
    const payload = JSON.parse(text) as { choices?: Array<{ message?: { content?: string } }> }; const content = payload.choices?.[0]?.message?.content; if (!content) throw new Error("AI provider returned no completion."); return content;
  }
}

function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const octets = address.split(".").map(Number);
    return octets[0] === 10 || octets[0] === 127 || octets[0] === 0 || (octets[0] === 169 && octets[1] === 254) || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) || (octets[0] === 192 && octets[1] === 168) || (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127);
  }
  const normalized = address.toLowerCase();
  return normalized === "::1" || normalized === "::" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:");
}
