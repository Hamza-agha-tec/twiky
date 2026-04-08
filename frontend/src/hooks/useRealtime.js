import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';

/**
 * Hook to enable real-time synchronization for a specific table.
 * It invalidates React Query cache whenever a change occurs in the database.
 * 
 * @param {string} table - The name of the table to listen to.
 * @param {string[]} queryKey - The React Query key to invalidate.
 */
export function useRealtime(table, queryKey) {
    const queryClient = useQueryClient();
    const supabase = createClient();

    useEffect(() => {
        const channel = supabase
            .channel(`realtime:${table}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: table,
                },
                () => {
                    queryClient.invalidateQueries({ queryKey });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [table, queryKey, queryClient, supabase]);
}
