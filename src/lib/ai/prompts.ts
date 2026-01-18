import type { AncestorWithContext, HypothesisWithEvidence, Ancestor } from '@/types/database'

export function buildResearchPlanPrompt(ancestor: AncestorWithContext): string {
  // Calculate timeframe for the ancestor
  const birthYear = ancestor.birth_date ? parseInt(ancestor.birth_date.match(/\d{4}/)?.[0] || '0') : 0
  const deathYear = ancestor.death_date ? parseInt(ancestor.death_date.match(/\d{4}/)?.[0] || '0') : 0
  const lifespan = birthYear && deathYear ? `${birthYear}-${deathYear}` : birthYear ? `born ${birthYear}` : ''
  const currentYear = new Date().getFullYear()

  // Determine if the person could have living relatives
  const couldHaveLivingSpouse = !deathYear || (deathYear > currentYear - 50)
  const couldHaveLivingChildren = birthYear > 1920 || (!birthYear && !deathYear)
  const couldHaveLivingGrandchildren = birthYear > 1880 || (!birthYear && !deathYear)
  const personMightBeLiving = !deathYear && birthYear && birthYear > currentYear - 110

  // Group facts by type for clearer analysis
  const factsByType = ancestor.facts.reduce((acc, f) => {
    acc[f.fact_type] = acc[f.fact_type] || []
    acc[f.fact_type].push(f)
    return acc
  }, {} as Record<string, typeof ancestor.facts>)

  // Identify what's already been found vs not found in sources
  const sourcesWithRecords = ancestor.sources_checked.filter(s => s.outcome === 'found_record')
  const sourcesWithNothing = ancestor.sources_checked.filter(s => s.outcome === 'nothing_found')
  const sourcesToRevisit = ancestor.sources_checked.filter(s => s.outcome === 'need_to_revisit')

  return `You are an expert genealogist creating a HIGHLY CONTEXTUAL research plan. Your recommendations must be directly informed by what is already known and what has already been tried.

## Ancestor Profile

**Name:** ${ancestor.given_names || ''} ${ancestor.surname || ''}${ancestor.maiden_name ? ` (nee ${ancestor.maiden_name})` : ''}
**Gender:** ${ancestor.gender || 'Unknown'}
**Lifespan:** ${lifespan || 'Unknown dates'}
**Birth:** ${ancestor.birth_date || 'Unknown'}${ancestor.birth_place ? ` in ${ancestor.birth_place}` : ''}
**Death:** ${ancestor.death_date || 'Unknown'}${ancestor.death_place ? ` in ${ancestor.death_place}` : ''}
${ancestor.is_brick_wall ? `\n**⚠️ BRICK WALL:** ${ancestor.brick_wall_notes || 'No notes on why stuck'}` : ''}

## What We Already Know (Facts by Category)
${Object.entries(factsByType).map(([type, facts]) =>
  `### ${type.charAt(0).toUpperCase() + type.slice(1)}\n${facts.map(f =>
    `- ${f.fact_value}${f.fact_date ? ` (${f.fact_date})` : ''}${f.fact_place ? ` at ${f.fact_place}` : ''} [Confidence: ${f.confidence}]${f.notes ? ` — Note: ${f.notes}` : ''}`
  ).join('\n')}`
).join('\n\n') || 'No facts recorded yet - this is a fresh research subject'}

## Active Research Goals
${ancestor.research_goals.filter(g => g.status === 'active').map(g => `- ${g.goal_text}${g.notes ? ` (${g.notes})` : ''}`).join('\n') || 'No specific goals set - suggest appropriate research goals'}

## Working Hypotheses
${ancestor.hypotheses.filter(h => h.status === 'testing').map(h =>
  `- "${h.hypothesis_text}" [${h.status}]${h.confidence_score ? ` — Confidence: ${h.confidence_score}%` : ''}`
).join('\n') || 'No hypotheses being tested'}

## Research History - Sources Already Checked
${sourcesWithRecords.length > 0 ? `### ✓ Found Records In:\n${sourcesWithRecords.map(s => `- ${s.source_name} (${s.repository || '?'}): "${s.findings}"`).join('\n')}` : ''}
${sourcesWithNothing.length > 0 ? `### ✗ Checked But Found Nothing:\n${sourcesWithNothing.map(s => `- ${s.source_name} (${s.repository || '?'})${s.findings ? ` — Note: ${s.findings}` : ''}`).join('\n')}` : ''}
${sourcesToRevisit.length > 0 ? `### ⟲ Need to Revisit:\n${sourcesToRevisit.map(s => `- ${s.source_name}: ${s.findings || 'No notes'}`).join('\n')}` : ''}
${ancestor.sources_checked.length === 0 ? 'No sources have been checked yet' : ''}

## Recent Research Activity Log
${ancestor.research_log.length > 0 ? ancestor.research_log.slice(0, 8).map(l => `- [${new Date(l.log_date).toLocaleDateString()}] ${l.entry_text}`).join('\n') : 'No research log entries'}

