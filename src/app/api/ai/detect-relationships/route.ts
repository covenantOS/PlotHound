import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAIConfig, createCompletion } from '@/lib/ai/provider'
import type { Ancestor, Fact } from '@/types/database'

interface ProfileWithKeys {
  subscription_tier: string
  ai_provider?: string
  anthropic_api_key?: string
  openai_api_key?: string
  google_api_key?: string
  use_own_api_key?: boolean
}

interface DetectedRelationship {
  personId: string
  fatherId?: string
  motherId?: string
  spouseIds?: string[]
  confidence: number
  reasoning: string
}

interface AncestorWithFacts extends Ancestor {
  facts: Fact[]
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { treeId } = await request.json()

    if (!treeId) {
      return NextResponse.json({ error: 'Tree ID required' }, { status: 400 })
    }

    // Fetch profile with API keys
    const { data: profileData } = await supabase
      .from('profiles')
      .select('subscription_tier, ai_provider, anthropic_api_key, openai_api_key, google_api_key, use_own_api_key')
      .eq('id', user.id)
      .single()

    const profile = profileData as ProfileWithKeys | null
    const aiConfig = getAIConfig(profile)

    // Fetch all ancestors in the tree with their facts
    const { data: ancestorsData, error: fetchError } = await supabase
      .from('ancestors')
      .select(`
        *,
        facts (*)
      `)
      .eq('tree_id', treeId)
      .order('birth_date')

    if (fetchError || !ancestorsData) {
      return NextResponse.json({ error: 'Failed to fetch ancestors' }, { status: 500 })
    }

    const ancestors = ancestorsData as AncestorWithFacts[]

    if (ancestors.length < 2) {
      return NextResponse.json({
        message: 'Need at least 2 ancestors to detect relationships',
        updated: 0
      })
    }

    // Build the prompt for AI analysis - now includes notes and facts
    const prompt = buildRelationshipDetectionPrompt(ancestors)

    // Call AI
    const result = await createCompletion(aiConfig, {
      system: `You are an expert genealogist analyzing family relationships. Your PRIMARY job is to extract relationships from the notes, facts, and contextual data provided.

CRITICAL: Carefully read the NOTES and FACTS for each person. These often contain EXPLICIT relationship information like:
- "Son of John Smith"
- "Daughter of Mary and William"
- "Married to Jane Doe"
- "Father: William Brown"
- "Mother: Elizabeth Taylor"
- "Wife/Husband of..."
- "Child of..."

When you find explicit relationship mentions in notes/facts, these should be HIGH CONFIDENCE (90%+).

Also infer relationships from:
- Shared surnames (especially maiden names)
- Birth dates and age gaps (parents typically 15-50 years older)
- Death dates and lifespans
- Birth/death locations
- Common naming patterns (children often named after grandparents)

IMPORTANT: You must match relationship mentions to actual people in the tree by name. When notes say "son of John Smith", find the person named John Smith in the tree and use their ID.`,
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 4096,
    })

    // Parse JSON response
    const jsonMatch = result.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
    }

    const analysisResult = JSON.parse(jsonMatch[0])
    const relationships: DetectedRelationship[] = analysisResult.relationships || []

    // Update ancestors with detected relationships
    let updatedCount = 0
    const updateClient = await createClient()
    const updatedDetails: string[] = []

    for (const rel of relationships) {
      // Only update if confidence is >= 70%
      if (rel.confidence < 70) continue

      const updateData: Partial<Ancestor> = {}
      let shouldUpdate = false

      // Find the ancestor
      const ancestor = ancestors.find(a => a.id === rel.personId)
      if (!ancestor) continue

      const ancestorName = [ancestor.given_names, ancestor.surname].filter(Boolean).join(' ') || 'Unknown'

      // Only update if the relationship doesn't already exist
      if (rel.fatherId && !ancestor.father_id) {
        // Verify the father exists in the tree
        const father = ancestors.find(a => a.id === rel.fatherId)
        if (father) {
          updateData.father_id = rel.fatherId
          shouldUpdate = true
          const fatherName = [father.given_names, father.surname].filter(Boolean).join(' ')
          updatedDetails.push(`${ancestorName}'s father: ${fatherName}`)
        }
      }
      if (rel.motherId && !ancestor.mother_id) {
        // Verify the mother exists in the tree
        const mother = ancestors.find(a => a.id === rel.motherId)
        if (mother) {
          updateData.mother_id = rel.motherId
          shouldUpdate = true
          const motherName = [mother.given_names, mother.surname].filter(Boolean).join(' ')
          updatedDetails.push(`${ancestorName}'s mother: ${motherName}`)
        }
      }
      if (rel.spouseIds && rel.spouseIds.length > 0) {
        const existingSpouses = ancestor.spouse_ids || []
        // Filter to only valid spouse IDs that exist in tree and aren't already linked
        const newSpouses = rel.spouseIds.filter(id => {
          const spouse = ancestors.find(a => a.id === id)
          return spouse && !existingSpouses.includes(id)
        })
        if (newSpouses.length > 0) {
          updateData.spouse_ids = [...existingSpouses, ...newSpouses]
          shouldUpdate = true

          // Also update the reverse relationship (spouse should have this person as spouse too)
          for (const spouseId of newSpouses) {
            const spouse = ancestors.find(a => a.id === spouseId)
            if (spouse) {
              const spouseExistingSpouses = spouse.spouse_ids || []
              if (!spouseExistingSpouses.includes(rel.personId)) {
                await updateClient
                  .from('ancestors')
                  .update({ spouse_ids: [...spouseExistingSpouses, rel.personId] })
                  .eq('id', spouseId)
              }
              const spouseName = [spouse.given_names, spouse.surname].filter(Boolean).join(' ')
              updatedDetails.push(`${ancestorName} married to ${spouseName}`)
            }
          }
        }
      }

      if (shouldUpdate) {
        const { error: updateError } = await updateClient
          .from('ancestors')
          .update(updateData)
          .eq('id', rel.personId)

        if (!updateError) {
          updatedCount++
        }
      }
    }

    return NextResponse.json({
      success: true,
      analyzed: ancestors.length,
      relationshipsDetected: relationships.length,
      updated: updatedCount,
      summary: analysisResult.summary || 'Relationship analysis complete',
      updatedRelationships: updatedDetails,
      details: relationships.filter(r => r.confidence >= 70).map(r => ({
        person: ancestors.find(a => a.id === r.personId),
        ...r
      }))
    })
  } catch (error) {
    console.error('Relationship detection error:', error)
    return NextResponse.json(
      { error: 'Failed to detect relationships' },
      { status: 500 }
    )
  }
}

