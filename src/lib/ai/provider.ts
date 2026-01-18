import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'

export type AIProvider = 'anthropic' | 'openai' | 'google'

export interface AIConfig {
  provider: AIProvider
  apiKey?: string
  usePlatformKey: boolean
}

export interface AIMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AICompletionOptions {
  system?: string
  messages: AIMessage[]
  maxTokens?: number
  // For image/document content
  imageContent?: {
    type: 'image' | 'document'
    base64: string
    mediaType: string
  }
}

export interface AICompletionResult {
  text: string
  usage?: {
    inputTokens: number
    outputTokens: number
  }
}

// Get AI client based on user config
export function getAIConfig(profile: {
  ai_provider?: string
  anthropic_api_key?: string
  openai_api_key?: string
  google_api_key?: string
  use_own_api_key?: boolean
} | null): AIConfig {
  if (!profile || !profile.use_own_api_key) {
    // Use platform key (Anthropic by default)
    return {
      provider: 'anthropic',
      usePlatformKey: true,
    }
  }

  const provider = (profile.ai_provider || 'anthropic') as AIProvider
  let apiKey: string | undefined

  switch (provider) {
    case 'anthropic':
      apiKey = profile.anthropic_api_key || undefined
      break
    case 'openai':
      apiKey = profile.openai_api_key || undefined
      break
    case 'google':
      apiKey = profile.google_api_key || undefined
      break
  }

  // If no key provided for selected provider, fall back to platform
  if (!apiKey) {
    return {
      provider: 'anthropic',
      usePlatformKey: true,
    }
  }

  return {
    provider,
    apiKey,
    usePlatformKey: false,
  }
}

// Create completion using the appropriate provider
export async function createCompletion(
  config: AIConfig,
  options: AICompletionOptions
): Promise<AICompletionResult> {
  const { provider, apiKey, usePlatformKey } = config
  const { system, messages, maxTokens = 4000, imageContent } = options

  if (provider === 'anthropic' || usePlatformKey) {
    return createAnthropicCompletion(
      usePlatformKey ? undefined : apiKey,
      system,
      messages,
      maxTokens,
      imageContent
    )
  }

  if (provider === 'openai') {
    return createOpenAICompletion(apiKey!, system, messages, maxTokens, imageContent)
  }

  if (provider === 'google') {
    return createGoogleCompletion(apiKey!, system, messages, maxTokens, imageContent)
  }

  throw new Error(`Unsupported AI provider: ${provider}`)
}

// Anthropic (Claude) implementation
async function createAnthropicCompletion(
  apiKey: string | undefined,
  system: string | undefined,
  messages: AIMessage[],
  maxTokens: number,
  imageContent?: AICompletionOptions['imageContent']
): Promise<AICompletionResult> {
  const anthropic = apiKey
    ? new Anthropic({ apiKey })
    : new Anthropic() // Uses ANTHROPIC_API_KEY env var

  // Build message content
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let content: any = messages[messages.length - 1]?.content || ''

  if (imageContent) {
    if (imageContent.type === 'document') {
      content = [
        {
          type: 'document',
          source: {
            type: 'base64',
            media_type: imageContent.mediaType,
            data: imageContent.base64,
          },
        },
        {
          type: 'text',
          text: messages[messages.length - 1]?.content || 'Analyze this document.',
        },
      ]
    } else {
      content = [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: imageContent.mediaType,
            data: imageContent.base64,
          },
        },
        {
          type: 'text',
          text: messages[messages.length - 1]?.content || 'Analyze this image.',
        },
      ]
    }
  }

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: maxTokens,
    system: system,
    messages: [
      ...messages.slice(0, -1).map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  return {
    text,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  }
}

// OpenAI (GPT) implementation
async function createOpenAICompletion(
  apiKey: string,
  system: string | undefined,
  messages: AIMessage[],
  maxTokens: number,
  imageContent?: AICompletionOptions['imageContent']
): Promise<AICompletionResult> {
  const openai = new OpenAI({ apiKey })

  // Build messages array
  const openaiMessages: OpenAI.ChatCompletionMessageParam[] = []

  if (system) {
    openaiMessages.push({ role: 'system', content: system })
  }

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]

    if (i === messages.length - 1 && imageContent) {
      // Last message with image
      if (imageContent.type === 'document') {
        // OpenAI doesn't support PDF directly, convert to text description
        openaiMessages.push({
          role: 'user',
          content: `[Document uploaded - please analyze based on the context provided]\n\n${msg.content}`,
        })
      } else {
        // Image support
        openaiMessages.push({
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${imageContent.mediaType};base64,${imageContent.base64}`,
              },
            },
            { type: 'text', text: msg.content },
          ],
        })
      }
    } else {
      openaiMessages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      })
    }
  }

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: maxTokens,
    messages: openaiMessages,
  })

  const text = response.choices[0]?.message?.content || ''

  return {
    text,
    usage: {
      inputTokens: response.usage?.prompt_tokens || 0,
      outputTokens: response.usage?.completion_tokens || 0,
    },
  }
}

// Google (Gemini) implementation
async function createGoogleCompletion(
  apiKey: string,
  system: string | undefined,
  messages: AIMessage[],
  maxTokens: number,
  imageContent?: AICompletionOptions['imageContent']
): Promise<AICompletionResult> {
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' })

  // Build content parts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parts: any[] = []

  // Add system instruction as first user message if provided
  let fullPrompt = ''
  if (system) {
    fullPrompt = `Instructions: ${system}\n\n`
  }

  // Add conversation history
  for (const msg of messages) {
    fullPrompt += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n\n`
  }

  if (imageContent) {
    parts.push({
      inlineData: {
        mimeType: imageContent.mediaType,
        data: imageContent.base64,
      },
    })
  }

  parts.push({ text: fullPrompt })

  const result = await model.generateContent({
    contents: [{ role: 'user', parts }],
    generationConfig: {
      maxOutputTokens: maxTokens,
    },
  })

  const response = result.response
  const text = response.text()

  return {
    text,
    usage: {
      inputTokens: response.usageMetadata?.promptTokenCount || 0,
      outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
    },
  }
}

// Helper to mask API key for display
export function maskApiKey(key: string | null | undefined): string {
  if (!key) return ''
  if (key.length <= 8) return '****'
  return key.substring(0, 4) + '****' + key.substring(key.length - 4)
}

// Validate API key format (basic check)
export function validateApiKeyFormat(provider: AIProvider, key: string): boolean {
  if (!key || key.trim().length === 0) return false

  switch (provider) {
    case 'anthropic':
      return key.startsWith('sk-ant-')
    case 'openai':
      return key.startsWith('sk-')
    case 'google':
      return key.length > 20 // Google API keys are typically 39 chars
    default:
      return false
  }
}
