
// Fix: Add declaration for the chrome extension API to prevent TypeScript errors.
declare const chrome: any;

import React, { useState, useCallback, ChangeEvent } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { analyzeJobPosting, analyzeResumeAgainstJob } from './services/geminiService';
import { calculateScores } from './utils/scorer';
import { ScoredAnalysis, AtsAnalysis } from './types';
import ScoreGauge from './components/ScoreGauge';
import { DollarSignIcon, LocationMarkerIcon, BuildingIcon, ClockIcon, QuestionMarkCircleIcon, DocumentTextIcon, HirelensLogoIcon, LightBulbIcon, ClipboardCheckIcon, SparklesIcon } from './components/icons';

// Set worker source for pdf.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs`;

const jobPostingExamples = [
  {
    name: 'Excellent Example',
    content: `Senior Backend Engineer (Go)
CloudSphere Inc. - Remote (Austin, TX)
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
  }
];

const App: React.FC = () => {
  const [jobText, setJobText] = useState<string>('');
  const [analysis, setAnalysis] = useState<ScoredAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'how-it-works' | 'job' | 'ats'>('how-it-works');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [atsAnalysis, setAtsAnalysis] = useState<AtsAnalysis | null>(null);
  const [isAtsLoading, setIsAtsLoading] = useState<boolean>(false);
  const [atsError, setAtsError] = useState<string | null>(null);
  const [isGrabbingText, setIsGrabbingText] = useState(false);

  const handleGrabText = useCallback(() => {
    if (typeof chrome === 'undefined' || !chrome.tabs) {
        setError("This feature is only available in the Chrome extension.");
        return;
    }
    setIsGrabbingText(true);
    setError(null);
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].id) {
            chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                func: getJobDescriptionText,
            }).then(injectionResults => {
                const result = injectionResults[0].result;
                 if (result.success) {
                    setJobText(result.text);
                } else {
                    setError(result.error || "Failed to grab text.");
                }
                setIsGrabbingText(false);
            }).catch(err => {
                 setError(`Error grabbing text from page: ${err.message}`);
                 setIsGrabbingText(false);
            });
        } else {
            setError("Could not find active tab to grab text from.");
            setIsGrabbingText(false);
        }
    });
  }, []);

  const handleAnalyzeClick = useCallback(async () => {
    if (!jobText.trim()) {
      setError("Job posting text cannot be empty.");
      setActiveTab('job');
      return;
    }
    setIsLoading(true);
    setError(null);
    setAnalysis(null);
    setActiveTab('job');

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
    setAtsAnalysis(null);
    setAtsError(null);
    setSelectedFile(null);
    setActiveTab('how-it-works');
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
        if (event.target.files[0].type === 'application/pdf') {
            setSelectedFile(event.target.files[0]);
            setAtsError(null);
            setAtsAnalysis(null);
        } else {
            setAtsError("Please upload a PDF file.");
            setSelectedFile(null);
        }
    }
  };

  const extractTextFromPdf = async (file: File): Promise<string> => {
    const reader = new FileReader();
    return new Promise((resolve, reject) => {
        reader.onload = async (event) => {
            if (!event.target?.result) return reject(new Error("Failed to read file."));
            try {
                const pdf = await pdfjsLib.getDocument(event.target.result as ArrayBuffer).promise;
                let text = '';
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const content = await page.getTextContent();
                    text += content.items.map(item => 'str' in item ? item.str : '').join(' ');
                }
                resolve(text);
            } catch (error) {
                reject(new Error("Failed to parse PDF file."));
            }
        };
        reader.onerror = () => reject(new Error("Error reading file."));
        reader.readAsArrayBuffer(file);
    });
  };

  const handleAtsCheckClick = async () => {
    if (!jobText.trim()) {
        setAtsError("Please provide a job description first.");
        return;
    }
    if (!selectedFile) {
        setAtsError("Please upload a resume PDF.");
        return;
    }

    setIsAtsLoading(true);
    setAtsError(null);
    setAtsAnalysis(null);

    try {
        const resumeText = await extractTextFromPdf(selectedFile);
        if (!resumeText.trim()) {
            throw new Error("Could not extract text from the PDF. The file might be empty or image-based.");
        }
        const result = await analyzeResumeAgainstJob(resumeText, jobText);
        setAtsAnalysis(result);
    } catch (err: any) {
        setAtsError(err.message || "An unknown error occurred during ATS analysis.");
    } finally {
        setIsAtsLoading(false);
    }
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

  const renderHowItWorks = () => {
    return (
        <div className="space-y-6 animate-fade-in h-full flex flex-col justify-center">
            <div className="bg-slate-800/50 rounded-lg p-6 backdrop-blur-sm border border-slate-700">
                <div className="flex items-center gap-3 mb-4">
                    <HirelensLogoIcon className="w-8 h-8"/>
                    <h2 className="text-2xl font-bold">How Hirelens Works</h2>
                </div>
                <div className="space-y-6 text-slate-400">
                    <div className="flex items-start gap-4">
                        <div className="bg-blue-500/10 text-blue-400 rounded-full p-2 mt-1 flex-shrink-0">
                            <DocumentTextIcon className="w-6 h-6"/>
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-200">1. Grab or Paste a Job Description</h3>
                            <p>Click "Grab Text from Page" to automatically extract the job description from your current tab, or paste the text directly into the text area.</p>
                        </div>
                    </div>
                     <div className="flex items-start gap-4">
                        <div className="bg-green-500/10 text-green-400 rounded-full p-2 mt-1 flex-shrink-0">
                           <LightBulbIcon className="w-6 h-6"/>
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-200">2. Get AI-Powered Insights</h3>
                            <p>Click "Analyze Posting". Our AI reads the posting and scores it on key quality metrics like salary transparency, location benefits, cost of living match, and posting age.</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-4">
                        <div className="bg-indigo-500/10 text-indigo-400 rounded-full p-2 mt-1 flex-shrink-0">
                           <ClipboardCheckIcon className="w-6 h-6"/>
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-200">3. Check Your Resume's Fit</h3>
                            <p>Switch to the "Resume ATS Check" tab. Upload your resume in PDF format to see how well it matches the job description, get a match score, and receive actionable suggestions for improvement.</p>
                        </div>
                    </div>
                </div>
                 <div className="mt-6 pt-4 border-t border-slate-700 flex items-center justify-center gap-2 text-sm text-slate-500">
                    <SparklesIcon className="w-5 h-5" />
                    <span>Analysis powered by Google Gemini</span>
                </div>
            </div>
        </div>
    );
  };

  const renderAnalysis = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[500px]">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-slate-400">Analyzing job posting...</p>
        </div>
      );
    }

    if (error && activeTab === 'job') {
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
    
    const salarySpread = analysis.salaryMin && analysis.salaryMax && analysis.salaryMax > 0
      ? ((analysis.salaryMax - analysis.salaryMin) / analysis.salaryMax) * 100
      : null;
    
    const locationString = [analysis.jobCity, analysis.jobState, analysis.jobCountry].filter(Boolean).join(', ');

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="bg-slate-800/50 rounded-lg p-6 flex flex-col md:flex-row items-center gap-6 backdrop-blur-sm border border-slate-700">
          <ScoreGauge score={analysis.scores.overall} label="Quality Score" />
          <div className="flex-1">
            <h2 className="text-2xl font-bold mb-2">Overall Quality Analysis</h2>
            <p className="text-slate-400">{analysis.overallSummary}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoCard icon={<DollarSignIcon className="w-6 h-6 text-green-400" />} title="Salary" score={analysis.scores.salary} scoreColorClass={getScoreColorClass(analysis.scores.salary)}>
                {analysis.salaryMin && analysis.salaryMax ? ( 
                    <>
                        <p>Range: ${analysis.salaryMin.toLocaleString()} - ${analysis.salaryMax.toLocaleString()}</p>
                        {salarySpread !== null && <p>Spread: <span className="font-semibold text-slate-300">{salarySpread.toFixed(1)}%</span></p>}
                        <p className="text-xs pt-1">Score is based on providing a salary and the narrowness of the range.</p>
                    </>
                ) : ( <p>No salary range provided.</p> )}
            </InfoCard>
            <InfoCard icon={<LocationMarkerIcon className="w-6 h-6 text-blue-400" />} title="Work Location" score={analysis.scores.location} scoreColorClass={getScoreColorClass(analysis.scores.location)}>
                <p>Type: <span className="font-semibold capitalize text-slate-300">{analysis.workLocationType}</span></p>
                {locationString && <p>Location: {locationString}</p>}
            </InfoCard>
            <InfoCard icon={<BuildingIcon className="w-6 h-6 text-indigo-400" />} title="Cost of Living" score={analysis.scores.costOfLiving} scoreColorClass={getScoreColorClass(analysis.scores.costOfLiving)}>
                {typeof analysis.costOfLivingAnalysis.costOfLivingScore === 'number' && <p>Salary vs CoL Score: <span className="font-semibold text-slate-300">{analysis.costOfLivingAnalysis.costOfLivingScore} / 100</span></p>}
                <p>{analysis.costOfLivingAnalysis.reasoning}</p>
            </InfoCard>
            <InfoCard icon={<ClockIcon className="w-6 h-6 text-cyan-400" />} title="Posting Age" score={analysis.scores.redFlags} scoreColorClass={getScoreColorClass(analysis.scores.redFlags)}>
                {typeof analysis.postingAgeInDays === 'number' ? <p>Posted <span className="font-bold">{analysis.postingAgeInDays}</span> day{analysis.postingAgeInDays === 1 ? '' : 's'} ago.</p> : <p>Posting date not found.</p>}
            </InfoCard>
        </div>
      </div>
    );
  };
  
  const renderAtsUi = () => {
    return (
        <div className="space-y-6">
            <div className="bg-slate-800/50 rounded-lg p-6 backdrop-blur-sm border border-slate-700 space-y-4">
                <div className="flex items-center gap-3">
                    <DocumentTextIcon className="w-8 h-8 text-indigo-400" />
                    <div>
                        <h2 className="text-xl font-bold">ATS Resume Check</h2>
                        <p className="text-slate-400 text-sm">Upload your PDF resume to see how it matches the job description.</p>
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 items-center">
                    <label htmlFor="resume-upload" className="w-full sm:w-auto flex-shrink-0 cursor-pointer bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold py-2 px-4 rounded-lg transition-colors text-center">
                        {selectedFile ? 'Change File' : 'Upload PDF'}
                    </label>
                    <input id="resume-upload" type="file" accept=".pdf" onChange={handleFileChange} className="hidden" />
                    <span className="text-slate-400 truncate w-full text-center sm:text-left">{selectedFile ? selectedFile.name : 'No file selected.'}</span>
                </div>
                 <button onClick={handleAtsCheckClick} disabled={isAtsLoading || !selectedFile} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 flex items-center justify-center">
                    {isAtsLoading ? <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>Checking...</> : 'Check Resume Match'}
                </button>
            </div>
            {renderAtsAnalysis()}
        </div>
    )
  }

  const renderAtsAnalysis = () => {
    if (isAtsLoading) {
        return (
          <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
            <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-slate-400">Performing ATS analysis...</p>
          </div>
        );
    }
    if (atsError) {
        return <div className="text-red-400 bg-red-900/50 p-4 rounded-lg">{atsError}</div>;
    }
    if (!atsAnalysis) {
        return (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center text-slate-500 border-2 border-dashed border-slate-700 rounded-lg p-8">
                <h2 className="text-2xl font-semibold text-slate-400 mb-2">Resume Analysis</h2>
                <p>Upload a resume to compare it against the job description.</p>
            </div>
        );
    }
    return (
        <div className="space-y-6 animate-fade-in">
             <div className="bg-slate-800/50 rounded-lg p-6 flex flex-col md:flex-row items-center gap-6 backdrop-blur-sm border border-slate-700">
                <ScoreGauge score={atsAnalysis.matchScore} label="Match Score" />
                <div className="flex-1">
                    <h2 className="text-2xl font-bold mb-2">ATS Summary</h2>
                    <p className="text-slate-400">{atsAnalysis.summary}</p>
                </div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-6 backdrop-blur-sm border border-slate-700">
                <h3 className="text-lg font-bold mb-3">Suggestions for Improvement</h3>
                <p className="text-slate-400 whitespace-pre-line">{atsAnalysis.suggestions}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-800/50 rounded-lg p-4 backdrop-blur-sm border border-slate-700">
                    <h3 className="font-semibold text-green-400 mb-2">Matching Keywords</h3>
                    <ul className="flex flex-wrap gap-2">{atsAnalysis.matchingKeywords.map(k => <li key={k} className="bg-green-900/50 text-green-300 text-xs font-medium px-2.5 py-1 rounded-full">{k}</li>)}</ul>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-4 backdrop-blur-sm border border-slate-700">
                    <h3 className="font-semibold text-amber-400 mb-2">Missing Keywords</h3>
                    <ul className="flex flex-wrap gap-2">{atsAnalysis.missingKeywords.map(k => <li key={k} className="bg-amber-900/50 text-amber-300 text-xs font-medium px-2.5 py-1 rounded-full">{k}</li>)}</ul>
                </div>
            </div>
        </div>
    )
  }

  const TabButton: React.FC<{
    label: string;
    isActive: boolean;
    onClick: () => void;
  }> = ({ label, isActive, onClick }) => (
    <button
      onClick={onClick}
      className={`px-4 py-2 font-semibold rounded-t-lg transition-colors ${
        isActive
          ? 'bg-slate-800/50 border-b-2 border-blue-500 text-white'
          : 'text-slate-400 hover:bg-slate-700/50'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 sm:gap-4">
            <HirelensLogoIcon className="w-10 h-10 sm:w-12 sm:h-12" />
            <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-600">
              Hirelens
            </h1>
          </div>
          <p className="mt-2 text-slate-400 max-w-2xl mx-auto">
            Analyze job descriptions and check your resume's match with our AI-powered tools.
          </p>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="flex flex-col">
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <button onClick={handleGrabText} disabled={isGrabbingText} className="w-full sm:w-auto flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg transition-all duration-300 flex items-center justify-center shadow-lg hover:shadow-indigo-500/50">
                {isGrabbingText ? <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>Grabbing...</> : 'Grab Text from Page'}
              </button>
              <div className="relative sm:w-auto flex-1 group">
                  <button className="w-full bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold py-2 px-4 rounded-lg transition-colors">Load Example</button>
                  <div className="absolute z-10 top-full mt-2 w-full sm:w-48 bg-slate-700 rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto">
                      {jobPostingExamples.map((example) => <a key={example.name} href="#" onClick={(e) => { e.preventDefault(); loadExample(example.content); }} className="block px-4 py-2 text-sm text-slate-300 hover:bg-slate-600">{example.name}</a>)}
                  </div>
              </div>
            </div>
            <textarea id="job-posting" value={jobText} onChange={(e) => setJobText(e.target.value)} placeholder="Paste job description here, or click 'Grab Text from Page' while viewing a job posting..." className="flex-grow w-full p-4 bg-slate-800 border border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-shadow min-h-[470px] text-slate-300" aria-label="Job Posting Text Input" />
            <button onClick={handleAnalyzeClick} disabled={isLoading} className="mt-4 w-full bg-brand-secondary hover:bg-brand-primary disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 flex items-center justify-center shadow-lg hover:shadow-blue-500/50">
                {isLoading ? <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>Analyzing...</> : 'Analyze Posting'}
            </button>
          </div>

          <div className="w-full">
            <div className="border-b border-slate-700 mb-6">
                <TabButton label="How It Works" isActive={activeTab === 'how-it-works'} onClick={() => setActiveTab('how-it-works')} />
                <TabButton label="Job Quality Analysis" isActive={activeTab === 'job'} onClick={() => setActiveTab('job')} />
                <TabButton label="Resume ATS Check" isActive={activeTab === 'ats'} onClick={() => setActiveTab('ats')} />
            </div>
            {activeTab === 'how-it-works' && renderHowItWorks()}
            {activeTab === 'job' && renderAnalysis()}
            {activeTab === 'ats' && renderAtsUi()}
          </div>
        </main>
      </div>
    </div>
  );
};

// This function will be injected into the active tab by the extension's service worker
// to avoid complex message passing setups for this simple case.
const getJobDescriptionText = (): { success: boolean; text?: string; error?: string } => {
  const selectors = [
    // LinkedIn
    '.jobs-description__content .jobs-description-content__text',
    '#job-details',
    // Indeed
    '#jobDescriptionText',
    // Greenhouse
    '#content',
    // Lever
    '.content .section-wrapper .postings-body',
    // Wellfound (formerly AngelList)
    '[data-test="job-description"]',
    // Glassdoor
    '.jobDescriptionContent',
    // Generic selectors
    'article',
    'main',
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector) as HTMLElement;
    if (element && element.innerText.length > 200) {
      return { success: true, text: element.innerText.trim() };
    }
  }

  return { success: false, error: "Could not find a suitable job description on this page." };
};

export default App;