import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dog,
  Search,
  BrickWall,
  Lightbulb,
  Sparkles,
  BookOpen,
  Target,
  ArrowRight,
  Check,
} from 'lucide-react'

const features = [
  {
    icon: Search,
    title: 'Track What You Tried',
    description:
      'Never repeat a search. Log every source you check, whether you found something or not.',
  },
  {
    icon: BrickWall,
    title: 'Break Through Brick Walls',
    description:
      'Mark stuck ancestors and get AI-powered suggestions for fresh approaches.',
  },
  {
    icon: Lightbulb,
    title: 'Test Your Theories',
    description:
      'Document hypotheses, weigh evidence for and against, and track confidence scores.',
  },
  {
    icon: Target,
    title: 'Set Research Goals',
    description:
      'Define what you are looking for and check them off as you make progress.',
  },
  {
    icon: BookOpen,
    title: 'Research Journal',
    description:
      'Keep a chronological log of your research sessions and discoveries.',
  },
  {
    icon: Sparkles,
    title: 'AI Research Planner',
    description:
      'Get personalized research plans based on what you know and what you have tried.',
  },
]

const plans = [
  {
    name: 'Free',
    price: 0,
    description: 'Get started with basic research tracking',
    features: ['1 family tree', '10 ancestors', '100MB storage', 'Basic tracking'],
  },
  {
    name: 'Researcher',
    price: 10,
    description: 'For active genealogists',
    features: [
      'Unlimited trees & ancestors',
      '1GB storage',
      'AI-powered summaries',
      'Export your research',
    ],
    popular: false,
  },
  {
    name: 'Investigator',
    price: 25,
    description: 'Advanced AI research tools',
    features: [
      'Everything in Researcher',
      '5GB storage',
      'AI Research Planner',
      'Hypothesis scoring',
      'Brick wall analyzer',
    ],
    popular: true,
  },
  {
    name: 'Professional',
    price: 99,
    description: 'For serious researchers',
    features: [
      'Everything in Investigator',
      'Unlimited storage',
      'Priority support',
      'API access (soon)',
    ],
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Dog className="h-8 w-8 text-primary" />
            <span className="font-serif text-2xl font-bold">PlotHound</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/login">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center max-w-3xl">
          <h1 className="font-serif text-4xl md:text-5xl font-bold mb-6">
            Ancestry stores records.
            <br />
            <span className="text-primary">PlotHound runs your research.</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            A research operations tool for genealogists. Track what you have tried,
            organize your findings, and break through brick walls with AI-powered suggestions.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/login">
              <Button size="lg" className="text-lg px-8">
                Start Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="#features">
              <Button size="lg" variant="outline" className="text-lg px-8">
                See Features
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Value Proposition */}
      <section className="py-16 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-primary mb-2">Stop</div>
              <p className="text-muted-foreground">
                searching the same sources twice
              </p>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">Track</div>
              <p className="text-muted-foreground">
                every hypothesis and piece of evidence
              </p>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">Break</div>
              <p className="text-muted-foreground">
                through brick walls with AI insights
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4">
        <div className="container mx-auto">
          <h2 className="font-serif text-3xl font-bold text-center mb-12">
            Built for How Genealogists Actually Work
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <Card key={feature.title}>
                <CardHeader>
                  <feature.icon className="h-10 w-10 text-primary mb-2" />
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* AI Section */}
      <section className="py-20 px-4 bg-gradient-to-r from-primary/5 to-accent/5">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <Sparkles className="h-12 w-12 text-primary mx-auto mb-4" />
            <h2 className="font-serif text-3xl font-bold mb-4">
              AI-Powered Research Assistant
            </h2>
            <p className="text-xl text-muted-foreground">
              Let AI analyze your research and suggest next steps
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <CardTitle>Research Planner</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Based on what you know and what you have tried, get a prioritized list
                  of sources to check next, with likelihood scores and specific tips.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Brick Wall Breaker</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Stuck on an ancestor? Get fresh approaches you might not have considered,
                  including cluster research strategies and name variation suggestions.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Hypothesis Scorer</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Add evidence for and against your theories, and let AI calculate
                  confidence scores and identify what would change them.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Research Summaries</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Generate clear summaries of what you know about each ancestor,
                  perfect for sharing or remembering where you left off.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-4">
        <div className="container mx-auto">
          <h2 className="font-serif text-3xl font-bold text-center mb-4">
            Simple Pricing
          </h2>
          <p className="text-center text-muted-foreground mb-12">
            Start free. Upgrade when you need more.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={plan.popular ? 'border-primary ring-1 ring-primary' : ''}
              >
                <CardHeader>
                  {plan.popular && (
                    <div className="text-xs font-medium text-primary mb-2">
                      MOST POPULAR
                    </div>
                  )}
                  <CardTitle>{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="pt-4">
                    <span className="text-3xl font-bold">${plan.price}</span>
                    {plan.price > 0 && (
                      <span className="text-muted-foreground">/mo</span>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Link href="/login" className="block mt-6">
                    <Button
                      className="w-full"
                      variant={plan.popular ? 'default' : 'outline'}
                    >
                      {plan.price === 0 ? 'Start Free' : 'Get Started'}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-primary text-primary-foreground">
        <div className="container mx-auto text-center max-w-2xl">
          <h2 className="font-serif text-3xl font-bold mb-4">
            Ready to organize your research?
          </h2>
          <p className="text-lg opacity-90 mb-8">
            Join genealogists who use PlotHound to track their work and break through
            brick walls.
          </p>
          <Link href="/login">
            <Button size="lg" variant="secondary" className="text-lg px-8">
              Get Started Free
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Dog className="h-6 w-6 text-primary" />
              <span className="font-serif text-lg font-bold">PlotHound</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="/terms" className="hover:text-foreground">
                Terms
              </Link>
              <Link href="/privacy" className="hover:text-foreground">
                Privacy
              </Link>
              <a href="mailto:support@plothound.com" className="hover:text-foreground">
                Contact
              </a>
            </div>
            <p className="text-sm text-muted-foreground">
              2024 PlotHound. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
