"use client";

import { useState, type PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const buildQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 15 * 60_000,
        refetchOnWindowFocus: false,
        retry: 1
      }
    }
  });

export const AppQueryProvider = ({ children }: PropsWithChildren) => {
  const [queryClient] = useState(buildQueryClient);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};
