-- Resume Studio: widen the template choices from 2 plain layouts to 4 visually distinct ones.
-- 'classic'/'compact' keep their existing meaning; 'modern' and 'bold' are new colored, visually distinct layouts
-- rendered by dedicated resume renderers (src/core/documents/render-resume-pdf.ts, render-resume-docx.ts).
alter table public.member_resumes drop constraint if exists member_resumes_template_check;
alter table public.member_resumes add constraint member_resumes_template_check check (template in ('classic', 'compact', 'modern', 'bold'));
