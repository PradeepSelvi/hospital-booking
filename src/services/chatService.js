// chatService.js
// Calls the NVIDIA NIM API directly from the browser using the VITE_NVIDIA_API_KEY env variable.
// ⚠️ NOTE: For production, move the API key to a backend proxy to avoid client-side exposure.

// In development, use Vite's proxy to avoid CORS (browser → localhost → NVIDIA).
// In production, this should point to your own backend proxy.
const NVIDIA_API_URL = import.meta.env.DEV
  ? '/api/nvidia/v1/chat/completions'
  : 'https://integrate.api.nvidia.com/v1/chat/completions'
const MODEL = 'nvidia/nemotron-3-ultra-550b-a55b'

// System prompt to give the assistant relevant context about the app
const SYSTEM_PROMPT = {
  role: 'system',
  content: `You are MediBook AI, a friendly and knowledgeable medical assistant embedded in the MediBook hospital management system. 
You help patients with:
- Understanding symptoms and when to seek medical care
- Explaining medical terms in simple language
- Guiding users on how to book appointments with the right specialist
- Providing general healthcare and wellness advice

Always recommend users consult a licensed doctor for diagnosis and treatment. Keep responses concise and easy to understand.
Do NOT provide specific diagnoses. If in doubt, always advise the user to visit a doctor.`
}

/**
 * Sends messages directly to the NVIDIA NIM API with streaming
 * @param {Array} messages - Array of { role: 'user' | 'assistant', content: string }
 * @param {Function} onChunk - Callback({ text: string, reasoning: string })
 * @param {AbortSignal} [signal] - Optional AbortController signal to cancel the request
 */
export async function streamChatCompletion(messages, onChunk, signal) {
  const apiKey = import.meta.env.VITE_NVIDIA_API_KEY

  if (!apiKey) {
    throw new Error('VITE_NVIDIA_API_KEY is not set in your .env file. Please restart the dev server after adding it.')
  }

  const response = await fetch(NVIDIA_API_URL, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [SYSTEM_PROMPT, ...messages],
      temperature: 0.7,
      top_p: 0.95,
      max_tokens: 4096,
      stream: true,
      // These fields must be top-level — `extra_body` is an OpenAI Python SDK concept,
      // not a raw API field. The SDK merges extra_body contents into the request body.
      // When using raw fetch, place them directly at the top level.
      chat_template_kwargs: { enable_thinking: true },
      reasoning_budget: 4096,
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    // Log safely — avoid leaking full error details in production
    if (import.meta.env.DEV) {
      console.error('NVIDIA API error:', response.status, errText)
    }
    throw new Error(`AI service error (${response.status}). Please try again later.`)
  }

  // Parse SSE streaming response with proper buffering for partial chunks
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let currentText = ''
  let currentReasoning = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      // Keep the last (potentially incomplete) line in the buffer
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data: ') || trimmed === 'data: [DONE]') continue

        try {
          const data = JSON.parse(trimmed.slice(6))
          const delta = data.choices?.[0]?.delta || {}

          if (delta.reasoning_content) {
            currentReasoning += delta.reasoning_content
            onChunk({ text: currentText, reasoning: currentReasoning })
          }
          if (delta.content) {
            currentText += delta.content
            onChunk({ text: currentText, reasoning: currentReasoning })
          }
        } catch {
          // Ignore genuinely malformed JSON lines
        }
      }
    }

    // Flush any remaining bytes from the decoder
    const remaining = decoder.decode()
    if (remaining) {
      buffer += remaining
      const trimmed = buffer.trim()
      if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
        try {
          const data = JSON.parse(trimmed.slice(6))
          const delta = data.choices?.[0]?.delta || {}
          if (delta.reasoning_content) {
            currentReasoning += delta.reasoning_content
            onChunk({ text: currentText, reasoning: currentReasoning })
          }
          if (delta.content) {
            currentText += delta.content
            onChunk({ text: currentText, reasoning: currentReasoning })
          }
        } catch {
          // Ignore
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}