## Living Relatives - IMPORTANT CONTEXT
${personMightBeLiving ? `⚠️ **THIS PERSON MAY STILL BE LIVING** (born ${birthYear}, no death date recorded). Be sensitive about privacy.` : ''}
${couldHaveLivingSpouse ? `- **Spouse may be living** - A spouse or partner could provide direct memories, photos, documents, and family stories.` : ''}
${couldHaveLivingChildren ? `- **Children likely living** - Direct descendants are often the BEST source of information about parents. They may have birth certificates, marriage records, photos, family bibles, and personal knowledge.` : ''}
${couldHaveLivingGrandchildren ? `- **Grandchildren could be living** - Even if children have passed, grandchildren often have inherited documents and photos.` : ''}
${!couldHaveLivingSpouse && !couldHaveLivingChildren && !couldHaveLivingGrandchildren ? '- This person lived long enough ago that direct living relatives are unlikely.' : ''}

## Your Contextual Research Plan

CRITICAL: Your recommendations MUST:
1. **Build on what's known** - Use the birth year (${birthYear || '?'}), locations (${[ancestor.birth_place, ancestor.death_place].filter(Boolean).join(', ') || 'unknown'}), and existing facts to suggest SPECIFIC records
2. **Avoid what's been tried** - Do NOT suggest sources listed in "Checked But Found Nothing" unless you explain why to retry with a different strategy
3. **Address the goals** - Directly address the active research goals listed above
4. **Support hypotheses** - Suggest records that could prove or disprove the working hypotheses
5. **Be location-specific** - Reference the actual places: ${[ancestor.birth_place, ancestor.death_place].filter(Boolean).join(', ') || 'locations TBD'}
6. **CONTACT LIVING RELATIVES FIRST** - If the "Living Relatives" section above indicates living relatives exist, your TOP recommendation should be to find and contact them. Living relatives are the single best source of information for recent ancestors.

Generate a research plan with 5-8 specific next steps:

Respond in this JSON format:
{
  "summary": "Contextual overview acknowledging what we know, what we've tried, and the strategy moving forward",
  "steps": [
    {
      "priority": 1,
      "source_name": "Specific source (e.g., '${birthYear ? birthYear + ' Federal Census, ' : ''}${ancestor.birth_place || '[County], [State]'}')",
      "source_type": "living_relatives|census|vital|church|military|land|probate|newspaper|immigration|dna|social_media|other",
      "repository": "Where to find it (Ancestry, FamilySearch, specific archive)",
      "rationale": "How this connects to the known facts and goals - be specific!",
      "likelihood": "low|medium|high|very_high",
      "likelihood_percent": 45,
      "estimated_minutes": 30,
      "url": "https://..." or null,
      "tips": "Search tips based on name variations, location changes, etc."
    }
  ],
  "alternative_approaches": [
    "Cluster research through siblings...",
    "DNA approach if applicable..."
  ]
}`
}

export function buildHypothesisScorerPrompt(
  hypothesis: HypothesisWithEvidence,
  ancestor: Ancestor
): string {
  return `You are an expert genealogist evaluating a research hypothesis. Analyze the evidence and calculate a confidence score.

## Hypothesis
"${hypothesis.hypothesis_text}"

## Regarding Ancestor
${ancestor.given_names || ''} ${ancestor.surname || ''} (${ancestor.birth_date || '?'} - ${ancestor.death_date || '?'})

## Evidence Supporting This Hypothesis
${hypothesis.evidence.filter(e => e.evidence_type === 'supports').map(e =>
  `- [Weight: ${e.weight}/10] ${e.evidence_text}${e.source_citation ? ` (Source: ${e.source_citation})` : ''}`
).join('\n') || 'None provided'}

## Evidence Against This Hypothesis
${hypothesis.evidence.filter(e => e.evidence_type === 'contradicts').map(e =>
  `- [Weight: ${e.weight}/10] ${e.evidence_text}${e.source_citation ? ` (Source: ${e.source_citation})` : ''}`
).join('\n') || 'None provided'}

## Neutral/Contextual Evidence
${hypothesis.evidence.filter(e => e.evidence_type === 'neutral').map(e =>
  `- ${e.evidence_text}`
).join('\n') || 'None provided'}

## Your Task

1. Evaluate each piece of evidence for genealogical reliability
2. Consider how the evidence interacts (does supporting evidence outweigh contradictions?)
3. Calculate an overall confidence score (0-100)
4. Identify what additional evidence would most change the score

Respond in this JSON format:
{
  "confidence_score": 65,
  "confidence_label": "Moderate - Probable but needs verification",
  "analysis": "Detailed explanation of your reasoning...",
  "key_factors": [
    {"factor": "Matching names and dates", "impact": "+25%"},
    {"factor": "Conflicting birthplace information", "impact": "-15%"}
  ],
  "tie_breakers": [
    "Finding church baptism records for the children would confirm parentage",
    "Locating a will or probate record might clarify the relationship"
  ],
  "risk_assessment": "What could make this hypothesis wrong"
}`
}

export function buildBrickWallPrompt(ancestor: AncestorWithContext): string {
  return `You are an expert genealogist who specializes in breaking through brick walls. A researcher is stuck on this ancestor and needs fresh approaches.