function buildRelationshipDetectionPrompt(ancestors: AncestorWithFacts[]): string {
  // Build a name-to-ID lookup for easier matching
  const nameToId: Record<string, string> = {}
  ancestors.forEach(a => {
    const fullName = [a.given_names, a.surname].filter(Boolean).join(' ')
    if (fullName) {
      nameToId[fullName.toLowerCase()] = a.id
      // Also add with maiden name variations
      if (a.maiden_name) {
        const maidenFullName = [a.given_names, a.maiden_name].filter(Boolean).join(' ')
        nameToId[maidenFullName.toLowerCase()] = a.id
      }
    }
  })

  const peopleList = ancestors.map(a => {
    const name = [a.given_names, a.surname].filter(Boolean).join(' ') || 'Unknown'

    // Format facts for this person
    const factsText = a.facts && a.facts.length > 0
      ? a.facts.map(f => `    - ${f.fact_type}: ${f.fact_value}`).join('\n')
      : '    (no facts recorded)'

    // Include notes - this is crucial for relationship detection
    const notesText = a.notes ? `  Notes: ${a.notes}` : '  Notes: (none)'

    return `- ID: ${a.id}
  Name: ${name}${a.maiden_name ? ` (nee ${a.maiden_name})` : ''}
  Gender: ${a.gender || 'unknown'}
  Birth: ${a.birth_date || '?'}${a.birth_place ? ` in ${a.birth_place}` : ''}
  Death: ${a.death_date || '?'}${a.death_place ? ` in ${a.death_place}` : ''}
${notesText}
  Facts:
${factsText}
  Current Father ID: ${a.father_id || 'none'}
  Current Mother ID: ${a.mother_id || 'none'}
  Current Spouse IDs: ${a.spouse_ids?.join(', ') || 'none'}`
  }).join('\n\n')

  // Include name lookup for reference
  const nameIndex = Object.entries(nameToId)
    .map(([name, id]) => `  "${name}" => ${id}`)
    .join('\n')

  return `Analyze these ${ancestors.length} people and detect likely family relationships.

## Name Index (for matching names mentioned in notes to IDs)
${nameIndex}

## People in the Tree

${peopleList}

## CRITICAL Instructions

1. **FIRST**: Read through ALL notes and facts carefully. Look for EXPLICIT relationship mentions:
   - "Son of [Name]" or "Daughter of [Name]" => Set that person as father/mother
   - "Father: [Name]" or "Mother: [Name]" => Direct relationship
   - "Married to [Name]" or "Wife/Husband of [Name]" => Spouse relationship
   - "Parents: [Name] and [Name]" => Both parents
   - Any text mentioning family relationships

2. **MATCH NAMES TO IDs**: When you find a relationship mention like "son of John Smith", look up "john smith" in the Name Index above to get the correct ID.

3. Look for parent-child relationships based on:
   - EXPLICIT mentions in notes/facts (HIGHEST priority)
   - Age gaps (parents typically 15-50 years older than children)
   - Shared surnames
   - Maiden names matching other surnames in the tree

4. Look for spouse relationships based on:
   - EXPLICIT mentions in notes/facts (HIGHEST priority)
   - Similar ages (within ~15 years typically)
   - Shared location/time periods

5. Only suggest NEW relationships (where current father/mother/spouse ID is "none")

6. Confidence levels:
   - 95-100%: Explicit text mention (e.g., "son of John Smith" when John Smith exists in tree)
   - 85-94%: Strong contextual evidence
   - 70-84%: Good inference from multiple indicators
   - Below 70%: Don't include

Respond in JSON format:
{
  "summary": "Brief overview of what relationships were detected",
  "relationships": [
    {
      "personId": "uuid-of-person",
      "fatherId": "uuid-of-father or null",
      "motherId": "uuid-of-mother or null",
      "spouseIds": ["uuid-of-spouse"] or [],
      "confidence": 95,
      "reasoning": "Why this relationship is likely - cite the specific note/fact that indicates this"
    }
  ]
}`
}
