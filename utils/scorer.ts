
import { ExtractedData, ScoredAnalysis } from '../types';

const MAX_SALARY_SCORE = 35;
const MAX_LOCATION_SCORE = 20;
const MAX_COST_OF_LIVING_SCORE = 30;
const MAX_POSTING_AGE_SCORE = 15;

const TOTAL_MAX_SCORE = MAX_SALARY_SCORE + MAX_LOCATION_SCORE + MAX_COST_OF_LIVING_SCORE + MAX_POSTING_AGE_SCORE;

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
  
  let postingAgeCategoryScore = 0; // Score from 0-100 for this category
  if (typeof data.postingAgeInDays === 'number') {
    const age = data.postingAgeInDays;
    if (age < 7) {
        postingAgeCategoryScore = 100;
    } else if (age < 14) {
        postingAgeCategoryScore = 80;
    } else if (age < 30) {
        postingAgeCategoryScore = 50;
    } else if (age < 60) {
        postingAgeCategoryScore = 20;
    } else {
        postingAgeCategoryScore = 0;
    }
  } else {
    // If not found, score is 0. The UI will show a question mark and explain.
    postingAgeCategoryScore = 0; 
  }

  const postingAgePoints = (postingAgeCategoryScore / 100) * MAX_POSTING_AGE_SCORE;

  const totalPoints = salaryScore + locationScore + costOfLivingScore + postingAgePoints;

  const overallScore = Math.round((totalPoints / TOTAL_MAX_SCORE) * 100);

  return {
    ...data,
    scores: {
      overall: overallScore,
      salary: Math.round((salaryScore / MAX_SALARY_SCORE) * 100),
      location: Math.round((locationScore / MAX_LOCATION_SCORE) * 100),
      costOfLiving: Math.round((costOfLivingScore / MAX_COST_OF_LIVING_SCORE) * 100),
      redFlags: postingAgeCategoryScore, // Keep name for App.tsx, value is 0-100
    },
  };
};
