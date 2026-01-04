export type PageData = {
  user: {
    id: number;
    email: string;
    // další pole podle potřeby
  } | null;
  canVote?: boolean;
  votingWindow?: {
    voting_start: string;
    voting_end: string;
  } | null;
  grade?: number;
  targetYear?: number;
  votingMessage?: string;
};
