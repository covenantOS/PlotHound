import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAIConfig, createCompletion } from '@/lib/ai/provider'
import type { Ancestor } from '@/types/database'

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

    // Fetch all ancestors in the tree
    const { data: ancestorsData, error: fetchError } = await supabase
      .from('ancestors')
      .select('*')
      .eq('tree_id', treeId)
      .order('birth_date')

    if (fetchError || !ancestorsData) {
      return NextResponse.json({ error: 'Failed to fetch ancestors' }, { status: 500 })
    }

    const ancestors = ancestorsData as Ancestor[]

    if (ancestors.length < 2) {
      return NextResponse.json({
        message: 'Need at least 2 ancestors to detect relationships',
        updated: 0
      })
    }

    // Build the prompt for AI analysis
    const prompt = buildRelationshipDetectionPrompt(ancestors)

    // Call AI
    const result = await createCompletion(aiConfig, {
      system: `You are an expert genealogist analyzing family relationships. Given a list of people, infer likely family relationships based on:
- Shared surnames (especially maiden names)
- Birth dates and reasonable age gaps for parent-child relationships (typically 15-50 years)
- Death dates and lifespans
- Birth/death locations
- Common naming patterns (children often named after grandparents)

Be conservative - only suggest relationships you're reasonably confident about. Mark confidence levels appropriately.`,
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

    for (const rel of relationships) {
      // Only update if confidence is >= 70%
      if (rel.confidence < 70) continue

      const updateData: Partial<Ancestor> = {}
      let shouldUpdate = false

      // Find the ancestor
      const ancestor = ancestors.find(a => a.id === rel.personId)
      if (!ancestor) continue

      // Only update if the relationship doesn't already exist
      if (rel.fatherId && !ancestor.father_id) {
        updateData.father_id = rel.fatherId
        shouldUpdate = true
      }
      if (rel.motherId && !ancestor.mother_id) {
        updateData.mother_id = rel.motherId
        shouldUpdate = true
      }
      if (rel.spouseIds && rel.spouseIds.length > 0) {
        const existingSpouses = ancestor.spouse_ids || []
        const newSpouses = rel.spouseIds.filter(id => !existingSpouses.includes(id))
        if (newSpouses.length > 0) {
          updateData.spouse_ids = [...existingSpouses, ...newSpouses]
          shouldUpdate = true
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

function buildRelationshipDetectionPrompt(ancestors: Ancestor[]): string {
  const peopleList = ancestors.map(a => {
    const name = [a.given_names, a.surname].filter(Boolean).join(' ') || 'Unknown'
    return `- ID: ${a.id}
  Name: ${name}${a.maiden_name ? ` (nee ${a.maiden_name})` : ''}
  Gender: ${a.gender || 'unknown'}
  Birth: ${a.birth_date || '?'}${a.birth_place ? ` in ${a.birth_place}` : ''}
  Death: ${a.death_date || '?'}${a.death_place ? ` in ${a.death_place}` : ''}
  Current Father ID: ${a.father_id || 'none'}
  Current Mother ID: ${a.mother_id || 'none'}
  Current Spouse IDs: ${a.spouse_ids?.join(', ') || 'none'}`
  }).join('\n\n')

  return `Analyze these ${ancestors.length} people and detect likely family relationships.

## People in the Tree

${peopleList}

## Instructions

1. Look for parent-child relationships based on:
   - Age gaps (parents typically 15-50 years older than children)
   - Shared surnames
   - Maiden names matching other surnames in the tree
   - Geographic proximity

2. Look for spouse relationships based on:
   - Similar ages (within ~15 years typically)
   - Shared location/time periods
   - Children with both their surnames

3. Only suggest NEW relationships (don't repeat existing ones)

4. Assign confidence levels:
   - 90-100%: Very strong evidence (exact matches, documented)
   - 70-89%: Good evidence (multiple indicators align)
   - 50-69%: Possible (some indicators but inconclusive)
   - Below 50%: Speculation only

Respond in JSON format:
{
  "summary": "Brief overview of what relationships were detected",
  "relationships": [
    {
      "personId": "uuid-of-person",
      "fatherId": "uuid-of-father or null",
      "motherId": "uuid-of-mother or null",
      "spouseIds": ["uuid-of-spouse"] or [],
      "confidence": 85,
      "reasoning": "Why this relationship is likely"
    }
  ]
}`
}
