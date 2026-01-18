import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAIConfig, createCompletion } from '@/lib/ai/provider'
import { canAccessAdvancedAi } from '@/lib/subscription-limits'
import type { SubscriptionTier, Ancestor, Fact, ResearchGoal, SourceChecked, ResearchLogEntry, Hypothesis, AncestorWithContext } from '@/types/database'

interface ProfileWithKeys {
  subscription_tier: SubscriptionTier
  ai_provider?: string
  anthropic_api_key?: string
  openai_api_key?: string
  google_api_key?: string
  use_own_api_key?: boolean
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch profile with API keys
    const { data: profileData } = await supabase
      .from('profiles')
      .select('subscription_tier, ai_provider, anthropic_api_key, openai_api_key, google_api_key, use_own_api_key')
      .eq('id', user.id)
      .single()

    const profile = profileData as ProfileWithKeys | null

    // Check subscription tier
    if (!canAccessAdvancedAi(profile?.subscription_tier || 'free')) {
      return NextResponse.json(
        { error: 'Upgrade to Investigator to access AI research' },
        { status: 403 }
      )
    }

    // Check if user has BYOK enabled
    const aiConfig = getAIConfig(profile)
    if (aiConfig.usePlatformKey) {
      return NextResponse.json(
        { error: 'Agent research requires your own API key. Add your API key in Settings.' },
        { status: 403 }
      )
    }

    const { ancestorId, researchGoal } = await request.json()

    // Fetch ancestor with all context
    const { data: ancestorData, error: ancestorError } = await supabase
      .from('ancestors')
      .select('*')
      .eq('id', ancestorId)
      .single()

    if (ancestorError || !ancestorData) {
      return NextResponse.json({ error: 'Ancestor not found' }, { status: 404 })
    }

    const ancestor = ancestorData as unknown as Ancestor

    // Fetch related data
    const dataClient = await createClient()
    const [
      factsResult,
      goalsResult,
      sourcesResult,
      logResult,
      hypothesesResult,
    ] = await Promise.all([
      dataClient.from('facts').select('*').eq('ancestor_id', ancestorId),
      dataClient.from('research_goals').select('*').eq('ancestor_id', ancestorId),
      dataClient.from('sources_checked').select('*').eq('ancestor_id', ancestorId),
      dataClient.from('research_log').select('*').eq('ancestor_id', ancestorId).limit(20),
      dataClient.from('hypotheses').select('*').eq('ancestor_id', ancestorId),
    ])

    const facts = factsResult.data as Fact[] || []
    const research_goals = goalsResult.data as ResearchGoal[] || []
    const sources_checked = sourcesResult.data as SourceChecked[] || []
    const research_log = logResult.data as ResearchLogEntry[] || []
    const hypotheses = hypothesesResult.data as Hypothesis[] || []

    const ancestorWithContext: AncestorWithContext = {
      ...ancestor,
      facts,
      research_goals,
      sources_checked,
      research_log,
      hypotheses,
    }

    // Build the agent research prompt
    const prompt = buildAgentResearchPrompt(ancestorWithContext, researchGoal)

    // Call AI
    const result = await createCompletion(aiConfig, {
      system: `You are an expert genealogist conducting research. You will analyze the provided information about an ancestor and generate structured research findings that can be directly added to a genealogy database.

Your responses must be in valid JSON format. Be thorough but only include information that is well-supported or clearly marked as a hypothesis requiring verification.`,
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 4096,
    })