## The Brick Wall Ancestor

**Name:** ${ancestor.given_names || ''} ${ancestor.surname || ''}${ancestor.maiden_name ? ` (nee ${ancestor.maiden_name})` : ''}
**Birth:** ${ancestor.birth_date || 'Unknown'}${ancestor.birth_place ? ` in ${ancestor.birth_place}` : ''}
**Death:** ${ancestor.death_date || 'Unknown'}${ancestor.death_place ? ` in ${ancestor.death_place}` : ''}

**Researcher's Notes on Why They're Stuck:**
${ancestor.brick_wall_notes || 'No specific notes provided'}

## Everything Known About This Person
${ancestor.facts.length > 0 ? ancestor.facts.map(f => `- ${f.fact_type}: ${f.fact_value}${f.fact_date ? ` (${f.fact_date})` : ''}${f.fact_place ? ` at ${f.fact_place}` : ''}`).join('\n') : 'Very little is known'}

## Research Goals (What They're Trying to Find)
${ancestor.research_goals.map(g => `- ${g.goal_text} [${g.status}]`).join('\n') || 'No specific goals'}

## Sources Already Exhausted
${ancestor.sources_checked.length > 0 ? ancestor.sources_checked.map(s => `- ${s.source_name} (${s.outcome}): ${s.findings || 'No findings'}`).join('\n') : 'No sources logged'}

## Research Log (Recent Efforts)
${ancestor.research_log.slice(0, 10).map(l => `- [${new Date(l.log_date).toLocaleDateString()}] ${l.entry_text}`).join('\n') || 'No log entries'}

## Your Task

Analyze this brick wall and suggest NEW approaches the researcher likely hasn't tried. Think creatively:

1. **Cluster analysis**: Can we approach through relatives instead of directly?
2. **FAN club method**: Friends, Associates, Neighbors who might appear in records with this person
3. **Record substitutes**: If the obvious record doesn't exist, what else might capture the same information?
4. **Geographic deep-dive**: What records specific to this exact location/time might exist?
5. **DNA angles**: How might DNA matches help?
6. **Name variations**: Could spelling changes, translations, or nicknames be hiding records?

Respond in JSON format:
{
  "diagnosis": "Why this brick wall exists (missing records? wrong location? name changes?)",
  "fresh_approaches": [
    {
      "approach": "Name of the approach",
      "description": "Detailed explanation",
      "specific_actions": ["Step 1", "Step 2"],
      "likelihood_of_breakthrough": "low|medium|high",
      "why_not_tried": "Why researcher might have overlooked this"
    }
  ],
  "cluster_research_targets": [
    "Research the siblings to find parent information",
    "Look for witnesses on marriage records of known children"
  ],
  "name_variations_to_try": ["Johann/John/Johannes", "Mueller/Miller/Muller"],
  "questions_to_answer": [
    "Have you confirmed the birthplace through multiple sources?",
    "Are there DNA matches clustering around a particular surname?"
  ],
  "long_shots": [
    "Approaches with low probability but high potential payoff"
  ]
}`
}

export function buildSummarizeAncestorPrompt(ancestor: AncestorWithContext): string {
  return `You are a genealogist summarizing what is known about an ancestor. Create a clear, well-organized summary.

## Ancestor Information

**Name:** ${ancestor.given_names || ''} ${ancestor.surname || ''}${ancestor.maiden_name ? ` (nee ${ancestor.maiden_name})` : ''}
**Nicknames:** ${ancestor.nicknames || 'None known'}
**Gender:** ${ancestor.gender || 'Unknown'}
**Birth:** ${ancestor.birth_date || 'Unknown'}${ancestor.birth_place ? ` in ${ancestor.birth_place}` : ''}
**Death:** ${ancestor.death_date || 'Unknown'}${ancestor.death_place ? ` in ${ancestor.death_place}` : ''}

## Known Facts
${ancestor.facts.length > 0 ? ancestor.facts.map(f => `- ${f.fact_type}: ${f.fact_value}${f.fact_date ? ` (${f.fact_date})` : ''}${f.fact_place ? ` at ${f.fact_place}` : ''} [${f.confidence}]`).join('\n') : 'None recorded'}

## Sources Checked
${ancestor.sources_checked.length > 0 ? `${ancestor.sources_checked.length} sources checked` : 'No sources logged'}
${ancestor.sources_checked.filter(s => s.outcome === 'found_record').length > 0 ? `\nRecords found in: ${ancestor.sources_checked.filter(s => s.outcome === 'found_record').map(s => s.source_name).join(', ')}` : ''}

## Research Notes
${ancestor.notes || 'No notes'}

## Task

Write a 2-3 paragraph summary that:
1. Introduces the person and their basic life details
2. Highlights what is well-documented vs. uncertain
3. Notes any research gaps or areas needing further investigation

Write in a narrative style suitable for a research report. Be factual and cite confidence levels where relevant.`
}
