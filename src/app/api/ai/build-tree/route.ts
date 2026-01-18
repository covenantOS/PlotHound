import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { canAccessAiFeatures } from '@/lib/subscription-limits'
import type { SubscriptionTier } from '@/types/database'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

interface SeedAncestor {
  givenNames: string
  surname: string
  birthYear: string
  birthPlace: string
  deathYear: string
  deathPlace?: string
  relationship: string
  generation?: number
  notes?: string
}

interface DiscoveredAncestor {
  givenNames: string
  surname: string
  gender: 'male' | 'female' | 'unknown'
  birthDate: string | null
  birthPlace: string | null
  deathDate: string | null
  deathPlace: string | null
  notes: string
  relationship: string
  parentOf: string[] // Names of children
  childOf: { father: string | null; mother: string | null }
  confidence: 'high' | 'medium' | 'low'
}

// Retry helper with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 2000
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Check if it's a rate limit error
      const isRateLimit = lastError.message.includes('rate_limit') ||
        lastError.message.includes('429') ||
        lastError.message.includes('Rate limit')

      if (!isRateLimit || attempt === maxRetries - 1) {
        throw lastError
      }

      // Wait with exponential backoff
      const delay = baseDelayMs * Math.pow(2, attempt)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError
}

export async function POST(request: Request) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
          send({ type: 'error', error: 'Unauthorized' })
          controller.close()
          return
        }

        // Check subscription tier
        const { data: profileData } = await supabase
          .from('profiles')
          .select('subscription_tier')
          .eq('id', user.id)
          .single()

        const profile = profileData as { subscription_tier: SubscriptionTier } | null

        if (!canAccessAiFeatures(profile?.subscription_tier || 'free')) {
          send({ type: 'error', error: 'Upgrade required to use AI Tree Builder' })
          controller.close()
          return
        }

        const { treeName, seedAncestors, additionalContext } = await request.json() as {
          treeName: string
          seedAncestors: SeedAncestor[]
          additionalContext?: string
        }

        send({ type: 'progress', progress: 5, message: 'Creating family tree...' })

        // Create the tree
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: tree, error: treeError } = await (supabase as any)
          .from('trees')
          .insert({ name: treeName, user_id: user.id })
          .select()
          .single()

        if (treeError) {
          send({ type: 'error', error: 'Failed to create tree' })
          controller.close()
          return
        }

        // Check if ancestors have detailed notes (from document upload)
        // If they do, we can skip AI research and add them directly
        const hasDetailedData = seedAncestors.some(a => a.notes && a.notes.length > 50)
        const hasMultipleAncestors = seedAncestors.length >= 5

        let ancestorsToAdd: DiscoveredAncestor[]
        let sourcesChecked: string[] = []

        if (hasDetailedData || hasMultipleAncestors) {
          // Already have extracted data - skip AI research and add directly
          send({ type: 'progress', progress: 20, message: 'Processing extracted ancestors...' })

          ancestorsToAdd = seedAncestors.map(a => ({
            givenNames: a.givenNames,
            surname: a.surname,
            gender: inferGender(a.givenNames) as 'male' | 'female' | 'unknown',
            birthDate: a.birthYear || null,
            birthPlace: a.birthPlace || null,
            deathDate: a.deathYear || null,
            deathPlace: a.deathPlace || null,
            notes: a.notes || '',
            relationship: a.relationship,
            parentOf: [],
            childOf: { father: null, mother: null },
            confidence: 'high' as const,
          }))

          sourcesChecked = ['Uploaded Document', 'User Provided Data']

          // If we have additional context, add a brief AI enhancement pass
          if (additionalContext && additionalContext.length > 100) {
            send({ type: 'progress', progress: 30, message: 'Enhancing with additional context...' })

            try {
              // Small, focused AI call to add context to notes
              const enhancementPrompt = buildEnhancementPrompt(seedAncestors.slice(0, 10), additionalContext)

              const enhancement = await retryWithBackoff(() =>
                anthropic.messages.create({
                  model: 'claude-sonnet-4-20250514',
                  max_tokens: 2000,
                  messages: [{ role: 'user', content: enhancementPrompt }],
                })
              )

              const enhancementText = enhancement.content[0].type === 'text' ? enhancement.content[0].text : ''

              try {
                const enhancementMatch = enhancementText.match(/\{[\s\S]*\}/)
                if (enhancementMatch) {
                  const enhancements = JSON.parse(enhancementMatch[0])
                  if (enhancements.enhancements) {
                    for (const enh of enhancements.enhancements) {
                      const idx = ancestorsToAdd.findIndex(a =>
                        `${a.givenNames} ${a.surname}`.toLowerCase() === enh.name?.toLowerCase()
                      )
                      if (idx !== -1 && enh.additionalNotes) {
                        ancestorsToAdd[idx].notes += '\n\n' + enh.additionalNotes
                      }
                    }
                  }
                }
              } catch {
                // Enhancement parsing failed, continue without it
              }
            } catch {
              // Enhancement failed, continue without it
            }
          }
        } else {
          // Minimal seed data - do AI research
          send({ type: 'progress', progress: 15, message: 'AI is researching historical records...' })

          try {
            const prompt = buildResearchPrompt(seedAncestors)

            const message = await retryWithBackoff(() =>
              anthropic.messages.create({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 4000, // Reduced to avoid rate limits
                messages: [{ role: 'user', content: prompt }],
              })
            )

            send({ type: 'progress', progress: 50, message: 'Processing research findings...' })

            const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

            // Parse the JSON response
            const jsonMatch = responseText.match(/\{[\s\S]*\}/)
            if (!jsonMatch) {
              throw new Error('Failed to parse AI research results')
            }

            const researchResult = JSON.parse(jsonMatch[0]) as {
              ancestors: DiscoveredAncestor[]
              sourcesChecked: string[]
              summary: string
            }

            ancestorsToAdd = researchResult.ancestors
            sourcesChecked = researchResult.sourcesChecked
          } catch (error) {
            // If AI research fails, fall back to just adding the seed ancestors
            send({ type: 'progress', progress: 40, message: 'Adding seed ancestors...' })

            ancestorsToAdd = seedAncestors.map(a => ({
              givenNames: a.givenNames,
              surname: a.surname,
              gender: inferGender(a.givenNames) as 'male' | 'female' | 'unknown',
              birthDate: a.birthYear || null,
              birthPlace: a.birthPlace || null,
              deathDate: a.deathYear || null,
              deathPlace: a.deathPlace || null,
              notes: a.notes || 'Seed ancestor - verify with original sources.',
              relationship: a.relationship,
              parentOf: [],
              childOf: { father: null, mother: null },
              confidence: 'high' as const,
            }))

            sourcesChecked = ['User Provided Data']
          }
        }

        send({ type: 'progress', progress: 60, message: `Adding ${ancestorsToAdd.length} ancestors to tree...` })

        // Create ancestors in database
        const ancestorIdMap = new Map<string, string>() // name -> id
        let notesCount = 0

        // Process in batches to avoid overwhelming the database
        const BATCH_SIZE = 10
        for (let batchStart = 0; batchStart < ancestorsToAdd.length; batchStart += BATCH_SIZE) {
          const batch = ancestorsToAdd.slice(batchStart, batchStart + BATCH_SIZE)
          const progress = 60 + Math.round((batchStart / ancestorsToAdd.length) * 25)

          send({ type: 'progress', progress, message: `Adding ancestors ${batchStart + 1}-${Math.min(batchStart + BATCH_SIZE, ancestorsToAdd.length)}...` })

          for (const ancestor of batch) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: newAncestor, error } = await (supabase as any)
              .from('ancestors')
              .insert({
                tree_id: tree.id,
                given_names: ancestor.givenNames || null,
                surname: ancestor.surname || null,
                gender: ancestor.gender || null,
                birth_date: ancestor.birthDate || null,
                birth_place: ancestor.birthPlace || null,
                death_date: ancestor.deathDate || null,
                death_place: ancestor.deathPlace || null,
                notes: buildAncestorNotes(ancestor),
                research_priority: ancestor.confidence === 'high' ? 1 : ancestor.confidence === 'medium' ? 2 : 3,
              })
              .select()
              .single()

            if (!error && newAncestor) {
              const nameKey = `${ancestor.givenNames} ${ancestor.surname}`.toLowerCase()
              ancestorIdMap.set(nameKey, newAncestor.id)

              if (ancestor.notes) {
                notesCount++
              }
            }
          }

          // Small delay between batches
          if (batchStart + BATCH_SIZE < ancestorsToAdd.length) {
            await new Promise(resolve => setTimeout(resolve, 100))
          }
        }

        send({ type: 'progress', progress: 88, message: 'Linking family relationships...' })

        // Second pass: link parent relationships
        for (const ancestor of ancestorsToAdd) {
          const nameKey = `${ancestor.givenNames} ${ancestor.surname}`.toLowerCase()
          const ancestorId = ancestorIdMap.get(nameKey)
          if (!ancestorId) continue

          const updates: Record<string, string> = {}

          if (ancestor.childOf?.father) {
            const fatherId = ancestorIdMap.get(ancestor.childOf.father.toLowerCase())
            if (fatherId) updates.father_id = fatherId
          }

          if (ancestor.childOf?.mother) {
            const motherId = ancestorIdMap.get(ancestor.childOf.mother.toLowerCase())
            if (motherId) updates.mother_id = motherId
          }

          if (Object.keys(updates).length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase as any)
              .from('ancestors')
              .update(updates)
              .eq('id', ancestorId)
          }
        }

        send({ type: 'progress', progress: 95, message: 'Adding research sources...' })

        // Add sources checked for the first ancestor
        const firstAncestorId = ancestorIdMap.values().next().value
        if (firstAncestorId && sourcesChecked.length > 0) {
          for (const source of sourcesChecked.slice(0, 5)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase as any)
              .from('sources_checked')
              .insert({
                ancestor_id: firstAncestorId,
                source_name: source,
                source_type: 'other',
                outcome: 'found_record',
                findings: 'Source from tree builder',
              })
          }
        }

        send({ type: 'progress', progress: 100, message: 'Complete!' })

        // Calculate generations
        const generations = calculateGenerations(ancestorsToAdd)

        send({
          type: 'complete',
          result: {
            ancestorsFound: ancestorsToAdd.length,
            generationsResearched: generations,
            sourcesChecked: sourcesChecked.length,
            notesAdded: notesCount,
            treeId: tree.id,
          },
        })

        controller.close()
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Research failed'

        // Provide more helpful error messages
        if (errorMessage.includes('rate_limit') || errorMessage.includes('429')) {
          send({ type: 'error', error: 'API rate limit reached. Please wait a moment and try again.' })
        } else {
          send({ type: 'error', error: errorMessage })
        }

        controller.close()
      }
    },
  })

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

