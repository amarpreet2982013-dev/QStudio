"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAICompatibleProvider = exports.DEFAULT_AI_TIMEOUT_MS = exports.MAX_AI_RESPONSE_BYTES = void 0;
exports.validateAiEndpoint = validateAiEndpoint;
exports.MAX_AI_RESPONSE_BYTES = 1024 * 1024; // 1 MB
exports.DEFAULT_AI_TIMEOUT_MS = 30_000; // 30 seconds
/**
 * Validates the AI endpoint URL:
 * - Must use HTTPS unless targeting a local loopback interface (localhost / 127.0.0.1 / [::1])
 * - Rejects non-HTTP(S) protocols (file:, javascript:, data:)
 * - Rejects known cloud metadata endpoints (169.254.169.254, metadata.google.internal)
 */
function validateAiEndpoint(rawUrl) {
    if (!rawUrl || typeof rawUrl !== "string") {
        throw new Error("Invalid AI endpoint: URL must be a non-empty string.");
    }
    let parsed;
    try {
        parsed = new URL(rawUrl);
    }
    catch {
        throw new Error(`Invalid AI endpoint: malformed URL '${rawUrl}'.`);
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        throw new Error(`Invalid AI endpoint protocol: '${parsed.protocol}'. Only HTTPS and local HTTP are allowed.`);
    }
    const hostname = parsed.hostname.toLowerCase();
    const isLocal = hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "::1" ||
        hostname === "[::1]";
    // Reject cloud metadata addresses (SSRF prevention)
    if (hostname === "169.254.169.254" ||
        hostname.startsWith("169.254.") ||
        hostname === "metadata.google.internal" ||
        hostname === "metadata" ||
        hostname === "100.100.100.200") {
        throw new Error("Invalid AI endpoint: access to cloud instance metadata services is forbidden.");
    }
    if (parsed.protocol === "http:" && !isLocal) {
        throw new Error(`Insecure AI endpoint: plaintext HTTP is only permitted for local loopback (localhost/127.0.0.1). Use HTTPS for remote providers.`);
    }
    return {
        url: parsed,
        isLocal,
        sanitizedEndpoint: `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\/$/, "")}`,
    };
}
class OpenAICompatibleProvider {
    config;
    consentResolver;
    consentedEndpoints = new Set();
    constructor(configuration = {}) {
        this.config = {
            baseUrl: configuration.baseUrl ?? process.env.SILQ_AI_BASE_URL,
            apiKey: configuration.apiKey ?? process.env.SILQ_AI_API_KEY,
            model: configuration.model ?? process.env.SILQ_AI_MODEL,
            timeoutMs: configuration.timeoutMs ?? exports.DEFAULT_AI_TIMEOUT_MS,
        };
        this.consentResolver = configuration.consentResolver;
    }
    getEndpointInfo() {
        const rawUrl = this.config.baseUrl;
        if (!rawUrl) {
            throw new Error("AI is not configured. Set SILQ_AI_BASE_URL in the environment.");
        }
        return validateAiEndpoint(rawUrl);
    }
    isLocal() {
        return this.getEndpointInfo().isLocal;
    }
    grantConsent(endpoint) {
        this.consentedEndpoints.add(endpoint);
    }
    async complete(request) {
        const { baseUrl, apiKey, model, timeoutMs } = this.config;
        if (!baseUrl || !apiKey || !model) {
            throw new Error("AI is not configured. Set SILQ_AI_BASE_URL, SILQ_AI_API_KEY, and SILQ_AI_MODEL in the desktop process environment.");
        }
        const endpointInfo = validateAiEndpoint(baseUrl);
        const targetEndpoint = endpointInfo.sanitizedEndpoint;
        // Informed user consent check for remote providers
        if (!endpointInfo.isLocal && !this.consentedEndpoints.has(targetEndpoint)) {
            if (!this.consentResolver) {
                throw new Error(`User consent required: source code will be transmitted to external AI endpoint '${targetEndpoint}'. No consent resolver configured.`);
            }
            const consented = await this.consentResolver({
                endpoint: targetEndpoint,
                model,
                isLocal: false,
            });
            if (!consented) {
                throw new Error(`Transmission cancelled: user declined sending code to external AI provider at '${targetEndpoint}'.`);
            }
            this.consentedEndpoints.add(targetEndpoint);
        }
        const requestUrl = `${targetEndpoint}/chat/completions`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        let response;
        try {
            response = await fetch(requestUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model,
                    messages: [
                        { role: "system", content: "You are Silq Studio's precise quantum-programming assistant." },
                        { role: "user", content: `${request.prompt}\n\nSource:\n${request.context ?? ""}` },
                    ],
                    temperature: 0.2,
                }),
                signal: controller.signal,
            });
        }
        catch (err) {
            if (err instanceof Error && err.name === "AbortError") {
                throw new Error(`AI request timed out after ${timeoutMs}ms.`);
            }
            throw new Error(`AI network request failed: ${err instanceof Error ? err.message : "unknown connection error"}`);
        }
        finally {
            clearTimeout(timeoutId);
        }
        if (!response.ok) {
            // Do not log or echo authorization headers or sensitive keys
            throw new Error(`AI provider returned HTTP ${response.status} (${response.statusText || "Error"}).`);
        }
        // Check Content-Length if provided
        const contentLength = response.headers.get("content-length");
        if (contentLength && parseInt(contentLength, 10) > exports.MAX_AI_RESPONSE_BYTES) {
            throw new Error(`AI response exceeded maximum allowed size of ${exports.MAX_AI_RESPONSE_BYTES} bytes.`);
        }
        const rawText = await response.text();
        if (Buffer.byteLength(rawText, "utf8") > exports.MAX_AI_RESPONSE_BYTES) {
            throw new Error(`AI response payload exceeded maximum allowed size of ${exports.MAX_AI_RESPONSE_BYTES} bytes.`);
        }
        let payload;
        try {
            payload = JSON.parse(rawText);
        }
        catch {
            throw new Error("AI provider returned invalid JSON response.");
        }
        const content = payload.choices?.[0]?.message?.content;
        if (!content) {
            throw new Error("AI provider returned an empty completion.");
        }
        return content;
    }
}
exports.OpenAICompatibleProvider = OpenAICompatibleProvider;
