import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { buildHypothesisScorerPrompt } from '@/lib/ai/prompts'
import { canAccessAdvancedAi } from '@/lib/subscription-limits'
import type { SubscriptionTier, Hypothesis, Evidence, Ancestor, HypothesisUpdate } from '@/types/database'

interface HypothesisWithEvidence extends Hypothesis {
  evidence: Evidence[]
}

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
        { error: 'Upgrade to Investigator to access hypothesis analysis' },
        { status: 403 }
      )
    }

    const { hypothesisId } = await request.json()

    // Fetch hypothesis with evidence
    const { data: hypothesisData, error: hypothesisError } = await supabase
      .from('hypotheses')
      .select('*, evidence(*)')
      .eq('id', hypothesisId)
      .single()

    if (hypothesisError || !hypothesisData) {
      return NextResponse.json({ error: 'Hypothesis not found' }, { status: 404 })
    }

    const hypothesis = hypothesisData as unknown as HypothesisWithEvidence

    // Fetch ancestor
    const { data: ancestorData, error: ancestorError } = await supabase
      .from('ancestors')
      .select('*')
      .eq('id', hypothesis.ancestor_id)
      .single()

    if (ancestorError || !ancestorData) {
      return NextResponse.json({ error: 'Ancestor not found' }, { status: 404 })
    }

    const ancestor = ancestorData as unknown as Ancestor

    const prompt = buildHypothesisScorerPrompt(
      { ...hypothesis, evidence: hypothesis.evidence || [] },
      ancestor
    )

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
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

    // Update hypothesis with AI analysis and score
    const updateData = {
      confidence_score: analysis.confidence_score,
      ai_analysis: JSON.stringify(analysis),
    }

    // Create fresh client for update to avoid TypeScript narrowing issues
    const updateClient = await createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (updateClient as any)
      .from('hypotheses')
      .update(updateData)
      .eq('id', hypothesisId)

    return NextResponse.json({ analysis })
  } catch (error) {
    console.error('AI hypothesis analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze hypothesis' },
      { status: 500 }
    )
  }
}
