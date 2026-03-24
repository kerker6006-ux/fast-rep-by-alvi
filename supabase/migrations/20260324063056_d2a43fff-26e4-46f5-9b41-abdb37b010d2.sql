-- Allow admins to delete any order
CREATE POLICY "Admins delete all orders"
ON public.orders FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to update any order  
CREATE POLICY "Admins update all orders"
ON public.orders FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete complaints
CREATE POLICY "Admins delete all complaints"
ON public.complaints FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));