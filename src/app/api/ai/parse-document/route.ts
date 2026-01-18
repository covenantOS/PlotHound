import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAIConfig, createCompletion, type AIConfig } from '@/lib/ai/provider'

interface ParsedAncestor {
  givenNames: string
  surname: string
  birthYear: string
  birthPlace: string
  deathYear: string
  deathPlace: string
  relationship: string
  generation?: number
  notes: string
}

// Delay helper
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Retry with exponential backoff - longer delays for rate limits
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 4,
  baseDelayMs: number = 15000 // Start with 15 seconds for rate limits
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      const isRateLimit = lastError.message.includes('rate_limit') ||
        lastError.message.includes('429') ||
        lastError.message.includes('overloaded')

      console.log(`API call failed (attempt ${attempt + 1}/${maxRetries}):`, lastError.message)

      if (!isRateLimit || attempt === maxRetries - 1) {
        throw lastError
      }

      // Longer waits: 15s, 30s, 60s, 120s
      const waitTime = baseDelayMs * Math.pow(2, attempt)
      console.log(`Rate limited, waiting ${waitTime / 1000}s before retry ${attempt + 2}...`)
      await delay(waitTime)
    }
  }

  throw lastError
}

// Process text in chunks
async function processTextInChunks(
  textContent: string,
  systemPrompt: string,
  aiConfig: AIConfig
): Promise<{ ancestors: ParsedAncestor[], treeName: string, additionalContext: string }> {
  // Split text into chunks of roughly 4000 characters each
  const CHUNK_SIZE = 4000
  const chunks: string[] = []

  // Try to split at paragraph boundaries
  const paragraphs = textContent.split(/\n\n+/)
  let currentChunk = ''

  for (const para of paragraphs) {
    if (currentChunk.length + para.length > CHUNK_SIZE && currentChunk.length > 0) {
      chunks.push(currentChunk.trim())
      currentChunk = para
    } else {
      currentChunk += '\n\n' + para
    }
  }
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim())
  }

  // If no meaningful content, return empty
  if (chunks.length === 0 || (chunks.length === 1 && chunks[0].length < 50)) {
    console.log('No meaningful text content to process')
    return { ancestors: [], treeName: 'Imported Family Tree', additionalContext: '' }
  }

  console.log(`Processing ${chunks.length} text chunk(s), total length: ${textContent.length}`)

  // If only one chunk, process normally
  if (chunks.length <= 1) {
    const response = await retryWithBackoff(() =>
      createCompletion(aiConfig, {
        system: systemPrompt,
        maxTokens: 8000,
        messages: [
          {
            role: 'user',
            content: `Extract ALL genealogical information from this document:\n\n${textContent}`,
          },
        ],
      })
    )

    const responseText = response.text
    console.log('AI response length:', responseText.length)

    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0])
        return {
          ancestors: parsed.ancestors || [],
          treeName: parsed.treeName || 'Imported Family Tree',
          additionalContext: parsed.additionalContext || '',
        }
      } catch (e) {
        console.error('JSON parse error:', e)
      }
    }
    return { ancestors: [], treeName: 'Imported Family Tree', additionalContext: '' }
  }

  // Multiple chunks - process each with a delay
  const allAncestors: ParsedAncestor[] = []
  let treeName = 'Imported Family Tree'
  const contextParts: string[] = []

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    console.log(`Processing chunk ${i + 1}/${chunks.length} (${chunk.length} chars)`)

    // Add delay between API calls to avoid rate limits
    if (i > 0) {
      await delay(2000) // 2 second delay between calls
    }

    const chunkPrompt = i === 0
      ? `Extract ALL genealogical information from this document (Part ${i + 1} of ${chunks.length}):\n\n${chunk}`
      : `Continue extracting genealogical information from this document (Part ${i + 1} of ${chunks.length}). Extract any NEW people not already mentioned:\n\n${chunk}`

    try {
      const response = await retryWithBackoff(() =>
        createCompletion(aiConfig, {
          system: systemPrompt,
          maxTokens: 4000,
          messages: [
            {
              role: 'user',
              content: chunkPrompt,
            },
          ],
        })
      )

      const responseText = response.text
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])

        if (parsed.ancestors && Array.isArray(parsed.ancestors)) {
          // Deduplicate by name
          for (const ancestor of parsed.ancestors) {
            const existingIdx = allAncestors.findIndex(a =>
              a.givenNames?.toLowerCase() === ancestor.givenNames?.toLowerCase() &&
              a.surname?.toLowerCase() === ancestor.surname?.toLowerCase()
            )

            if (existingIdx === -1) {
              allAncestors.push({
                givenNames: ancestor.givenNames || '',
                surname: ancestor.surname || '',
                birthYear: ancestor.birthYear || '',
                birthPlace: ancestor.birthPlace || '',
                deathYear: ancestor.deathYear || '',
                deathPlace: ancestor.deathPlace || '',
                relationship: ancestor.relationship || '',
                generation: ancestor.generation,
                notes: ancestor.notes || '',
              })
            } else if (ancestor.notes && ancestor.notes.length > (allAncestors[existingIdx].notes?.length || 0)) {
              // Merge notes if new one has more info
              allAncestors[existingIdx].notes = ancestor.notes
            }
          }
          console.log(`Chunk ${i + 1}: found ${parsed.ancestors.length} ancestors, total now: ${allAncestors.length}`)
        }

        if (i === 0 && parsed.treeName) {
          treeName = parsed.treeName
        }

        if (parsed.additionalContext) {
          contextParts.push(parsed.additionalContext)
        }
      }
    } catch (error) {
      console.error(`Error processing chunk ${i + 1}:`, error)
      // Continue with other chunks
    }
  }

  return {
    ancestors: allAncestors,
    treeName,
    additionalContext: contextParts.join('\n\n'),
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check subscription and get AI settings
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier, ai_provider, anthropic_api_key, openai_api_key, google_api_key, use_own_api_key')
      .eq('id', user.id)
      .single()

    const tier = (profile as { subscription_tier: string } | null)?.subscription_tier || 'free'

    // Get AI configuration based on user's settings
    const aiConfig = getAIConfig(profile as {
      ai_provider?: string
      anthropic_api_key?: string
      openai_api_key?: string
      google_api_key?: string
      use_own_api_key?: boolean
    } | null)

    console.log(`Using AI provider: ${aiConfig.provider}, platform key: ${aiConfig.usePlatformKey}`)
    if (!['researcher', 'investigator', 'professional'].includes(tier)) {
      return NextResponse.json({ error: 'Upgrade required' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    console.log(`Processing file: ${file.name}, type: ${file.type}, size: ${file.size}`)

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })
    }

    const fileType = file.type
    const fileName = file.name.toLowerCase()

    // Build the system prompt
    const systemPrompt = `You are a thorough genealogy research assistant. Extract EVERY person mentioned in the document.

Return a JSON object with this structure:
{
  "treeName": "suggested tree name",
  "ancestors": [
    {
      "givenNames": "first and middle names",
      "surname": "last name",
      "birthYear": "YYYY or empty",
      "birthPlace": "location or empty",
      "deathYear": "YYYY or empty",
      "deathPlace": "location or empty",
      "relationship": "Self, Parent, Grandparent, etc.",
      "generation": 0,
      "notes": "detailed notes about this person"
    }
  ],
  "additionalContext": "family context not tied to specific person"
}

IMPORTANT:
- Extract EVERY person, even if there are many
- Include detailed notes for each person
- Return ONLY valid JSON, no markdown`

    // Determine how to process the file
    let textContent = ''
    let imageBase64: string | null = null
    let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | 'application/pdf' | null = null

    if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
      console.log('Processing as PDF')
      const buffer = await file.arrayBuffer()
      imageBase64 = Buffer.from(buffer).toString('base64')
      mediaType = 'application/pdf'
    } else if (fileType.startsWith('image/')) {
      console.log('Processing as image')
      const buffer = await file.arrayBuffer()
      imageBase64 = Buffer.from(buffer).toString('base64')
      if (fileType === 'image/jpeg' || fileType === 'image/jpg') {
        mediaType = 'image/jpeg'
      } else if (fileType === 'image/png') {
        mediaType = 'image/png'
      } else if (fileType === 'image/gif') {
        mediaType = 'image/gif'
      } else if (fileType === 'image/webp') {
        mediaType = 'image/webp'
      }
    } else if (
      fileType === 'text/plain' ||
      fileType === 'text/csv' ||
      fileName.endsWith('.txt') ||
      fileName.endsWith('.csv')
    ) {
      console.log('Processing as text file')
      textContent = await file.text()
    } else if (
      fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      fileType === 'application/msword' ||
      fileName.endsWith('.docx') ||
      fileName.endsWith('.doc')
    ) {
      // For Word docs, try to read as text first (works for some formats)
      // If that fails or is binary, we'll try to extract what we can
      console.log('Processing as Word document')
      try {
        const rawText = await file.text()
        // Check if it looks like actual text content (not binary)
        const printableRatio = rawText.split('').filter(c => c.charCodeAt(0) >= 32 && c.charCodeAt(0) < 127).length / rawText.length
        if (printableRatio > 0.7) {
          // Mostly printable, use as text
          textContent = rawText
          console.log('Word doc readable as text')
        } else {
          // Binary format - note this to the user
          return NextResponse.json({
            error: 'Word documents in .docx format cannot be directly read. Please save as .txt or copy/paste the content into a text file.'
          }, { status: 400 })
        }
      } catch {
        return NextResponse.json({
          error: 'Could not read Word document. Please save as .txt or PDF and try again.'
        }, { status: 400 })
      }
    } else {
      // Try to read as text
      console.log('Processing as generic text')
      try {
        textContent = await file.text()
      } catch {
        return NextResponse.json({
          error: 'Unsupported file type. Please upload a PDF, image, or text file.'
        }, { status: 400 })
      }
    }

    let result: { ancestors: ParsedAncestor[], treeName: string, additionalContext: string }

    if (imageBase64 && mediaType) {
      console.log(`Sending ${mediaType} to AI (base64 length: ${imageBase64.length})`)

      const textPrompt = mediaType === 'application/pdf'
        ? 'Extract ALL genealogical information from this entire document. Include EVERY person mentioned with detailed notes. Return JSON as specified.'
        : 'Extract ALL genealogical information from this image. Include EVERY person with detailed notes. Return JSON as specified.'

      const response = await retryWithBackoff(() =>
        createCompletion(aiConfig, {
          system: systemPrompt,
          maxTokens: 8000,
          messages: [{ role: 'user', content: textPrompt }],
          imageContent: {
            type: mediaType === 'application/pdf' ? 'document' : 'image',
            base64: imageBase64,
            mediaType: mediaType,
          },
        })
      )

      const responseText = response.text
      console.log('AI response received, length:', responseText.length)

      const jsonMatch = responseText.match(/\{[\s\S]*\}/)

      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0])
          result = {
            ancestors: parsed.ancestors || [],
            treeName: parsed.treeName || 'Imported Family Tree',
            additionalContext: parsed.additionalContext || '',
          }
          console.log(`Parsed ${result.ancestors.length} ancestors from document`)
        } catch (parseError) {
          console.error('JSON parse error:', parseError)
          console.log('Raw response:', responseText.substring(0, 500))
          throw new Error('Failed to parse AI response as JSON')
        }
      } else {
        console.log('No JSON found in response:', responseText.substring(0, 500))
        throw new Error('AI response did not contain valid JSON')
      }
    } else if (textContent && textContent.length > 0) {
      console.log(`Processing text content (${textContent.length} chars)`)
      // For text files, use chunked processing
      result = await processTextInChunks(textContent, systemPrompt, aiConfig)
    } else {
      return NextResponse.json({
        error: 'No content could be extracted from the file.'
      }, { status: 400 })
    }

    console.log(`Returning ${result.ancestors.length} ancestors`)

    return NextResponse.json({
      treeName: result.treeName,
      ancestors: result.ancestors,
      additionalContext: result.additionalContext,
    })
  } catch (error) {
    console.error('Document parse error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to process document'

    if (errorMessage.includes('rate_limit') || errorMessage.includes('429') || errorMessage.includes('overloaded')) {
      return NextResponse.json({
        error: 'API is busy. Please wait 1-2 minutes and try again. Large PDFs may need a longer wait.'
      }, { status: 429 })
    }

    // Return more specific error message
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
