import useSWR from "swr";
import type { TeamRadio } from "@/lib/openf1/types";

export function useTeamRadio(sessionKey: number | null) {
  return useSWR<TeamRadio[]>(
    sessionKey ? `/api/f1/team_radio?session_key=${sessionKey}` : null
  );
}
