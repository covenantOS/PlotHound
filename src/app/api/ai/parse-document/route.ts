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

    // Build the message for Claude
    const systemPrompt = `You are a genealogy research assistant. Extract ancestor information from the provided document.

Return a JSON object with:
{
  "treeName": "suggested tree name based on content",
  "ancestors": [
    {
      "givenNames": "first and middle names",
      "surname": "last name",
      "birthYear": "YYYY or empty",
      "birthPlace": "location or empty",
      "deathYear": "YYYY or empty",
      "relationship": "one of: Self, Parent, Grandparent, Great-Grandparent, Sibling, Spouse, Child, or Other",
      "notes": "any additional information found about this person"
    }
  ],
  "additionalContext": "any other useful genealogical context from the document"
}

Extract ALL people mentioned with genealogical relevance. Include dates, places, relationships, and any biographical details.
If you find family relationships, try to determine how people are related.
Return ONLY valid JSON, no markdown or explanation.`

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
            text: 'Extract all genealogical information from this document. Return JSON as specified.',
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
            text: 'Extract all genealogical information from this image. Return JSON as specified.',
          },
        ]
      }
    } else {
      content = `Extract genealogical information from the following document:\n\n${textContent}`
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
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
