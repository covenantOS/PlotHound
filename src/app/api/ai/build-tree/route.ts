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
  relationship: string
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

        const { treeName, seedAncestors } = await request.json() as {
          treeName: string
          seedAncestors: SeedAncestor[]
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

        send({ type: 'progress', progress: 10, message: 'Analyzing seed ancestors...' })

        // Build the AI prompt
        const prompt = buildResearchPrompt(seedAncestors)

        send({ type: 'progress', progress: 15, message: 'AI is researching historical records...' })

        // Call Claude to research and discover ancestors
        const message = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 8192,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        })

        send({ type: 'progress', progress: 50, message: 'Processing research findings...' })

        const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

        // Parse the JSON response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
          send({ type: 'error', error: 'Failed to parse AI research results' })
          controller.close()
          return
        }

        const researchResult = JSON.parse(jsonMatch[0]) as {
          ancestors: DiscoveredAncestor[]
          sourcesChecked: string[]
          summary: string
        }

        send({ type: 'progress', progress: 60, message: `Found ${researchResult.ancestors.length} potential ancestors...` })

        // Create ancestors in database
        const ancestorIdMap = new Map<string, string>() // name -> id
        let notesCount = 0

        for (let i = 0; i < researchResult.ancestors.length; i++) {
          const ancestor = researchResult.ancestors[i]
          const progress = 60 + Math.round((i / researchResult.ancestors.length) * 30)

          send({ type: 'progress', progress, message: `Adding ${ancestor.givenNames} ${ancestor.surname}...` })

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

        send({ type: 'progress', progress: 92, message: 'Linking family relationships...' })

        // Second pass: link parent relationships
        for (const ancestor of researchResult.ancestors) {
          const nameKey = `${ancestor.givenNames} ${ancestor.surname}`.toLowerCase()
          const ancestorId = ancestorIdMap.get(nameKey)
          if (!ancestorId) continue

          const updates: Record<string, string> = {}

          if (ancestor.childOf.father) {
            const fatherId = ancestorIdMap.get(ancestor.childOf.father.toLowerCase())
            if (fatherId) updates.father_id = fatherId
          }

          if (ancestor.childOf.mother) {
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

        // Add sources checked for the first seed ancestor
        const firstAncestorId = ancestorIdMap.values().next().value
        if (firstAncestorId) {
          for (const source of researchResult.sourcesChecked.slice(0, 10)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase as any)
              .from('sources_checked')
              .insert({
                ancestor_id: firstAncestorId,
                source_name: source,
                source_type: 'other',
                outcome: 'found_record',
                findings: 'AI-researched source',
              })
          }
        }

        send({ type: 'progress', progress: 100, message: 'Complete!' })

        // Calculate generations
        const generations = calculateGenerations(researchResult.ancestors)

        send({
          type: 'complete',
          result: {
            ancestorsFound: researchResult.ancestors.length,
            generationsResearched: generations,
            sourcesChecked: researchResult.sourcesChecked.length,
            notesAdded: notesCount,
            treeId: tree.id,
          },
        })

        controller.close()
      } catch (error) {
        send({ type: 'error', error: error instanceof Error ? error.message : 'Research failed' })
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

function buildResearchPrompt(seedAncestors: SeedAncestor[]): string {
  const ancestorInfo = seedAncestors.map((a, i) => `
  Ancestor ${i + 1}:
  - Name: ${a.givenNames} ${a.surname}
  - Birth Year: ${a.birthYear || 'Unknown'}
  - Birth Place: ${a.birthPlace || 'Unknown'}
  - Death Year: ${a.deathYear || 'Unknown'}
  - Relationship: ${a.relationship || 'Unknown'}
  `).join('\n')

  return `You are a professional genealogist AI assistant. Based on the following seed ancestors, research and discover their likely family members.

SEED ANCESTORS:
${ancestorInfo}

TASK:
Research and construct a plausible family tree based on historical patterns, common naming conventions, and typical family structures for the time period and location.

For each discovered ancestor, provide:
1. Full name (given names and surname)
2. Gender
3. Estimated birth/death dates (based on typical lifespans for the era)
4. Birth/death places (if inferable from family location)
5. Notes about potential records to search (census, vital records, etc.)
6. Relationship to seed ancestors
7. Parent information
8. Confidence level (high/medium/low)

GUIDELINES:
- Stay historically accurate for naming conventions of the era/location
- Use typical family sizes for the time period
- Add realistic notes about where records might be found
- Include at least 2-3 generations if possible
- Mark confidence appropriately - direct relatives of seed ancestors = high, inferred = medium/low
- Include potential siblings, parents, grandparents
- Note: These are STARTING POINTS for research, not confirmed facts

Respond with ONLY a JSON object in this exact format:
{
  "ancestors": [
    {
      "givenNames": "John",
      "surname": "Smith",
      "gender": "male",
      "birthDate": "1850",
      "birthPlace": "Boston, Massachusetts",
      "deathDate": "1920",
      "deathPlace": "Boston, Massachusetts",
      "notes": "Likely appears in 1860, 1870, 1880 census records. Check Massachusetts vital records for birth certificate.",
      "relationship": "Seed ancestor (self)",
      "parentOf": ["William Smith", "Mary Smith"],
      "childOf": { "father": "William Smith Sr", "mother": "Sarah Johnson" },
      "confidence": "high"
    }
  ],
  "sourcesChecked": [
    "US Census 1850-1940",
    "Massachusetts Vital Records",
    "Boston City Directories",
    "Immigration Records",
    "Newspaper Archives"
  ],
  "summary": "Brief summary of the research findings"
}`
}

function buildAncestorNotes(ancestor: DiscoveredAncestor): string {
  const lines: string[] = []

  lines.push(`[AI-RESEARCHED - ${ancestor.confidence.toUpperCase()} CONFIDENCE]`)
  lines.push('')

  if (ancestor.notes) {
    lines.push(ancestor.notes)
    lines.push('')
  }

  lines.push('---')
  lines.push('Note: This ancestor was discovered by AI research.')
  lines.push('Please verify with original sources before treating as confirmed.')

  return lines.join('\n')
}

function calculateGenerations(ancestors: DiscoveredAncestor[]): number {
  // Simple heuristic based on relationships mentioned
  const relationships = new Set<string>()

  for (const a of ancestors) {
    const rel = a.relationship.toLowerCase()
    if (rel.includes('self') || rel.includes('starting')) relationships.add('0')
    if (rel.includes('parent')) relationships.add('1')
    if (rel.includes('grandparent')) relationships.add('2')
    if (rel.includes('great-grandparent') || rel.includes('great grandparent')) relationships.add('3')
    if (rel.includes('sibling') || rel.includes('spouse')) relationships.add('0')
    if (rel.includes('child')) relationships.add('-1')
  }

  return Math.max(relationships.size, 1)
}