function inferGender(givenNames: string): 'male' | 'female' | 'unknown' {
  const name = givenNames.toLowerCase().split(' ')[0]

  const maleNames = ['john', 'william', 'james', 'george', 'charles', 'thomas', 'robert', 'joseph', 'henry', 'edward', 'michael', 'david', 'richard', 'daniel', 'matthew', 'andrew', 'peter', 'paul', 'mark', 'luke', 'samuel', 'benjamin', 'jacob', 'isaac', 'abraham']
  const femaleNames = ['mary', 'elizabeth', 'anna', 'sarah', 'margaret', 'jane', 'catherine', 'emma', 'emily', 'hannah', 'grace', 'rachel', 'rebecca', 'ruth', 'martha', 'helen', 'dorothy', 'alice', 'anne', 'sophia', 'charlotte', 'victoria', 'caroline', 'harriet']

  if (maleNames.includes(name)) return 'male'
  if (femaleNames.includes(name)) return 'female'
  return 'unknown'
}

function buildEnhancementPrompt(ancestors: SeedAncestor[], additionalContext: string): string {
  const names = ancestors.map(a => `${a.givenNames} ${a.surname}`).join(', ')

  return `Based on this additional family context, provide brief historical notes for these ancestors: ${names}

CONTEXT:
${additionalContext.slice(0, 2000)}

Respond with JSON only:
{
  "enhancements": [
    { "name": "Full Name", "additionalNotes": "Brief relevant historical context (1-2 sentences)" }
  ]
}`
}

