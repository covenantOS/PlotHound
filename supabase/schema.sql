-- PlotHound Database Schema
-- Run this in your Supabase SQL editor to set up the database

-- Users (extended from Supabase auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  subscription_tier text default 'free' check (subscription_tier in ('free', 'researcher', 'investigator', 'professional')),
  stripe_customer_id text,
  stripe_subscription_id text,
  storage_used_bytes bigint default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Research Trees (a user can have multiple family lines)
create table public.trees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles on delete cascade not null,
  name text not null,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Ancestors (the people being researched)
create table public.ancestors (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid references public.trees on delete cascade not null,

  -- Basic info
  given_names text,
  surname text,
  maiden_name text,
  nicknames text,
  gender text check (gender in ('male', 'female', 'unknown')),

  -- Dates (stored as text to handle partial dates like "abt 1820" or "bef 1845")
  birth_date text,
  birth_place text,
  death_date text,
  death_place text,

  -- Research status
  is_brick_wall boolean default false,
  brick_wall_notes text,
  research_priority integer default 0, -- higher = more urgent

  -- Relationships (simple approach: store parent IDs)
  father_id uuid references public.ancestors,
  mother_id uuid references public.ancestors,
  spouse_ids uuid[] default '{}',

  -- Metadata
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Known Facts (structured facts about an ancestor)
create table public.facts (
  id uuid primary key default gen_random_uuid(),
  ancestor_id uuid references public.ancestors on delete cascade not null,
  fact_type text not null, -- 'birth', 'death', 'marriage', 'residence', 'occupation', 'immigration', 'military', 'education', 'religion', 'custom'
  fact_value text not null,
  fact_date text,
  fact_place text,
  source_citation text,
  confidence text check (confidence in ('certain', 'probable', 'possible', 'uncertain')) default 'probable',
  notes text,
  created_at timestamptz default now()
);

-- Research Goals (what the user is trying to find for an ancestor)
create table public.research_goals (
  id uuid primary key default gen_random_uuid(),
  ancestor_id uuid references public.ancestors on delete cascade not null,
  goal_text text not null, -- e.g., "Find immigration record", "Identify parents", "Confirm death date"
  status text check (status in ('active', 'completed', 'abandoned')) default 'active',
  completed_at timestamptz,
  notes text,
  created_at timestamptz default now()
);

-- Hypotheses (theories about an ancestor that need verification)
create table public.hypotheses (
  id uuid primary key default gen_random_uuid(),
  ancestor_id uuid references public.ancestors on delete cascade not null,
  hypothesis_text text not null, -- e.g., "Johann Mueller is the same as John Miller in 1870 census"
  status text check (status in ('testing', 'confirmed', 'disproven', 'inconclusive')) default 'testing',
  confidence_score integer, -- 0-100, can be AI-calculated or manual
  ai_analysis text, -- AI-generated analysis of the evidence
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Evidence (supports or contradicts hypotheses)
create table public.evidence (
  id uuid primary key default gen_random_uuid(),
  hypothesis_id uuid references public.hypotheses on delete cascade not null,
  evidence_type text check (evidence_type in ('supports', 'contradicts', 'neutral')) not null,
  evidence_text text not null,
  source_citation text,
  weight integer default 5, -- 1-10, how strong is this evidence
  created_at timestamptz default now()
);

-- Sources Checked (track what sources have been searched)
create table public.sources_checked (
  id uuid primary key default gen_random_uuid(),
  ancestor_id uuid references public.ancestors on delete cascade not null,
  source_name text not null, -- e.g., "1850 Federal Census, Hamilton County, Ohio"
  source_type text, -- 'census', 'vital', 'church', 'military', 'land', 'probate', 'newspaper', 'immigration', 'other'
  repository text, -- e.g., "Ancestry.com", "FamilySearch", "County Courthouse"
  date_checked date default current_date,
  outcome text check (outcome in ('found_record', 'nothing_found', 'partial_info', 'need_to_revisit')) not null,
  findings text, -- what was found (if anything)
  source_url text,
  created_at timestamptz default now()
);

-- Research Log (chronological notes for an ancestor)
create table public.research_log (
  id uuid primary key default gen_random_uuid(),
  ancestor_id uuid references public.ancestors on delete cascade not null,
  log_date timestamptz default now(),
  entry_text text not null,
  session_minutes integer, -- optional: how long spent on this
  created_at timestamptz default now()
);

-- Documents (uploaded files or links)
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  ancestor_id uuid references public.ancestors on delete cascade not null,
  title text not null,
  description text,
  file_path text, -- Supabase storage path (if uploaded)
  external_url text, -- if it's a link
  file_size_bytes bigint,
  file_type text,
  source_citation text,
  created_at timestamptz default now()
);

-- AI Research Plans (cached AI-generated plans)
create table public.research_plans (
  id uuid primary key default gen_random_uuid(),
  ancestor_id uuid references public.ancestors on delete cascade not null,
  plan_json jsonb not null, -- structured plan with steps, likelihood scores, etc.
  generated_at timestamptz default now(),
  is_current boolean default true -- only one current plan per ancestor
);

-- Create indexes
create index idx_ancestors_tree on public.ancestors(tree_id);
create index idx_ancestors_brick_wall on public.ancestors(is_brick_wall) where is_brick_wall = true;
create index idx_facts_ancestor on public.facts(ancestor_id);
create index idx_sources_ancestor on public.sources_checked(ancestor_id);
create index idx_research_log_ancestor on public.research_log(ancestor_id);
create index idx_hypotheses_ancestor on public.hypotheses(ancestor_id);

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.trees enable row level security;
alter table public.ancestors enable row level security;
alter table public.facts enable row level security;
alter table public.research_goals enable row level security;
alter table public.hypotheses enable row level security;
alter table public.evidence enable row level security;
alter table public.sources_checked enable row level security;
alter table public.research_log enable row level security;
alter table public.documents enable row level security;
alter table public.research_plans enable row level security;

-- RLS Policies (users can only access their own data)
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

create policy "Users can CRUD own trees" on public.trees for all using (auth.uid() = user_id);

create policy "Users can CRUD ancestors in own trees" on public.ancestors for all
  using (tree_id in (select id from public.trees where user_id = auth.uid()));

create policy "Users can CRUD facts for own ancestors" on public.facts for all
  using (ancestor_id in (select a.id from public.ancestors a join public.trees t on a.tree_id = t.id where t.user_id = auth.uid()));

create policy "Users can CRUD goals for own ancestors" on public.research_goals for all
  using (ancestor_id in (select a.id from public.ancestors a join public.trees t on a.tree_id = t.id where t.user_id = auth.uid()));

create policy "Users can CRUD hypotheses for own ancestors" on public.hypotheses for all
  using (ancestor_id in (select a.id from public.ancestors a join public.trees t on a.tree_id = t.id where t.user_id = auth.uid()));

create policy "Users can CRUD evidence for own hypotheses" on public.evidence for all
  using (hypothesis_id in (select h.id from public.hypotheses h join public.ancestors a on h.ancestor_id = a.id join public.trees t on a.tree_id = t.id where t.user_id = auth.uid()));

create policy "Users can CRUD sources for own ancestors" on public.sources_checked for all
  using (ancestor_id in (select a.id from public.ancestors a join public.trees t on a.tree_id = t.id where t.user_id = auth.uid()));

create policy "Users can CRUD log entries for own ancestors" on public.research_log for all
  using (ancestor_id in (select a.id from public.ancestors a join public.trees t on a.tree_id = t.id where t.user_id = auth.uid()));

create policy "Users can CRUD documents for own ancestors" on public.documents for all
  using (ancestor_id in (select a.id from public.ancestors a join public.trees t on a.tree_id = t.id where t.user_id = auth.uid()));

create policy "Users can CRUD plans for own ancestors" on public.research_plans for all
  using (ancestor_id in (select a.id from public.ancestors a join public.trees t on a.tree_id = t.id where t.user_id = auth.uid()));

-- Function to automatically create profile on user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for new user signup
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Function to update updated_at timestamp
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Triggers for updated_at
create trigger update_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.update_updated_at_column();

create trigger update_trees_updated_at
  before update on public.trees
  for each row execute procedure public.update_updated_at_column();

create trigger update_ancestors_updated_at
  before update on public.ancestors
  for each row execute procedure public.update_updated_at_column();

create trigger update_hypotheses_updated_at
  before update on public.hypotheses
  for each row execute procedure public.update_updated_at_column();

-- Storage bucket for documents
insert into storage.buckets (id, name, public) values ('documents', 'documents', false);

-- Storage policies
create policy "Users can upload documents" on storage.objects for insert
  with check (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can view own documents" on storage.objects for select
  using (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can delete own documents" on storage.objects for delete
  using (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);
