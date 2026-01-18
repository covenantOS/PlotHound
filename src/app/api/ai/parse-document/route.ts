import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

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

    // Determine how to process the file
    let textContent = ''
    let imageBase64: string | null = null
    let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | 'application/pdf' | null = null

    if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
      // For PDFs, we'll send as base64 to Claude's vision
      const buffer = await file.arrayBuffer()
      imageBase64 = Buffer.from(buffer).toString('base64')
      mediaType = 'application/pdf'
    } else if (fileType.startsWith('image/')) {
      // Images can be processed directly by Claude's vision
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
      // Plain text files
      textContent = await file.text()
    } else if (
      fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      fileType === 'application/msword' ||
      fileName.endsWith('.docx') ||
      fileName.endsWith('.doc')
    ) {
      // For Word docs, extract text (basic extraction)
      // Note: Full docx parsing would require a library, but we can try reading as text
      // or sending to Claude with instructions
      const buffer = await file.arrayBuffer()
      imageBase64 = Buffer.from(buffer).toString('base64')
      // Send as binary and let Claude try to extract what it can
      textContent = `[Word Document: ${file.name}]\n\nPlease extract any genealogical information you can identify from this document.`
    } else {
      // Try to read as text
      try {
        textContent = await file.text()
      } catch {
        return NextResponse.json({
          error: 'Unsupported file type. Please upload a PDF, image, Word doc, or text file.'
        }, { status: 400 })
      }
    }

    // Build the message for Claude - comprehensive extraction prompt
    const systemPrompt = `You are a thorough genealogy research assistant. Your task is to extract EVERY SINGLE PERSON mentioned in the document, no matter how many there are.

CRITICAL INSTRUCTIONS:
1. Extract EVERY person mentioned - do not skip anyone, even if there are 100+ people
2. Include ALL generations - from the most recent to the oldest mentioned
3. For each person, add detailed notes with ANY information found about them
4. Be thorough - this is the user's family history and every detail matters

Return a JSON object with this EXACT structure:
{
  "treeName": "suggested tree name based on the primary family surname",
  "ancestors": [
    {
      "givenNames": "first and middle names (use full names when available)",
      "surname": "last name / family name",
      "birthYear": "YYYY format or empty string if unknown",
      "birthPlace": "city, state/region, country if available, or empty string",
      "deathYear": "YYYY format or empty string if unknown",
      "deathPlace": "city, state/region, country if available, or empty string",
      "relationship": "relationship to the first person listed (Self, Parent, Grandparent, Great-Grandparent, Child, Sibling, Spouse, Aunt/Uncle, Cousin, or describe the relationship)",
      "generation": "number indicating generation (0 for self, 1 for parents, 2 for grandparents, etc.)",
      "notes": "DETAILED notes including: occupation, cause of death, immigration info, military service, religion, marriage dates, children's names, census records mentioned, any stories or biographical details, source citations if mentioned"
    }
  ],
  "additionalContext": "any family history context, migration patterns, historical events mentioned, family traditions, or other relevant information not tied to a specific person"
}

IMPORTANT:
- Extract ALL people, even if there are dozens or hundreds
- Include spouses, children, siblings, aunts, uncles, cousins - everyone
- Notes should be comprehensive - include everything mentioned about each person
- If someone is mentioned multiple times, combine all information into one entry
- Preserve exact dates when given (not just years)
- Include maiden names in parentheses if mentioned
- Return ONLY valid JSON, no markdown code blocks or explanation`

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let content: any

    if (imageBase64 && mediaType) {
      if (mediaType === 'application/pdf') {
        // PDF document support - use 'document' type (SDK types may not be updated yet)
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
            text: 'Extract ALL genealogical information from this entire document. Include EVERY person mentioned, across ALL generations. Do not skip anyone. Add detailed notes for each person with any information found. Return JSON as specified in your instructions.',
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
            text: 'Extract ALL genealogical information from this image. Include EVERY person mentioned. Add detailed notes for each person. Return JSON as specified.',
          },
        ]
      }
    } else {
      content = `Extract ALL genealogical information from the following document. Include EVERY person mentioned, no matter how many. Add detailed notes for each person.\n\n${textContent}`
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 16000, // Increased to handle large family trees
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content,
        },
      ],
    })

    const responseText = response.content[0].type === 'text' ? response.content[0].text : ''

    // Parse the JSON response
    let parsed
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No JSON found in response')
      }
    } catch {
      console.error('Failed to parse AI response:', responseText)
      return NextResponse.json({
        error: 'Failed to parse document. Please try a different file or enter ancestors manually.'
      }, { status: 500 })
    }

    return NextResponse.json({
      treeName: parsed.treeName || 'Imported Family Tree',
      ancestors: parsed.ancestors || [],
      additionalContext: parsed.additionalContext || '',
    })
  } catch (error) {
    console.error('Document parse error:', error)
    return NextResponse.json(
      { error: 'Failed to process document' },
      { status: 500 }
    )
  }
}
