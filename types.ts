export interface ExtractedData {
  salaryMin?: number;
  salaryMax?: number;
  workLocationType: 'remote' | 'hybrid' | 'onsite' | 'unspecified';
  jobCity?: string;
  jobState?: string;
  jobCountry?: string;
  postingAgeInDays?: number;
  costOfLivingAnalysis: {
    costOfLivingScore?: number;
    reasoning: string;
  };
  overallSummary: string;
}

export interface ScoredAnalysis extends ExtractedData {
  scores: {
    overall: number;
    salary: number;
    location: number;
    costOfLiving: number;
    redFlags: number;
  };
}

export interface AtsAnalysis {
  matchScore: number;
  matchingKeywords: string[];
  missingKeywords: string[];
  summary: string;
  suggestions: string;
}