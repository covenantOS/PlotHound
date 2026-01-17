import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { buildBrickWallPrompt } from '@/lib/ai/prompts'
import { canAccessAdvancedAi } from '@/lib/subscription-limits'
import type { SubscriptionTier, Ancestor, Fact, ResearchGoal, SourceChecked, ResearchLogEntry, Hypothesis, AncestorWithContext } from '@/types/database'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check subscription tier
    const { data: profileData } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', user.id)
      .single()

    const profile = profileData as { subscription_tier: SubscriptionTier } | null

    if (!canAccessAdvancedAi(profile?.subscription_tier || 'free')) {
      return NextResponse.json(
        { error: 'Upgrade to Investigator to access brick wall analysis' },
        { status: 403 }
      )
    }

    const { ancestorId } = await request.json()

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

    if (!ancestor.is_brick_wall) {
      return NextResponse.json(
        { error: 'This ancestor is not marked as a brick wall' },
        { status: 400 }
      )
    }

    // Fetch related data using fresh clients to avoid TypeScript narrowing issues
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
      dataClient.from('research_log').select('*').eq('ancestor_id', ancestorId).order('log_date', { ascending: false }).limit(10),
      dataClient.from('hypotheses').select('*').eq('ancestor_id', ancestorId),
    ])

    const facts = factsResult.data as Fact[] | null
    const research_goals = goalsResult.data as ResearchGoal[] | null
    const sources_checked = sourcesResult.data as SourceChecked[] | null
    const research_log = logResult.data as ResearchLogEntry[] | null
    const hypotheses = hypothesesResult.data as Hypothesis[] | null

    const ancestorWithContext: AncestorWithContext = {
      ...ancestor,
      facts: facts || [],
      research_goals: research_goals || [],
      sources_checked: sources_checked || [],
      research_log: research_log || [],
      hypotheses: hypotheses || [],
    }

    const prompt = buildBrickWallPrompt(ancestorWithContext)

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Failed to parse AI response')
    }

    const analysis = JSON.parse(jsonMatch[0])

    return NextResponse.json({ analysis })
  } catch (error) {
    console.error('AI brick wall analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze brick wall' },
      { status: 500 }
    )
  }
}
