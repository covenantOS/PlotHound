import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      ai_provider,
      anthropic_api_key,
      openai_api_key,
      google_api_key,
      use_own_api_key,
    } = body

    // Validate ai_provider
    if (ai_provider && !['anthropic', 'openai', 'google'].includes(ai_provider)) {
      return NextResponse.json({ error: 'Invalid AI provider' }, { status: 400 })
    }

    // Basic validation for API key formats
    if (anthropic_api_key && !anthropic_api_key.startsWith('sk-ant-')) {
      return NextResponse.json({
        error: 'Invalid Anthropic API key format. Should start with sk-ant-'
      }, { status: 400 })
    }

    if (openai_api_key && !openai_api_key.startsWith('sk-')) {
      return NextResponse.json({
        error: 'Invalid OpenAI API key format. Should start with sk-'
      }, { status: 400 })
    }

    // Update profile with API keys
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('profiles')
      .update({
        ai_provider: ai_provider || 'anthropic',
        anthropic_api_key: anthropic_api_key || null,
        openai_api_key: openai_api_key || null,
        google_api_key: google_api_key || null,
        use_own_api_key: use_own_api_key || false,
      })
      .eq('id', user.id)

    if (error) {
      console.error('Failed to update API keys:', error)
      return NextResponse.json({ error: 'Failed to save API keys' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('API keys update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('ai_provider, anthropic_api_key, openai_api_key, google_api_key, use_own_api_key')
      .eq('id', user.id)
      .single()

    if (error) {
      console.error('Failed to fetch API keys:', error)
      return NextResponse.json({ error: 'Failed to fetch API keys' }, { status: 500 })
    }

    // Mask API keys for security - only show first 4 and last 4 characters
    const maskKey = (key: string | null) => {
      if (!key) return null
      if (key.length <= 8) return '****'
      return key.substring(0, 4) + '****' + key.substring(key.length - 4)
    }

    return NextResponse.json({
      ai_provider: profile?.ai_provider || 'anthropic',
      anthropic_api_key: maskKey(profile?.anthropic_api_key),
      openai_api_key: maskKey(profile?.openai_api_key),
      google_api_key: maskKey(profile?.google_api_key),
      use_own_api_key: profile?.use_own_api_key || false,
      // Include a flag to indicate if each key is set
      has_anthropic_key: !!profile?.anthropic_api_key,
      has_openai_key: !!profile?.openai_api_key,
      has_google_key: !!profile?.google_api_key,
    })
  } catch (error) {
    console.error('API keys fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