    // Parse JSON response
    const jsonMatch = result.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Failed to parse AI response')
    }

    const researchData = JSON.parse(jsonMatch[0])

    // Save the research findings to the database
    const saveClient = await createClient()
    const savedItems: {
      facts: string[]
      sources: string[]
      hypotheses: string[]
      logEntry: string | null
    } = {
      facts: [],
      sources: [],
      hypotheses: [],
      logEntry: null,
    }

    // Save new facts
    if (researchData.facts && researchData.facts.length > 0) {
      for (const fact of researchData.facts) {
        const { error } = await saveClient.from('facts').insert({
          ancestor_id: ancestorId,
          fact_type: fact.type || 'custom',
          fact_value: fact.value,
          fact_date: fact.date || null,
          fact_place: fact.place || null,
          confidence: fact.confidence || 'possible',
          notes: fact.notes || 'Added by AI agent research',
        })
        if (!error) {
          savedItems.facts.push(fact.value)
        }
      }
    }

    // Save sources checked
    if (researchData.sources && researchData.sources.length > 0) {
      for (const source of researchData.sources) {
        const { error } = await saveClient.from('sources_checked').insert({
          ancestor_id: ancestorId,
          source_name: source.name,
          source_type: source.type || 'other',
          repository: source.repository || null,
          outcome: source.outcome || 'partial_info',
          findings: source.findings || null,
          source_url: source.url || null,
        })
        if (!error) {
          savedItems.sources.push(source.name)
        }
      }
    }

    // Save hypotheses
    if (researchData.hypotheses && researchData.hypotheses.length > 0) {
      for (const hyp of researchData.hypotheses) {
        const { error } = await saveClient.from('hypotheses').insert({
          ancestor_id: ancestorId,
          hypothesis_text: hyp.text,
          status: 'testing',
          confidence_score: hyp.confidence || null,
          notes: hyp.rationale || 'Generated by AI agent research',
        })
        if (!error) {
          savedItems.hypotheses.push(hyp.text)
        }
      }
    }

    // Add research log entry
    const logEntry = `AI Agent Research Session:\n\n${researchData.summary || 'Completed research analysis.'}\n\nFindings added:\n- ${savedItems.facts.length} new facts\n- ${savedItems.sources.length} sources documented\n- ${savedItems.hypotheses.length} hypotheses generated`

    const { error: logError } = await saveClient.from('research_log').insert({
      ancestor_id: ancestorId,
      entry_text: logEntry,
      session_minutes: 5,
    })

    if (!logError) {
      savedItems.logEntry = logEntry
    }

    return NextResponse.json({
      success: true,
      summary: researchData.summary,
      saved: savedItems,
      nextSteps: researchData.nextSteps || [],
    })
  } catch (error) {
    console.error('AI agent research error:', error)
    return NextResponse.json(
      { error: 'Failed to complete agent research' },
      { status: 500 }
    )
  }
}

function buildAgentResearchPrompt(ancestor: AncestorWithContext, researchGoal?: string): string {
  const birthYear = ancestor.birth_date ? parseInt(ancestor.birth_date.match(/\d{4}/)?.[0] || '0') : 0

  return `Conduct genealogical research analysis for this ancestor and generate findings that can be added to their research file.

## Ancestor Profile

**Name:** ${ancestor.given_names || ''} ${ancestor.surname || ''}${ancestor.maiden_name ? ` (nee ${ancestor.maiden_name})` : ''}
**Birth:** ${ancestor.birth_date || 'Unknown'}${ancestor.birth_place ? ` in ${ancestor.birth_place}` : ''}
**Death:** ${ancestor.death_date || 'Unknown'}${ancestor.death_place ? ` in ${ancestor.death_place}` : ''}
**Gender:** ${ancestor.gender || 'Unknown'}

## Currently Known Facts
${ancestor.facts.length > 0 ? ancestor.facts.map(f => `- ${f.fact_type}: ${f.fact_value}${f.fact_date ? ` (${f.fact_date})` : ''} [${f.confidence}]`).join('\n') : 'No facts recorded yet'}

## Sources Already Checked
${ancestor.sources_checked.length > 0 ? ancestor.sources_checked.map(s => `- ${s.source_name}: ${s.outcome}`).join('\n') : 'No sources checked yet'}

## Current Hypotheses
${ancestor.hypotheses.length > 0 ? ancestor.hypotheses.map(h => `- ${h.hypothesis_text} [${h.status}]`).join('\n') : 'No hypotheses yet'}

## Research Goal
${researchGoal || 'General research to expand knowledge about this ancestor'}

## Your Task

Based on the available information, generate research findings. You should:

1. **Infer likely facts** based on time period, location, and context (marked with appropriate confidence levels)
2. **Suggest sources** that should be checked based on the ancestor's profile
3. **Generate hypotheses** that could explain gaps in the record
4. **Provide a summary** of your analysis

Only include information that is:
- Logically derivable from existing facts
- Historically appropriate for the time period and location
- Clearly marked with confidence levels

Respond in this JSON format:
{
  "summary": "Brief summary of your research analysis and key insights",
  "facts": [
    {
      "type": "residence|occupation|military|education|religion|custom",
      "value": "The fact value (e.g., 'Farmer in Hamilton County')",
      "date": "Approximate date if known",
      "place": "Location if applicable",
      "confidence": "certain|probable|possible|uncertain",
      "notes": "Why you inferred this fact"
    }
  ],
  "sources": [
    {
      "name": "Specific source name",
      "type": "census|vital|church|military|land|probate|newspaper|immigration|other",
      "repository": "Where to find it",
      "outcome": "found_record|nothing_found|partial_info|need_to_revisit",
      "findings": "What was or might be found",
      "url": "URL if applicable"
    }
  ],
  "hypotheses": [
    {
      "text": "The hypothesis statement",
      "confidence": 50,
      "rationale": "Why this hypothesis makes sense"
    }
  ],
  "nextSteps": [
    "Recommended next research actions"
  ]
}`
}
