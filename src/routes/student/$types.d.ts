export type PageData = {
	user: {
		id: number;
		email: string;
	} | null;
	canVote?: boolean;
	votingWindow?: {
		voting_start: string;
		voting_end: string;
	} | null;
	grade?: number;
	targetYear?: number;
	votingMessage?: string;
	published?: boolean;
	subjects?: Array<{
		id: number;
		name: string;
		description: string;
		subject_type?: string;
		target_grade?: number;
	}>;
	subjectTypes?: string[];
	alreadyVotedTypes?: string[];
};