function buildResearchPrompt(seedAncestors: SeedAncestor[]): string {
  const ancestorInfo = seedAncestors.slice(0, 5).map((a, i) => `
  Ancestor ${i + 1}:
  - Name: ${a.givenNames} ${a.surname}
  - Birth: ${a.birthYear || 'Unknown'}, ${a.birthPlace || 'Unknown'}
  - Death: ${a.deathYear || 'Unknown'}
  - Relationship: ${a.relationship || 'Unknown'}
  `).join('\n')

  return `You are a genealogist. Based on these seed ancestors, suggest plausible family members.

SEED ANCESTORS:
${ancestorInfo}

Respond with JSON ONLY (no markdown):
{
  "ancestors": [
    {
      "givenNames": "John",
      "surname": "Smith",
      "gender": "male",
      "birthDate": "1850",
      "birthPlace": "Boston, MA",
      "deathDate": "1920",
      "deathPlace": "Boston, MA",
      "notes": "Likely in 1860-1880 census. Check MA vital records.",
      "relationship": "Parent of [seed name]",
      "parentOf": [],
      "childOf": { "father": null, "mother": null },
      "confidence": "medium"
    }
  ],
  "sourcesChecked": ["US Census", "Vital Records"],
  "summary": "Brief summary"
}

Keep response under 3000 tokens. Include 5-15 likely relatives.`
}

function buildAncestorNotes(ancestor: DiscoveredAncestor): string {
  const lines: string[] = []

  if (ancestor.notes) {
    lines.push(ancestor.notes)
    lines.push('')
  }

  lines.push('---')
  lines.push(`Confidence: ${ancestor.confidence.toUpperCase()}`)
  lines.push('Note: Please verify with original sources.')

  return lines.join('\n')
}

function calculateGenerations(ancestors: DiscoveredAncestor[]): number {
  const relationships = new Set<string>()

  for (const a of ancestors) {
    const rel = a.relationship.toLowerCase()
    if (rel.includes('self') || rel.includes('starting')) relationships.add('0')
    if (rel.includes('parent')) relationships.add('1')
    if (rel.includes('grandparent')) relationships.add('2')
    if (rel.includes('great-grandparent') || rel.includes('great grandparent')) relationships.add('3')
    if (rel.includes('great-great')) relationships.add('4')
    if (rel.includes('sibling') || rel.includes('spouse')) relationships.add('0')
    if (rel.includes('child')) relationships.add('-1')
  }

  return Math.max(relationships.size, 1)
}
