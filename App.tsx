import React, { useState, useCallback } from 'react';
import { analyzeJobPosting } from './services/geminiService';
import { calculateScores } from './utils/scorer';
import { ScoredAnalysis } from './types';
import ScoreGauge from './components/ScoreGauge';
import { DollarSignIcon, LocationMarkerIcon, BuildingIcon, ClockIcon, QuestionMarkCircleIcon } from './components/icons';

const jobPostingExamples = [
  {
    name: 'Excellent Example',
    content: `Senior Backend Engineer (Go)
CloudSphere Inc. - Remote (USA)
Salary: $180,000 - $200,000 per year
Posted: 1 day ago

CloudSphere is seeking a highly skilled Senior Backend Engineer with expertise in Go to join our distributed team. You will be responsible for designing, developing, and maintaining our core cloud infrastructure. We offer a comprehensive benefits package, unlimited PTO, and a strong culture of innovation and collaboration. This is a fully remote position open to candidates across the United States.`
  },
  {
    name: 'Average Example',
    content: `Marketing Associate
MarketPro LLC - Chicago, IL (Hybrid)
Salary: $65,000 - $85,000
Posted: 2 weeks ago

MarketPro LLC is looking for a creative Marketing Associate to support our campaign development and execution. The ideal candidate will have 2-3 years of marketing experience. This is a hybrid role, with 2 days per week in our Chicago office. Responsibilities include social media management, content creation, and event coordination.`
  },
  {
    name: 'Poor Example',
    content: `Junior Graphic Designer
Creative Solutions - New York, NY (Onsite)
Salary: Competitive

We are hiring a Junior Graphic Designer to join our team in NYC. Must be proficient in Adobe Creative Suite. This is a full-time, onsite position. The successful candidate will work on a variety of design projects.
Posted 2 months ago`
  },
  {
    name: 'Missing Date',
    content: `Data Analyst
Data Insights Co. - Denver, CO (Hybrid)
Salary: $90,000 - $110,000 per year

We are looking for a Data Analyst to join our growing team. You will be responsible for analyzing large datasets to provide actionable insights. This role requires strong SQL and Python skills. The position is based in Denver, CO, with a hybrid work schedule. We offer great benefits and opportunities for professional growth.`
  }
];

