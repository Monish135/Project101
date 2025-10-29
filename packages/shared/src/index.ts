export type FollowUpPayload = {
  items: string[];
  createdAt: number;
};

export type AgentQuestions = {
  text: string;
  createdAt: number;
  streamId?: string;
};

export interface ClientToServerEvents {
  "followup:create": (payload: FollowUpPayload) => void;
}

export interface ServerToClientEvents {
  "agent:questions": (data: AgentQuestions) => void;
}

export const MAX_ITEMS = 8;
export const MAX_TOTAL_CHARS = 300;


