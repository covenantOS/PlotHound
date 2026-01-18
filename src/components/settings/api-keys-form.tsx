'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/components/ui/use-toast'
import { Key, Eye, EyeOff, Loader2 } from 'lucide-react'

type AIProvider = 'anthropic' | 'openai' | 'google'

interface APIKeysFormProps {
  initialData: {
    ai_provider: AIProvider
    anthropic_api_key: string | null
    openai_api_key: string | null
    google_api_key: string | null
    use_own_api_key: boolean
  }
}

export function APIKeysForm({ initialData }: APIKeysFormProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [showKeys, setShowKeys] = useState({
    anthropic: false,
    openai: false,
    google: false,
  })

  const [formData, setFormData] = useState({
    aiProvider: initialData.ai_provider || 'anthropic',
    anthropicKey: initialData.anthropic_api_key || '',
    openaiKey: initialData.openai_api_key || '',
    googleKey: initialData.google_api_key || '',
    useOwnKey: initialData.use_own_api_key || false,
  })

  const maskKey = (key: string) => {
    if (!key) return ''
    if (key.length <= 8) return '****'
    return key.substring(0, 4) + '****' + key.substring(key.length - 4)
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/user/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ai_provider: formData.aiProvider,
          anthropic_api_key: formData.anthropicKey || null,
          openai_api_key: formData.openaiKey || null,
          google_api_key: formData.googleKey || null,
          use_own_api_key: formData.useOwnKey,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save API keys')
      }

      toast({
        title: 'API keys saved',
        description: 'Your AI provider settings have been updated.',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save API keys',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          AI API Keys (BYOK)
        </CardTitle>
        <CardDescription>
          Use your own API keys for AI features to avoid rate limits and manage your own usage.
          Your keys are stored securely and never shared.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="use-own-key" className="text-base font-medium">
              Use my own API key
            </Label>
            <p className="text-sm text-muted-foreground">
              When enabled, AI features will use your personal API key instead of the platform key.
            </p>
          </div>
          <Switch
            id="use-own-key"
            checked={formData.useOwnKey}
            onCheckedChange={(checked) => setFormData({ ...formData, useOwnKey: checked })}
          />
        </div>

        {formData.useOwnKey && (
          <>
            <div className="space-y-3">
              <Label className="text-base font-medium">AI Provider</Label>
              <RadioGroup
                value={formData.aiProvider}
                onValueChange={(value: AIProvider) => setFormData({ ...formData, aiProvider: value })}
                className="flex flex-wrap gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="anthropic" id="anthropic" />
                  <Label htmlFor="anthropic" className="cursor-pointer">Claude (Anthropic)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="openai" id="openai" />
                  <Label htmlFor="openai" className="cursor-pointer">GPT (OpenAI)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="google" id="google" />
                  <Label htmlFor="google" className="cursor-pointer">Gemini (Google)</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-4 pt-2">
              {/* Anthropic API Key */}
              <div className="space-y-2">
                <Label htmlFor="anthropic-key">
                  Anthropic API Key
                  {formData.aiProvider === 'anthropic' && (
                    <span className="ml-2 text-xs text-primary">(active)</span>
                  )}
                </Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="anthropic-key"
                      type={showKeys.anthropic ? 'text' : 'password'}
                      value={formData.anthropicKey}
                      onChange={(e) => setFormData({ ...formData, anthropicKey: e.target.value })}
                      placeholder="sk-ant-..."
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowKeys({ ...showKeys, anthropic: !showKeys.anthropic })}
                    >
                      {showKeys.anthropic ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Get your API key from{' '}
                  <a
                    href="https://console.anthropic.com/settings/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    console.anthropic.com
                  </a>
                </p>
              </div>

              {/* OpenAI API Key */}
              <div className="space-y-2">
                <Label htmlFor="openai-key">
                  OpenAI API Key
                  {formData.aiProvider === 'openai' && (
                    <span className="ml-2 text-xs text-primary">(active)</span>
                  )}
                </Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="openai-key"
                      type={showKeys.openai ? 'text' : 'password'}
                      value={formData.openaiKey}
                      onChange={(e) => setFormData({ ...formData, openaiKey: e.target.value })}
                      placeholder="sk-..."
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowKeys({ ...showKeys, openai: !showKeys.openai })}
                    >
                      {showKeys.openai ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Get your API key from{' '}
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    platform.openai.com
                  </a>
                </p>
              </div>

              {/* Google API Key */}
              <div className="space-y-2">
                <Label htmlFor="google-key">
                  Google AI API Key
                  {formData.aiProvider === 'google' && (
                    <span className="ml-2 text-xs text-primary">(active)</span>
                  )}
                </Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="google-key"
                      type={showKeys.google ? 'text' : 'password'}
                      value={formData.googleKey}
                      onChange={(e) => setFormData({ ...formData, googleKey: e.target.value })}
                      placeholder="AI..."
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowKeys({ ...showKeys, google: !showKeys.google })}
                    >
                      {showKeys.google ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Get your API key from{' '}
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    aistudio.google.com
                  </a>
                </p>
              </div>
            </div>
          </>
        )}

        <Button onClick={handleSave} disabled={loading} className="w-full sm:w-auto">
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save API Settings
        </Button>

        {!formData.useOwnKey && (
          <p className="text-sm text-muted-foreground">
            AI features are currently using the platform API key. Enable &quot;Use my own API key&quot;
            to use your personal keys and avoid shared rate limits.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
