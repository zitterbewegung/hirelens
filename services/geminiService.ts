import { GoogleGenAI, Type } from "@google/genai";
import { ExtractedData } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    salaryMin: { type: Type.NUMBER, description: "The minimum salary mentioned, as a number. Null if not present." },
    salaryMax: { type: Type.NUMBER, description: "The maximum salary mentioned, as a number. Null if not present." },
    workLocationType: { type: Type.STRING, enum: ['remote', 'hybrid', 'onsite', 'unspecified'], description: "The type of work location." },
    jobCity: { type: Type.STRING, description: "The city of the job. Null if not present." },
    jobState: { type: Type.STRING, description: "The state or province of the job. Null if not present." },
    jobCountry: { type: Type.STRING, description: "The country of the job. Null if not present." },
    postingAgeInDays: { type: Type.NUMBER, description: "How many days ago the job was posted. Extract this from text like 'Posted 5 days ago' or a date. Calculate the difference from today if a date is given. Null if not found." },
    costOfLivingAnalysis: {
      type: Type.OBJECT,
      properties: {
        costOfLivingScore: { type: Type.NUMBER, description: "A log-normalized score from 0 to 100 representing how the salary compares to the cost of living. 0 is very poor, 100 is excellent. Null if salary or location is missing." },
        reasoning: { type: Type.STRING, description: "A brief explanation for the cost of living rating." }
      },
      required: ['reasoning']
    },
    overallSummary: { type: Type.STRING, description: "A one-paragraph summary of the job posting's quality from an HR perspective." }
  },
  required: ['workLocationType', 'costOfLivingAnalysis', 'overallSummary']
};

export const analyzeJobPosting = async (jobText: string): Promise<ExtractedData> => {
  const prompt = `
    Act as an expert HR analyst and recruiter. Analyze the following job posting text.
    Extract the required information and provide a quality assessment based on the specified JSON schema.
    
    Job Posting:
    ---
    ${jobText}
    ---
    
    Your analysis should focus on:
    1.  **Salary:** Extract the numerical min and max values. If a single number is given, use it for both.
    2.  **Location:** Determine if it's remote, hybrid, or onsite. Also, extract the city, state, and country.
    3.  **Posting Age:** Determine how many days ago the job was posted. Look for phrases like "Posted X days ago" or a specific date. If a date is provided, calculate the days from today's date, which is ${new Date().toISOString().split('T')[0]}.
    4.  **Cost of Living:** If salary and location are present, provide a log-normalized score from 0-100 assessing if the salary is good for that area's cost of living. A higher score is better. If salary or location is missing, this should be null.
    5.  **Summary:** Provide a concise overall summary.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });

    const jsonText = response.text.trim();
    const parsedData = JSON.parse(jsonText);
    
    // Gemini sometimes returns null instead of undefined for optional fields
    if (parsedData.salaryMin === null) delete parsedData.salaryMin;
    if (parsedData.salaryMax === null) delete parsedData.salaryMax;
    if (parsedData.jobCity === null) delete parsedData.jobCity;
    if (parsedData.jobState === null) delete parsedData.jobState;
    if (parsedData.jobCountry === null) delete parsedData.jobCountry;
    if (parsedData.postingAgeInDays === null) delete parsedData.postingAgeInDays;
    if (parsedData.costOfLivingAnalysis.costOfLivingScore === null) delete parsedData.costOfLivingAnalysis.costOfLivingScore;

    return parsedData as ExtractedData;

  } catch (error) {
    console.error("Error analyzing job posting:", error);
    throw new Error("Failed to get analysis from Gemini API. Please check the console for details.");
  }
};
