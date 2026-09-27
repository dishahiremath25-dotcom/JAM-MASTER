-- Run this only if the website cannot read your practice question bank.
-- It allows the browser-safe anon/authenticated roles to READ the practice bank.

CREATE POLICY "Allow public read access to subjects"
ON public.subjects FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow public read access to topics"
ON public.topics FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow public read access to subtopics"
ON public.subtopics FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow public read access to practice questions"
ON public.questions FOR SELECT TO anon, authenticated USING (true);