const App: React.FC = () => {
  const [jobText, setJobText] = useState<string>(jobPostingExamples[0].content);
  const [analysis, setAnalysis] = useState<ScoredAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyzeClick = useCallback(async () => {
    if (!jobText.trim()) {
      setError("Job posting text cannot be empty.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      const extractedData = await analyzeJobPosting(jobText);
      const scoredData = calculateScores(extractedData);
      setAnalysis(scoredData);
    } catch (err: any) {
      setError(err.message || "An unknown error occurred.");
    } finally {
      setIsLoading(false);
    }
  }, [jobText]);

  const loadExample = (content: string) => {
    setJobText(content);
    setAnalysis(null);
    setError(null);
  };

  const InfoCard: React.FC<{
    icon: React.ReactNode;
    title: string;
    score: number;
    children: React.ReactNode;
    scoreColorClass: string;
  }> = ({ icon, title, score, children, scoreColorClass }) => (
    <div className="bg-slate-800/50 rounded-lg p-4 flex flex-col backdrop-blur-sm border border-slate-700">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-semibold text-slate-200">{title}</h3>
        </div>
        <span className={`font-bold text-lg ${scoreColorClass}`}>{score}/100</span>
      </div>
      <div className="text-sm text-slate-400 space-y-2">{children}</div>
    </div>
  );
  
  const getScoreColorClass = (score: number) => {
    if (score < 50) return 'text-red-500';
    if (score < 75) return 'text-amber-400';
    return 'text-green-500';
  }

  const renderAnalysis = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[500px]">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-slate-400">Analyzing job posting...</p>
        </div>
      );
    }

    if (error) {
      return <div className="text-red-400 bg-red-900/50 p-4 rounded-lg">{error}</div>;
    }

    if (!analysis) {
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[500px] text-center text-slate-500 border-2 border-dashed border-slate-700 rounded-lg p-8">
            <h2 className="text-2xl font-semibold text-slate-400 mb-2">Analysis Results</h2>
            <p>Results from your job posting analysis will appear here.</p>
        </div>
      );
    }

    const renderPostingAgeInfo = () => {
        if (typeof analysis.postingAgeInDays === 'number') {
            const age = analysis.postingAgeInDays;
            let textClass = 'text-green-400';
            if (age >= 30) textClass = 'text-amber-400';
            if (age >= 60) textClass = 'text-red-400';

            return <p className={textClass}>Posted <span className="font-bold">{age}</span> day{age === 1 ? '' : 's'} ago.</p>;
        }
        return (
            <div className="flex items-center gap-2 text-slate-400">
                <QuestionMarkCircleIcon className="w-8 h-8 text-amber-400 shrink-0" />
                <div>
                    <p className="font-bold text-slate-300">Posting Date Not Found</p>
                    <p>The age of the posting could not be determined. Stale jobs can be a red flag.</p>
                </div>
            </div>
        );
    };

    return (
      <div className="space-y-6">
        <div className="bg-slate-800/50 rounded-lg p-6 flex flex-col md:flex-row items-center gap-6 backdrop-blur-sm border border-slate-700">
          <ScoreGauge score={analysis.scores.overall} />
          <div className="flex-1">
            <h2 className="text-2xl font-bold mb-2">Overall Quality Analysis</h2>
            <p className="text-slate-400">{analysis.overallSummary}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InfoCard icon={<DollarSignIcon className="w-6 h-6 text-green-400" />} title="Salary" score={analysis.scores.salary} scoreColorClass={getScoreColorClass(analysis.scores.salary)}>
              {analysis.salaryMin && analysis.salaryMax ? (
                  <p>Range: ${analysis.salaryMin.toLocaleString()} - ${analysis.salaryMax.toLocaleString()}</p>
              ) : (
                  <p>No salary range provided. This is a major drawback.</p>
              )}
          </InfoCard>

          <InfoCard icon={<LocationMarkerIcon className="w-6 h-6 text-blue-400" />} title="Work Location" score={analysis.scores.location} scoreColorClass={getScoreColorClass(analysis.scores.location)}>
              <p>Type: <span className="font-semibold capitalize text-slate-300">{analysis.workLocationType}</span></p>
              {analysis.jobCity && <p>Location: {analysis.jobCity}, {analysis.jobState} {analysis.jobCountry}</p>}
          </InfoCard>
          
          <InfoCard icon={<BuildingIcon className="w-6 h-6 text-indigo-400" />} title="Cost of Living" score={analysis.scores.costOfLiving} scoreColorClass={getScoreColorClass(analysis.scores.costOfLiving)}>
             <p>Salary vs CoL: <span className="font-semibold capitalize text-slate-300">{analysis.costOfLivingAnalysis.salaryVsCostOfLiving}</span></p>
             <p>{analysis.costOfLivingAnalysis.reasoning}</p>
          </InfoCard>
          
          <InfoCard icon={<ClockIcon className="w-6 h-6 text-cyan-400" />} title="Posting Age" score={analysis.scores.redFlags} scoreColorClass={getScoreColorClass(analysis.scores.redFlags)}>
             {renderPostingAgeInfo()}
          </InfoCard>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-600">
            Job Posting Quality Analyzer
          </h1>
          <p className="mt-2 text-slate-400 max-w-2xl mx-auto">
            Paste a job description below and let AI score its quality based on key factors like salary, location, and posting age.
          </p>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="flex flex-col">
            <div className="mb-4">
              <label className="mb-2 font-semibold text-slate-300 block">
                Load an Example
              </label>
              <div className="flex flex-wrap gap-2">
                {jobPostingExamples.map((example) => (
                  <button
                    key={example.name}
                    onClick={() => loadExample(example.content)}
                    className="px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-md transition-colors"
                  >
                    {example.name}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              id="job-posting"
              value={jobText}
              onChange={(e) => setJobText(e.target.value)}
              placeholder="Paste job description here..."
              className="flex-grow w-full p-4 bg-slate-800 border border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-shadow min-h-[500px] text-slate-300"
              aria-label="Job Posting Text Input"
            />
            <button
              onClick={handleAnalyzeClick}
              disabled={isLoading}
              className="mt-4 w-full bg-brand-secondary hover:bg-brand-primary disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 flex items-center justify-center shadow-lg hover:shadow-blue-500/50"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Analyzing...
                </>
              ) : (
                'Analyze Posting'
              )}
            </button>
          </div>

          <div className="w-full">
            {renderAnalysis()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
