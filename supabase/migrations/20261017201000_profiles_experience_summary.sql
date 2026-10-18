-- One-line background for Signal job/housing tools (Edge Functions read profiles.experience_summary).
alter table public.profiles
  add column if not exists experience_summary text;

comment on column public.profiles.experience_summary is
  'Optional member-authored summary for Signal and fit explanations. Never shown publicly unless the member shares it in an application.';
