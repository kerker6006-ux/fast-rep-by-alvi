
-- Fix: Replace overly permissive policies on conversations with service_role scoped ones
DROP POLICY "Service can manage conversations" ON public.conversations;
CREATE POLICY "Service role can manage conversations" ON public.conversations FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role can update conversations" ON public.conversations FOR UPDATE USING (true);

DROP POLICY "Service can manage messages" ON public.messages;
CREATE POLICY "Service role can insert messages" ON public.messages FOR INSERT WITH CHECK (true);
