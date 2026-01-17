export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type SubscriptionTier = 'free' | 'researcher' | 'investigator' | 'professional'
export type Gender = 'male' | 'female' | 'unknown'
export type Confidence = 'certain' | 'probable' | 'possible' | 'uncertain'
export type GoalStatus = 'active' | 'completed' | 'abandoned'
export type HypothesisStatus = 'testing' | 'confirmed' | 'disproven' | 'inconclusive'
export type EvidenceType = 'supports' | 'contradicts' | 'neutral'
export type SourceOutcome = 'found_record' | 'nothing_found' | 'partial_info' | 'need_to_revisit'
export type SourceType = 'census' | 'vital' | 'church' | 'military' | 'land' | 'probate' | 'newspaper' | 'immigration' | 'dna' | 'other'
export type FactType = 'birth' | 'death' | 'marriage' | 'residence' | 'occupation' | 'immigration' | 'military' | 'education' | 'religion' | 'custom'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          subscription_tier: SubscriptionTier
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          storage_used_bytes: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          subscription_tier?: SubscriptionTier
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          storage_used_bytes?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          subscription_tier?: SubscriptionTier
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          storage_used_bytes?: number
          created_at?: string
          updated_at?: string
        }
      }
      trees: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      ancestors: {
        Row: {
          id: string
          tree_id: string
          given_names: string | null
          surname: string | null
          maiden_name: string | null
          nicknames: string | null
          gender: Gender | null
          birth_date: string | null
          birth_place: string | null
          death_date: string | null
          death_place: string | null
          is_brick_wall: boolean
          brick_wall_notes: string | null
          research_priority: number
          father_id: string | null
          mother_id: string | null
          spouse_ids: string[]
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tree_id: string
          given_names?: string | null
          surname?: string | null
          maiden_name?: string | null
          nicknames?: string | null
          gender?: Gender | null
          birth_date?: string | null
          birth_place?: string | null
          death_date?: string | null
          death_place?: string | null
          is_brick_wall?: boolean
          brick_wall_notes?: string | null
          research_priority?: number
          father_id?: string | null
          mother_id?: string | null
          spouse_ids?: string[]
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tree_id?: string
          given_names?: string | null
          surname?: string | null
          maiden_name?: string | null
          nicknames?: string | null
          gender?: Gender | null
          birth_date?: string | null
          birth_place?: string | null
          death_date?: string | null
          death_place?: string | null
          is_brick_wall?: boolean
          brick_wall_notes?: string | null
          research_priority?: number
          father_id?: string | null
          mother_id?: string | null
          spouse_ids?: string[]
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      facts: {
        Row: {
          id: string
          ancestor_id: string
          fact_type: string
          fact_value: string
          fact_date: string | null
          fact_place: string | null
          source_citation: string | null
          confidence: Confidence
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          ancestor_id: string
          fact_type: string
          fact_value: string
          fact_date?: string | null
          fact_place?: string | null
          source_citation?: string | null
          confidence?: Confidence
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          ancestor_id?: string
          fact_type?: string
          fact_value?: string
          fact_date?: string | null
          fact_place?: string | null
          source_citation?: string | null
          confidence?: Confidence
          notes?: string | null
          created_at?: string
        }
      }
      research_goals: {
        Row: {
          id: string
          ancestor_id: string
          goal_text: string
          status: GoalStatus
          completed_at: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          ancestor_id: string
          goal_text: string
          status?: GoalStatus
          completed_at?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          ancestor_id?: string
          goal_text?: string
          status?: GoalStatus
          completed_at?: string | null
          notes?: string | null
          created_at?: string
        }
      }
      hypotheses: {
        Row: {
          id: string
          ancestor_id: string
          hypothesis_text: string
          status: HypothesisStatus
          confidence_score: number | null
          ai_analysis: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          ancestor_id: string
          hypothesis_text: string
          status?: HypothesisStatus
          confidence_score?: number | null
          ai_analysis?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          ancestor_id?: string
          hypothesis_text?: string
          status?: HypothesisStatus
          confidence_score?: number | null
          ai_analysis?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      evidence: {
        Row: {
          id: string
          hypothesis_id: string
          evidence_type: EvidenceType
          evidence_text: string
          source_citation: string | null
          weight: number
          created_at: string
        }
        Insert: {
          id?: string
          hypothesis_id: string
          evidence_type: EvidenceType
          evidence_text: string
          source_citation?: string | null
          weight?: number
          created_at?: string
        }
        Update: {
          id?: string
          hypothesis_id?: string
          evidence_type?: EvidenceType
          evidence_text?: string
          source_citation?: string | null
          weight?: number
          created_at?: string
        }
      }
      sources_checked: {
        Row: {
          id: string
          ancestor_id: string
          source_name: string
          source_type: string | null
          repository: string | null
          date_checked: string
          outcome: SourceOutcome
          findings: string | null
          source_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          ancestor_id: string
          source_name: string
          source_type?: string | null
          repository?: string | null
          date_checked?: string
          outcome: SourceOutcome
          findings?: string | null
          source_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          ancestor_id?: string
          source_name?: string
          source_type?: string | null
          repository?: string | null
          date_checked?: string
          outcome?: SourceOutcome
          findings?: string | null
          source_url?: string | null
          created_at?: string
        }
      }
      research_log: {
        Row: {
          id: string
          ancestor_id: string
          log_date: string
          entry_text: string
          session_minutes: number | null
          created_at: string
        }
        Insert: {
          id?: string
          ancestor_id: string
          log_date?: string
          entry_text: string
          session_minutes?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          ancestor_id?: string
          log_date?: string
          entry_text?: string
          session_minutes?: number | null
          created_at?: string
        }
      }
      documents: {
        Row: {
          id: string
          ancestor_id: string
          title: string
          description: string | null
          file_path: string | null
          external_url: string | null
          file_size_bytes: number | null
          file_type: string | null
          source_citation: string | null
          created_at: string
        }
        Insert: {
          id?: string
          ancestor_id: string
          title: string
          description?: string | null
          file_path?: string | null
          external_url?: string | null
          file_size_bytes?: number | null
          file_type?: string | null
          source_citation?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          ancestor_id?: string
          title?: string
          description?: string | null
          file_path?: string | null
          external_url?: string | null
          file_size_bytes?: number | null
          file_type?: string | null
          source_citation?: string | null
          created_at?: string
        }
      }
      research_plans: {
        Row: {
          id: string
          ancestor_id: string
          plan_json: Json
          generated_at: string
          is_current: boolean
        }
        Insert: {
          id?: string
          ancestor_id: string
          plan_json: Json
          generated_at?: string
          is_current?: boolean
        }
        Update: {
          id?: string
          ancestor_id?: string
          plan_json?: Json
          generated_at?: string
          is_current?: boolean
        }
      }
    }
  }
}

// Convenience types
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Tree = Database['public']['Tables']['trees']['Row']
export type Ancestor = Database['public']['Tables']['ancestors']['Row']
export type Fact = Database['public']['Tables']['facts']['Row']
export type ResearchGoal = Database['public']['Tables']['research_goals']['Row']
export type Hypothesis = Database['public']['Tables']['hypotheses']['Row']
export type Evidence = Database['public']['Tables']['evidence']['Row']
export type SourceChecked = Database['public']['Tables']['sources_checked']['Row']
export type ResearchLogEntry = Database['public']['Tables']['research_log']['Row']
export type Document = Database['public']['Tables']['documents']['Row']
export type ResearchPlan = Database['public']['Tables']['research_plans']['Row']

// Insert types
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type TreeInsert = Database['public']['Tables']['trees']['Insert']
export type AncestorInsert = Database['public']['Tables']['ancestors']['Insert']
export type FactInsert = Database['public']['Tables']['facts']['Insert']
export type ResearchGoalInsert = Database['public']['Tables']['research_goals']['Insert']
export type HypothesisInsert = Database['public']['Tables']['hypotheses']['Insert']
export type EvidenceInsert = Database['public']['Tables']['evidence']['Insert']
export type SourceCheckedInsert = Database['public']['Tables']['sources_checked']['Insert']
export type ResearchLogEntryInsert = Database['public']['Tables']['research_log']['Insert']
export type DocumentInsert = Database['public']['Tables']['documents']['Insert']
export type ResearchPlanInsert = Database['public']['Tables']['research_plans']['Insert']

// Update types
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']
export type TreeUpdate = Database['public']['Tables']['trees']['Update']
export type AncestorUpdate = Database['public']['Tables']['ancestors']['Update']
export type FactUpdate = Database['public']['Tables']['facts']['Update']
export type ResearchGoalUpdate = Database['public']['Tables']['research_goals']['Update']
export type HypothesisUpdate = Database['public']['Tables']['hypotheses']['Update']
export type EvidenceUpdate = Database['public']['Tables']['evidence']['Update']
export type SourceCheckedUpdate = Database['public']['Tables']['sources_checked']['Update']
export type ResearchLogEntryUpdate = Database['public']['Tables']['research_log']['Update']
export type DocumentUpdate = Database['public']['Tables']['documents']['Update']
export type ResearchPlanUpdate = Database['public']['Tables']['research_plans']['Update']

// Extended types for UI
export interface AncestorWithContext extends Ancestor {
  facts: Fact[]
  research_goals: ResearchGoal[]
  sources_checked: SourceChecked[]
  research_log: ResearchLogEntry[]
  hypotheses: Hypothesis[]
}

export interface HypothesisWithEvidence extends Hypothesis {
  evidence: Evidence[]
}

export interface TreeWithAncestors extends Tree {
  ancestors: Ancestor[]
}

// AI Plan types
export interface ResearchPlanStep {
  priority: number
  source_name: string
  source_type: SourceType | 'other'
  repository: string
  rationale: string
  likelihood: 'low' | 'medium' | 'high' | 'very_high'
  likelihood_percent: number
  estimated_minutes: number
  url: string | null
  tips: string
}

export interface ResearchPlanData {
  summary: string
  steps: ResearchPlanStep[]
  alternative_approaches: string[]
}

export interface HypothesisAnalysis {
  confidence_score: number
  confidence_label: string
  analysis: string
  key_factors: { factor: string; impact: string }[]
  tie_breakers: string[]
  risk_assessment: string
}

export interface BrickWallAnalysis {
  diagnosis: string
  fresh_approaches: {
    approach: string
    description: string
    specific_actions: string[]
    likelihood_of_breakthrough: 'low' | 'medium' | 'high'
    why_not_tried: string
  }[]
  cluster_research_targets: string[]
  name_variations_to_try: string[]
  questions_to_answer: string[]
  long_shots: string[]
}
