import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

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

// Retry with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 3000
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      const isRateLimit = lastError.message.includes('rate_limit') ||
        lastError.message.includes('429')

      if (!isRateLimit || attempt === maxRetries - 1) {
        throw lastError
      }

      const waitTime = baseDelayMs * Math.pow(2, attempt)
      console.log(`Rate limited, waiting ${waitTime}ms before retry ${attempt + 1}...`)
      await delay(waitTime)
    }
  }

  throw lastError
}

// Process text in chunks
async function processTextInChunks(
  textContent: string,
  systemPrompt: string
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

  // If only one chunk, process normally
  if (chunks.length <= 1) {
    const response = await retryWithBackoff(() =>
      anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Extract ALL genealogical information from this document:\n\n${textContent}`,
          },
        ],
      })
    )

    const responseText = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        ancestors: parsed.ancestors || [],
        treeName: parsed.treeName || 'Imported Family Tree',
        additionalContext: parsed.additionalContext || '',
      }
    }
    return { ancestors: [], treeName: 'Imported Family Tree', additionalContext: '' }
  }

  // Multiple chunks - process each with a delay
  const allAncestors: ParsedAncestor[] = []
  let treeName = 'Imported Family Tree'
  const contextParts: string[] = []

  console.log(`Processing ${chunks.length} chunks...`)

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]

    // Add delay between API calls to avoid rate limits
    if (i > 0) {
      await delay(2000) // 2 second delay between calls
    }

    const chunkPrompt = i === 0
      ? `Extract ALL genealogical information from this document (Part ${i + 1} of ${chunks.length}):\n\n${chunk}`
      : `Continue extracting genealogical information from this document (Part ${i + 1} of ${chunks.length}). Extract any NEW people not already mentioned:\n\n${chunk}`

    try {
      const response = await retryWithBackoff(() =>
        anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: chunkPrompt,
            },
          ],
        })
      )

      const responseText = response.content[0].type === 'text' ? response.content[0].text : ''
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])

        if (parsed.ancestors && Array.isArray(parsed.ancestors)) {
          // Deduplicate by name
          for (const ancestor of parsed.ancestors) {
            const existingIdx = allAncestors.findIndex(a =>
              a.givenNames.toLowerCase() === ancestor.givenNames?.toLowerCase() &&
              a.surname.toLowerCase() === ancestor.surname?.toLowerCase()
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
            } else if (ancestor.notes && ancestor.notes.length > allAncestors[existingIdx].notes.length) {
              // Merge notes if new one has more info
              allAncestors[existingIdx].notes = ancestor.notes
            }
          }
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

    // Check subscription
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', user.id)
      .single()

    const tier = (profile as { subscription_tier: string } | null)?.subscription_tier || 'free'
    if (!['researcher', 'investigator', 'professional'].includes(tier)) {
      return NextResponse.json({ error: 'Upgrade required' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

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
      const buffer = await file.arrayBuffer()
      imageBase64 = Buffer.from(buffer).toString('base64')
      mediaType = 'application/pdf'
    } else if (fileType.startsWith('image/')) {
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
      textContent = await file.text()
    } else if (
      fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      fileType === 'application/msword' ||
      fileName.endsWith('.docx') ||
      fileName.endsWith('.doc')
    ) {
      const buffer = await file.arrayBuffer()
      imageBase64 = Buffer.from(buffer).toString('base64')
      textContent = `[Word Document: ${file.name}]`
    } else {
      try {
        textContent = await file.text()
      } catch {
        return NextResponse.json({
          error: 'Unsupported file type. Please upload a PDF, image, Word doc, or text file.'
        }, { status: 400 })
      }
    }

    let result: { ancestors: ParsedAncestor[], treeName: string, additionalContext: string }

    if (imageBase64 && mediaType) {
      // For PDFs/images, use a single call with retry
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let content: any

      if (mediaType === 'application/pdf') {
        content = [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: 'Extract ALL genealogical information from this entire document. Include EVERY person mentioned with detailed notes. Return JSON as specified.',
          },
        ]
      } else {
        content = [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: 'Extract ALL genealogical information from this image. Include EVERY person with detailed notes. Return JSON as specified.',
          },
        ]
      }

      const response = await retryWithBackoff(() =>
        anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 8000,
          system: systemPrompt,
          messages: [{ role: 'user', content }],
        })
      )

      const responseText = response.content[0].type === 'text' ? response.content[0].text : ''
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        result = {
          ancestors: parsed.ancestors || [],
          treeName: parsed.treeName || 'Imported Family Tree',
          additionalContext: parsed.additionalContext || '',
        }
      } else {
        throw new Error('Failed to parse AI response')
      }
    } else {
      // For text files, use chunked processing
      result = await processTextInChunks(textContent, systemPrompt)
    }

    return NextResponse.json({
      treeName: result.treeName,
      ancestors: result.ancestors,
      additionalContext: result.additionalContext,
    })
  } catch (error) {
    console.error('Document parse error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to process document'

    if (errorMessage.includes('rate_limit') || errorMessage.includes('429')) {
      return NextResponse.json({
        error: 'API rate limit reached. Please wait a moment and try again.'
      }, { status: 429 })
    }

    return NextResponse.json(
      { error: 'Failed to process document' },
      { status: 500 }
    )
  }
}
