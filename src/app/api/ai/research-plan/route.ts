import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { buildResearchPlanPrompt } from '@/lib/ai/prompts'
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
        { error: 'Upgrade to Investigator to access AI research plans' },
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

    // Fetch related data using fresh client
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
      dataClient.from('research_log').select('*').eq('ancestor_id', ancestorId).limit(10),
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

    const prompt = buildResearchPlanPrompt(ancestorWithContext)

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

    const planData = JSON.parse(jsonMatch[0])

    // Save the plan using fresh client
    const saveClient = await createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (saveClient as any)
      .from('research_plans')
      .update({ is_current: false })
      .eq('ancestor_id', ancestorId)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: savedPlan, error: saveError } = await (saveClient as any)
      .from('research_plans')
      .insert({
        ancestor_id: ancestorId,
        plan_json: planData,
        is_current: true,
      })
      .select()
      .single()

    if (saveError) {
      console.error('Failed to save plan:', saveError)
    }

    return NextResponse.json({ plan: planData, planId: savedPlan?.id })
  } catch (error) {
    console.error('AI research plan error:', error)
    return NextResponse.json(
      { error: 'Failed to generate research plan' },
      { status: 500 }
    )
  }
}
