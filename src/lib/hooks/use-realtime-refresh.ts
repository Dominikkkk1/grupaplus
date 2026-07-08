"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Hook do auto-refresh strony gdy dane w Supabase się zmienią.
 * Debounce 500ms żeby nie spamować refresh przy wielu zmianach naraz.
 */
export function useRealtimeRefresh(tables: string[], channelName: string) {
  const router = useRouter();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let channel = supabase.channel(channelName);

    for (const table of tables) {
      channel = channel.on(
        "postgres_changes" as never,
        { event: "*", schema: "public", table },
        () => {
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => router.refresh(), 1000);
        }
      );
    }

    channel.subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [router, channelName, tables]);
}
