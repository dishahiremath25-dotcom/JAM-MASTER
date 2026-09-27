JAM BT MASTER — SUPABASE PRACTICE FIX

The original app.js used a hard-coded 10-question sample array.
This replacement removes that sample bank and loads real questions
from public.questions in Supabase.

IMPORTANT:
1. Put your Supabase Project URL and browser-safe Publishable/anon key
   into supabase-config.js.
2. Keep the Supabase JS CDN script in index.html.
3. Script order has been fixed:
      supabase JS -> supabase-config.js -> app.js -> pyq-mock.js
4. Open the website and use Subjects -> choose a subject -> choose a topic.
5. The displayed question count comes from your live database.

The Practice page queries:
  public.questions
  public.subjects
  public.topics

Only non-PYQ questions are used for normal topic practice.
Your PYQ mock engine remains separate and uses pyq-mocks / pyq-mock-questions.

The site will now show the real question bank rather than the old sample
questions.
