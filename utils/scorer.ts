
import { ExtractedData, ScoredAnalysis } from '../types';

const MAX_SALARY_SCORE = 35;
const MAX_LOCATION_SCORE = 20;
const MAX_COST_OF_LIVING_SCORE = 30;
const MAX_RED_FLAGS_SCORE = 15; // Represents potential positive points if no flags.

const TOTAL_MAX_SCORE = MAX_SALARY_SCORE + MAX_LOCATION_SCORE + MAX_COST_OF_LIVING_SCORE + MAX_RED_FLAGS_SCORE;

export const calculateScores = (data: ExtractedData): ScoredAnalysis => {
  let salaryScore = 0;
  if (data.salaryMin && data.salaryMax) {
    // Score for providing salary
    salaryScore += 25;
    
    // Score for narrow spread
    const spreadRatio = (data.salaryMax - data.salaryMin) / data.salaryMax;
    if (spreadRatio < 0.15) {
      salaryScore += 10;
    } else if (spreadRatio < 0.3) {
      salaryScore += 5;
    }
  }

  let locationScore = 0;
  switch (data.workLocationType) {
    case 'remote':
      locationScore = 20;
      break;
    case 'hybrid':
      locationScore = 15;
      break;
    case 'onsite':
      locationScore = 5;
      break;
    default:
      locationScore = 0;
  }

  let costOfLivingScore = 0;
  switch (data.costOfLivingAnalysis.salaryVsCostOfLiving) {
    case 'high':
      costOfLivingScore = 30;
      break;
    case 'medium':
      costOfLivingScore = 15;
      break;
    case 'low':
      costOfLivingScore = 5;
      break;
    default:
      costOfLivingScore = 0;
  }
  
  const redFlagsPenalty = data.discriminatoryLanguage.ageRelated ? 50 : 0;
  const redFlagsScore = MAX_RED_FLAGS_SCORE - (redFlagsPenalty > 0 ? MAX_RED_FLAGS_SCORE : 0);

  const totalPositiveScore = salaryScore + locationScore + costOfLivingScore + MAX_RED_FLAGS_SCORE;
  const finalScore = Math.max(0, totalPositiveScore - redFlagsPenalty);

  const overallScore = Math.round((finalScore / TOTAL_MAX_SCORE) * 100);

  return {
    ...data,
    scores: {
      overall: overallScore,
      salary: Math.round((salaryScore / MAX_SALARY_SCORE) * 100),
      location: Math.round((locationScore / MAX_LOCATION_SCORE) * 100),
      costOfLiving: Math.round((costOfLivingScore / MAX_COST_OF_LIVING_SCORE) * 100),
      redFlags: redFlagsPenalty > 0 ? 0 : 100, // 0 if flags found, 100 otherwise
    },
  };
};
