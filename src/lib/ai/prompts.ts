import type { AncestorWithContext, HypothesisWithEvidence, Ancestor } from '@/types/database'

export function buildResearchPlanPrompt(ancestor: AncestorWithContext): string {
  return `You are an expert genealogist helping a researcher find information about an ancestor. Based on the information provided, generate a prioritized research plan.

## Ancestor Information

**Name:** ${ancestor.given_names || ''} ${ancestor.surname || ''}${ancestor.maiden_name ? ` (nee ${ancestor.maiden_name})` : ''}
**Gender:** ${ancestor.gender || 'Unknown'}
**Birth:** ${ancestor.birth_date || 'Unknown'}${ancestor.birth_place ? ` in ${ancestor.birth_place}` : ''}
**Death:** ${ancestor.death_date || 'Unknown'}${ancestor.death_place ? ` in ${ancestor.death_place}` : ''}

## Known Facts
${ancestor.facts.length > 0 ? ancestor.facts.map(f => `- ${f.fact_type}: ${f.fact_value}${f.fact_date ? ` (${f.fact_date})` : ''}${f.fact_place ? ` at ${f.fact_place}` : ''} [${f.confidence}]`).join('\n') : 'None recorded'}

## Current Research Goals
${ancestor.research_goals.filter(g => g.status === 'active').map(g => `- ${g.goal_text}`).join('\n') || 'No specific goals set'}

## Sources Already Checked
${ancestor.sources_checked.length > 0 ? ancestor.sources_checked.map(s => `- ${s.source_name} (${s.repository || 'unknown repository'}): ${s.outcome}${s.findings ? ` - "${s.findings}"` : ''}`).join('\n') : 'None recorded'}

## Your Task

Generate a research plan with 5-8 specific next steps. For each step, provide:

1. **Source to check**: Be specific (e.g., "1850 Federal Census, Hamilton County, Ohio" not just "census records")
2. **Repository**: Where to find it (Ancestry, FamilySearch, specific archive, etc.)
3. **Why this might help**: Connect it to the research goals or gaps in knowledge
4. **Likelihood score**: Estimate probability of finding useful information (Low: 10-25%, Medium: 26-50%, High: 51-75%, Very High: 76-95%)
5. **Estimated time**: How long this search typically takes
6. **Direct link**: If available, provide a URL to start the search

Prioritize by likelihood of success, with highest likelihood first.

Consider:
- Time period and location-specific records that would have existed
- Records the researcher has NOT yet checked
- Alternative approaches if direct records don't exist
- DNA research angles if applicable

Respond in this JSON format:
{
  "summary": "Brief overview of the research situation and strategy",
  "steps": [
    {
      "priority": 1,
      "source_name": "Specific source name",
      "source_type": "census|vital|church|military|land|probate|newspaper|immigration|dna|other",
      "repository": "Where to find it",
      "rationale": "Why this might help",
      "likelihood": "low|medium|high|very_high",
      "likelihood_percent": 45,
      "estimated_minutes": 30,
      "url": "https://..." or null,
      "tips": "Any specific search tips for this source"
    }
  ],
  "alternative_approaches": [
    "If standard records fail, consider..."
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
