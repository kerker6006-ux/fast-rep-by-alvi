import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { checkAdminRole } from "@/lib/admin-auth";

export const useIsAdmin = () => {
  const { session, loading: authLoading } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["is-admin", session?.user?.id, session?.access_token],
    enabled: !authLoading && !!session?.user?.id && !!session.access_token,
    staleTime: 60_000,
    retry: 1,
    queryFn: () => checkAdminRole(session),
  });
  return { isAdmin: data === true, loading: authLoading || (!!session && isLoading) };
};
