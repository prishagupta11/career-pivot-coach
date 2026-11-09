'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  AudioWaveform, 
  Mic, 
  MicOff, 
  RefreshCw, 
  CheckCircle2, 
  Trophy, 
  Sparkles, 
  RotateCcw, 
  ChevronRight, 
  TrendingUp, 
  Check, 
  Copy, 
  History, 
  Brain
} from 'lucide-react';
import { useAppState, saveStoredState } from '@/lib/storage';
import { InterviewRecord, RubricCriterion } from '@/types';
import AILoadingIndicator from '@/components/AILoadingIndicator';

interface QuestionItem {
  id: string;
  text: string;
  type: 'technical' | 'behavioral';
  targetSkill: string;
  contextWhy: string;
}

export default function MockInterviewPage() {
  const [state, setState] = useAppState();
  const [activeCategory, setActiveCategory] = useState<'all' | 'technical' | 'behavioral'>('all');
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [customQuestionList, setCustomQuestionList] = useState<QuestionItem[]>([]);
  
  // Voice & Input states
  const [userAnswer, setUserAnswer] = useState<string>('');
  const [cleanedAnswer, setCleanedAnswer] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isCleaning, setIsCleaning] = useState<boolean>(false);
  const [isScoring, setIsScoring] = useState<boolean>(false);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState<boolean>(false);
  
  // Evaluation & Retry tracking
  const [latestEvaluation, setLatestEvaluation] = useState<InterviewRecord | null>(null);
  const [selectedHistoricalRecord, setSelectedHistoricalRecord] = useState<InterviewRecord | null>(null);
  const [copiedSample, setCopiedSample] = useState<boolean>(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Setup speech recognition
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        let finalChunk = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalChunk += event.results[i][0].transcript + ' ';
          }
        }
        if (finalChunk.trim()) {
          setUserAnswer(prev => {
            const current = (prev || '').trim();
            const addition = finalChunk.trim();
            return current ? `${current} ${addition}` : addition;
          });
        }
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onerror = (e: any) => {
        console.warn('Speech recognition error:', e.error);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (_) {}
      }
    };
  }, []);

  // Compute weakest skills from empirical gap map (guarded against uninitialized state)
  const gapSkills = state?.skillGapMap?.skills;
  const weakestSkills = useMemo(() => {
    if (!gapSkills || !Array.isArray(gapSkills)) return [];
    return gapSkills
      .filter(s => s && (s.matchStatus === 'lacks' || s.matchStatus === 'partly' || s.gapSeverity === 'Critical'))
      .map(s => s.skillName)
      .filter(Boolean);
  }, [gapSkills]);

  // Build default question bank tailored to candidate's target role and weakest gaps
  const defaultQuestions: QuestionItem[] = useMemo(() => {
    const targetRole = state?.profile?.targetRole || 'Junior Data Analyst';
    const currentRole = state?.profile?.currentRole || 'Career Transitioner';
    const gap1 = weakestSkills[0] || 'SQL & Complex Joins';
    const gap2 = weakestSkills[1] || 'Tableau / Power BI';
    const gap3 = weakestSkills[2] || 'Data Cleansing & Validation';

    return [
      {
        id: 'q-tech-sql',
        text: `In SQL, how would you write a query using window functions or multi-table joins to analyze month-over-month retention cohorts?`,
        type: 'technical',
        targetSkill: gap1,
        contextWhy: 'Tests ability to structure advanced queries, aggregate transactional data, and compute analytical metrics.'
      },
      {
        id: 'q-tech-cleaning',
        text: `Walk me through your methodology for ${gap3} when dealing with duplicate records, null entries, and inconsistent date formats.`,
        type: 'technical',
        targetSkill: gap3,
        contextWhy: 'Assesses data hygiene standards and diagnostic problem-solving before feeding data into production pipelines.'
      },
      {
        id: 'q-tech-bi',
        text: `When designing an executive dashboard in ${gap2}, how do you structure high-level KPI tiles versus transactional drill-downs for operational leaders?`,
        type: 'technical',
        targetSkill: gap2,
        contextWhy: 'Verifies visual information architecture, executive storytelling, and user-centric dashboard engineering.'
      },
      {
        id: 'q-behav-pivot',
        text: `Why are you transitioning from your background in ${currentRole} into ${targetRole}, and how does your previous experience make you uniquely valuable?`,
        type: 'behavioral',
        targetSkill: 'Pivot Rationale & Storytelling',
        contextWhy: 'Assesses career intentionality, self-awareness, and the ability to articulate transferable strengths.'
      },
      {
        id: 'q-behav-stakeholder',
        text: `Describe a situation where you had to explain complex quantitative data or metric discrepancies to non-technical stakeholders who were skeptical of the findings.`,
        type: 'behavioral',
        targetSkill: 'Stakeholder Translation & Data Storytelling',
        contextWhy: 'Crucial for analysts who must influence business decisions and simplify technical complexities for leadership.'
      },
      {
        id: 'q-behav-mistake',
        text: `Tell me about a time when your initial analytical hypothesis or project assumption was wrong. How did you diagnose the error and adjust?`,
        type: 'behavioral',
        targetSkill: 'Root Cause Problem Solving & Resilience',
        contextWhy: 'Probes analytical integrity, willingness to follow empirical evidence, and how you handle ambiguity.'
      }
    ];
  }, [state.profile?.targetRole, state.profile?.currentRole, weakestSkills]);

  // Active question list
  const allQuestions = useMemo(() => {
    return customQuestionList.length > 0 ? customQuestionList : defaultQuestions;
  }, [customQuestionList, defaultQuestions]);

  const selectedQuestion = useMemo(() => {
    if (selectedQuestionId) {
      const found = allQuestions.find(q => q.id === selectedQuestionId);
      if (found) return found;
    }
    return allQuestions[0] || null;
  }, [allQuestions, selectedQuestionId]);

  const setSelectedQuestion = (q: QuestionItem | null) => {
    setSelectedQuestionId(q?.id || null);
  };

  const filteredQuestions = useMemo(() => {
    if (activeCategory === 'all') return allQuestions;
    return allQuestions.filter(q => q.type === activeCategory);
  }, [allQuestions, activeCategory]);

  if (!state) {
    return (
      <div className="p-12 text-center text-slate-500">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
        <p>Loading Voice Mock Interviewer...</p>
      </div>
    );
  }

  // Attempts for current selected question (strictly match this question text)
  const currentQuestionAttempts = (state?.interviews || []).filter(
    i => selectedQuestion && i.question === selectedQuestion.text
  );
  const currentAttemptNumber = (currentQuestionAttempts.length || 0) + 1;
  const previousAttempt = currentQuestionAttempts[0] || null;

  // Toggle Voice Recording
  const toggleRecording = () => {
    const rec = recognitionRef.current;
    if (!rec) {
      alert("Speech recognition is not supported in this browser. You can type or paste your answer directly into the text box.");
      return;
    }
    if (isRecording) {
      try {
        rec.stop();
      } catch (_) {}
      setIsRecording(false);
    } else {
      try {
        rec.start();
        setIsRecording(true);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'InvalidStateError') {
          setIsRecording(true);
        } else {
          console.warn('Speech recognition notice:', err);
        }
      }
    }
  };

  // Clean Voice Answer
  const handleCleanSpeech = async (textToClean?: string): Promise<string> => {
    const raw = textToClean || userAnswer;
    if (!raw.trim()) return '';
    setIsCleaning(true);

    try {
      const res = await fetch('/api/ai/clean-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawSpeech: raw,
          context: `Interview answer for target role: ${state.profile.targetRole || 'Junior Data Analyst'}. Question: ${selectedQuestion?.text}`
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to clean speech');

      const cleaned = data.cleanText || data.cleanedSpeech || raw;
      setCleanedAnswer(cleaned);
      return cleaned;
    } catch (err) {
      console.error('Error cleaning speech:', err);
      setCleanedAnswer(raw);
      return raw;
    } finally {
      setIsCleaning(false);
    }
  };

  // Score Against 5-Part Rubric
  const handleScoreInterview = async () => {
    const rawText = userAnswer.trim();
    if (!rawText && !cleanedAnswer.trim()) {
      alert('Please provide or record your spoken answer first.');
      return;
    }

    setIsScoring(true);

    try {
      // Step 1: Ensure transcript is cleaned of fillers before scoring
      let textForScoring = cleanedAnswer.trim();
      if (!textForScoring) {
        textForScoring = await handleCleanSpeech(rawText);
      }
      if (!textForScoring) textForScoring = rawText;

      // Step 2: Call scoring engine
      const res = await fetch('/api/ai/score-interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: selectedQuestion?.text,
          userTranscript: textForScoring,
          targetRole: state.profile.targetRole || 'Junior Data Analyst',
          currentRole: state.profile.currentRole || 'High School Math & Science Teacher',
          targetSkill: selectedQuestion?.targetSkill,
          questionType: selectedQuestion?.type,
          attemptNumber: currentAttemptNumber,
          previousScore: previousAttempt?.rubric?.totalScore || previousAttempt?.scores?.totalScore
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to score interview');

      const previousScoreVal = previousAttempt?.rubric?.totalScore || (previousAttempt?.scores ? Math.round((previousAttempt.scores.totalScore / 20) * 25) : undefined);
      const newScoreVal = data.rubric.totalScore;
      const scoreDelta = typeof previousScoreVal === 'number' ? newScoreVal - previousScoreVal : undefined;

      const newRecord: InterviewRecord = {
        id: `int-${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        timestamp: Date.now(),
        question: selectedQuestion?.text || 'Interview Question',
        questionType: selectedQuestion?.type || 'technical',
        targetSkill: selectedQuestion?.targetSkill,
        userTranscript: textForScoring,
        rawTranscript: rawText || textForScoring,
        cleanedTranscript: textForScoring,
        rubric: data.rubric,
        singleBiggestImprovement: data.singleBiggestImprovement,
        strongerSampleAnswer: data.strongerSampleAnswer,
        attemptNumber: currentAttemptNumber,
        previousScore: previousScoreVal,
        scoreDelta: scoreDelta,
        scores: data.scores,
        feedback: data.feedback
      };

      setLatestEvaluation(newRecord);
      setSelectedHistoricalRecord(null);

      // Save every attempt to persistent state
      const updatedInterviews = [newRecord, ...state.interviews];
      const updatedState = { ...state, interviews: updatedInterviews };
      saveStoredState(updatedState);
      setState(updatedState);
    } catch (err) {
      console.error('Error during scoring:', err);
      alert('Unable to evaluate your interview answer at this time. Please try again.');
    } finally {
      setIsScoring(false);
    }
  };

  // Retry this question
  const handleRetryQuestion = () => {
    // Keep question selected, reset current draft or prepare for revision
    setUserAnswer('');
    setCleanedAnswer('');
    // Scroll smoothly to question intake
    window.scrollTo({ top: 380, behavior: 'smooth' });
  };

  // Generate Questions dynamically with AI
  const handleGenerateAIQuestions = async () => {
    setIsGeneratingQuestions(true);
    try {
      const res = await fetch('/api/ai/generate-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetRole: state.profile.targetRole,
          currentRole: state.profile.currentRole,
          weakestSkills: weakestSkills,
          type: activeCategory
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate questions');

      if (Array.isArray(data.questions) && data.questions.length > 0) {
        setCustomQuestionList(data.questions);
        setSelectedQuestion(data.questions[0]);
        setLatestEvaluation(null);
        setUserAnswer('');
        setCleanedAnswer('');
      }
    } catch (err) {
      console.error('Error generating questions:', err);
    } finally {
      setIsGeneratingQuestions(false);
    }
  };

  // Load realistic sample spoken answer
  const handleLoadSampleSpokenAnswer = () => {
    if (selectedQuestion?.type === 'technical') {
      setUserAnswer(
        "So um, basically when working with SQL queries, like, to find retention cohorts, I start by doing a LEFT JOIN between our users table and their monthly activity logs. Um, you know, instead of writing nested subqueries that slow things down, I use window functions like LAG or LEAD partitioned by user ID and ordered by login date. Like, that lets us calculate the exact day difference between logins. In my previous work, this helped us discover that like 40% of dropoffs happened in week two, so we targeted our alerts there."
      );
    } else {
      setUserAnswer(
        "So um, basically when I was teaching, I had like three, no wait, four classes of students and about a third were failing algebra quizzes. Um, instead of just guessing, you know, I categorized all the mistakes in an Excel sheet. And like, the data showed that 80% of errors came from negative sign mistakes, not the algebra formulas. So I changed our review to spend 15 minutes a day on signs, and our midterm pass rates went up by 18%."
      );
    }
    setCleanedAnswer('');
  };

  const activeRecordToDisplay = selectedHistoricalRecord || latestEvaluation;

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16">
      {/* 1. Header Hero Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-semibold">
            <AudioWaveform className="w-3.5 h-3.5 shrink-0 text-indigo-600 dark:text-indigo-400" />
            <span>Targeted Interview Readiness Engine</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Voice Mock Interview
          </h1>

          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
            Practice answering real hiring questions tailored to your target role (<strong className="text-slate-900 dark:text-slate-200">{state.profile.targetRole || 'Junior Data Analyst'}</strong>) and your weakest skill gaps. Speak naturally—our voice cleaner removes fillers before an objective 5-part rubric grades your response.
          </p>

          {weakestSkills.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
              <span className="text-slate-500 font-medium">Testing Weakest Gaps:</span>
              {weakestSkills.slice(0, 3).map((gap, idx) => (
                <span key={idx} className="px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 font-medium border border-rose-200 dark:border-rose-900/60">
                  {gap}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row md:flex-col gap-2.5 shrink-0">
          <button
            onClick={handleLoadSampleSpokenAnswer}
            className="inline-flex items-center justify-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            <Sparkles className="w-4 h-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
            <span>Load Demo Spoken Answer (With Fillers)</span>
          </button>

          <button
            onClick={handleGenerateAIQuestions}
            disabled={isGeneratingQuestions}
            className="inline-flex items-center justify-center gap-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 px-4 py-2.5 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
          >
            {isGeneratingQuestions ? <RefreshCw className="w-4 h-4 shrink-0 animate-spin" /> : <Brain className="w-4 h-4 shrink-0" />}
            <span>{isGeneratingQuestions ? 'Generating...' : 'AI Generate Questions for My Gaps'}</span>
          </button>
        </div>
      </div>

      {/* 2. Question Selection Section */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Step 1: Pick a Question
            </span>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Targeted Technical & Behavioral Questions
            </h2>
          </div>

          {/* Category Filter Tabs */}
          <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                activeCategory === 'all'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All ({allQuestions.length})
            </button>
            <button
              onClick={() => setActiveCategory('technical')}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                activeCategory === 'technical'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Technical
            </button>
            <button
              onClick={() => setActiveCategory('behavioral')}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                activeCategory === 'behavioral'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Behavioral
            </button>
          </div>
        </div>

        {/* Question Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredQuestions.map((q) => {
            const isSelected = selectedQuestion?.id === q.id;
            const pastAttemptsForQ = state.interviews.filter(i => i.question === q.text);
            const bestScore = pastAttemptsForQ.length > 0 
              ? Math.max(...pastAttemptsForQ.map(i => i.rubric?.totalScore || 0))
              : null;

            return (
              <div
                key={q.id}
                onClick={() => {
                  setSelectedQuestion(q);
                  setLatestEvaluation(null);
                  setSelectedHistoricalRecord(null);
                  setUserAnswer('');
                  setCleanedAnswer('');
                }}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                  isSelected
                    ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 ring-2 ring-indigo-500/20 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                      q.type === 'technical'
                        ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300'
                        : 'bg-indigo-100 dark:bg-indigo-950/70 text-indigo-800 dark:text-indigo-300'
                    }`}>
                      {q.type}
                    </span>

                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate max-w-[180px]">
                      Target: {q.targetSkill}
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white leading-snug">
                    {q.text}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-800/80 text-[11px]">
                  <span className="text-slate-500 dark:text-slate-400 italic text-[11px] line-clamp-1">
                    {q.contextWhy}
                  </span>

                  {bestScore !== null && (
                    <span className="shrink-0 px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-[10px]">
                      Best: {bestScore}/25
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Selected Question Intake & Voice Recorder */}
      {selectedQuestion && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
          {/* Active Question Banner */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                  selectedQuestion.type === 'technical'
                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                    : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300'
                }`}>
                  {selectedQuestion.type} Question
                </span>

                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Testing Skill: <strong className="text-indigo-600 dark:text-indigo-400">{selectedQuestion.targetSkill}</strong>
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                <span>Attempt #{currentAttemptNumber}</span>
                {previousAttempt && (
                  <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900 font-semibold text-[11px]">
                    Previous: {previousAttempt.rubric?.totalScore || 18}/25
                  </span>
                )}
              </div>
            </div>

            <p className="text-base font-bold text-slate-900 dark:text-white leading-relaxed">
              &ldquo;{selectedQuestion.text}&rdquo;
            </p>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              <strong className="text-slate-700 dark:text-slate-300">Why hiring managers ask this:</strong> {selectedQuestion.contextWhy}
            </p>
          </div>

          {/* Voice Input Controls */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Step 2: Spoken Response
              </label>

              <div className="flex items-center gap-2">
                <button
                  onClick={toggleRecording}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs ${
                    isRecording 
                      ? 'bg-rose-500 text-white animate-pulse' 
                      : 'bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 text-white'
                  }`}
                >
                  {isRecording ? <MicOff className="w-4 h-4 shrink-0" /> : <Mic className="w-4 h-4 shrink-0 text-rose-400 dark:text-rose-600" />}
                  <span>{isRecording ? 'Listening (Click to Stop)' : 'Record Voice Answer'}</span>
                </button>
              </div>
            </div>

            {/* Transcript Area */}
            <div className="relative">
              <textarea
                rows={4}
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                placeholder="Click 'Record Voice Answer' or paste/type your answer here. Don't worry about verbal fillers ('um', 'like', 'you know')—our speech cleaner removes them automatically before grading..."
                className="w-full p-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs sm:text-sm text-slate-900 dark:text-white leading-relaxed focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>

            {/* Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {userAnswer.trim() ? (
                  <span>{userAnswer.trim().split(/\s+/).filter(Boolean).length} words recorded</span>
                ) : (
                  <span>Awaiting voice answer or text input</span>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => handleCleanSpeech()}
                  disabled={isCleaning || !userAnswer.trim()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {isCleaning ? <RefreshCw className="w-3.5 h-3.5 shrink-0 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 shrink-0 text-indigo-600 dark:text-indigo-400" />}
                  <span>{isCleaning ? 'Cleaning Fillers...' : 'Clean Spoken Fillers'}</span>
                </button>

                <button
                  onClick={handleScoreInterview}
                  disabled={isScoring || (!userAnswer.trim() && !cleanedAnswer.trim())}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-all cursor-pointer shadow-sm hover:shadow-md"
                >
                  {isScoring ? <RefreshCw className="w-3.5 h-3.5 shrink-0 animate-spin" /> : <Trophy className="w-3.5 h-3.5 shrink-0" />}
                  <span>{isScoring ? 'Scoring...' : 'Score Against 5-Part Rubric'}</span>
                </button>
              </div>
            </div>

            {/* Cleaned Transcript Preview Box */}
            {cleanedAnswer && (
              <div className="mt-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-1.5">
                <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 font-semibold">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span>Cleaned Transcript (Fillers & Self-Corrections Resolved):</span>
                  </div>
                  <span className="text-[11px] font-normal text-slate-500">Sent to scoring engine</span>
                </div>
                <p className="text-slate-800 dark:text-slate-200 leading-relaxed italic">
                  &ldquo;{cleanedAnswer}&rdquo;
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Loading state indicator during AI evaluation */}
      {isScoring && (
        <AILoadingIndicator
          title="Grading Spoken Answer Against Fixed 5-Part Rubric..."
          stages={[
            "Cleaning verbal fillers, hesitation tokens, and false starts...",
            "Evaluating Relevance (1-5) and alignment to target role...",
            "Checking STAR framework structure and narrative progression...",
            "Validating specific quantitative examples and metric outcomes...",
            "Auditing technical accuracy and domain-specific terminology...",
            "Synthesizing clarity score, biggest improvement, and model answer..."
          ]}
        />
      )}

      {/* 4. Objective 5-Part Rubric Scorecard */}
      {activeRecordToDisplay && !isScoring && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          {/* Score Header & Progression Badge */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 px-2.5 py-0.5 rounded-md">
                  Official Scorecard • Attempt #{activeRecordToDisplay.attemptNumber}
                </span>

                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {activeRecordToDisplay.date}
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-1">
                Hiring Manager 5-Part Rubric Assessment
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Score Progression Alert Banner if retrying */}
              {typeof activeRecordToDisplay.scoreDelta === 'number' && (
                <div className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 ${
                  activeRecordToDisplay.scoreDelta > 0
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                    : activeRecordToDisplay.scoreDelta === 0
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                }`}>
                  <TrendingUp className="w-4 h-4 shrink-0" />
                  <span>
                    {activeRecordToDisplay.scoreDelta > 0
                      ? `Score went up by +${activeRecordToDisplay.scoreDelta} points! (${activeRecordToDisplay.rubric.totalScore}/25 vs ${activeRecordToDisplay.previousScore}/25)`
                      : activeRecordToDisplay.scoreDelta === 0
                      ? `Score maintained (${activeRecordToDisplay.rubric.totalScore}/25)`
                      : `Score shifted by ${activeRecordToDisplay.scoreDelta} points (${activeRecordToDisplay.rubric.totalScore}/25)`
                    }
                  </span>
                </div>
              )}

              {/* Total Score Badge */}
              <div className="flex items-center gap-2.5 bg-slate-900 dark:bg-slate-800 text-white px-5 py-2.5 rounded-2xl shadow-xs">
                <Trophy className="w-5 h-5 shrink-0 text-amber-400" />
                <div>
                  <div className="text-2xl font-black leading-none">
                    {activeRecordToDisplay.rubric.totalScore}
                    <span className="text-xs font-medium text-slate-400"> / {activeRecordToDisplay.rubric.maxScore}</span>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-300 font-semibold">
                    Total Score
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 5-Part Rubric Breakdown Table/Cards */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                5-Part Evaluation Criteria (1-5 Each with Specific Rationale)
              </h3>
              <span className="text-xs font-semibold text-slate-500">
                Passing Benchmark: 18/25
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {/* Criterion 1: Relevance */}
              <RubricCriterionCard
                index="1"
                title="Relevance"
                description="Prompt alignment & role focus"
                criterion={activeRecordToDisplay.rubric.relevance}
              />

              {/* Criterion 2: Structure */}
              <RubricCriterionCard
                index="2"
                title="Structure"
                description="Logical STAR progression"
                criterion={activeRecordToDisplay.rubric.structure}
              />

              {/* Criterion 3: Specific Examples */}
              <RubricCriterionCard
                index="3"
                title="Specific Examples"
                description="Concrete data & metrics"
                criterion={activeRecordToDisplay.rubric.specificExamples}
              />

              {/* Criterion 4: Technical Accuracy */}
              <RubricCriterionCard
                index="4"
                title="Technical Accuracy"
                description="Target domain vocabulary"
                criterion={activeRecordToDisplay.rubric.technicalAccuracy}
              />

              {/* Criterion 5: Clarity */}
              <RubricCriterionCard
                index="5"
                title="Clarity"
                description="Conciseness & flow"
                criterion={activeRecordToDisplay.rubric.clarity}
              />
            </div>
          </div>

          {/* Single Biggest Improvement & Retry Callout */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-300/60 dark:border-amber-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                <Sparkles className="w-4 h-4 shrink-0" />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                  Single Biggest Improvement
                </span>
                <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white leading-relaxed">
                  {activeRecordToDisplay.singleBiggestImprovement}
                </p>
              </div>
            </div>

            <button
              onClick={handleRetryQuestion}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 transition-all cursor-pointer shadow-sm hover:shadow-md shrink-0"
            >
              <RotateCcw className="w-4 h-4 shrink-0" />
              <span>Retry This Question</span>
            </button>
          </div>

          {/* Stronger Sample Model Answer */}
          <div className="p-5 rounded-2xl bg-slate-900 text-white space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>Stronger Sample Model Answer (Hiring Manager Standard)</span>
              </div>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(activeRecordToDisplay.strongerSampleAnswer);
                  setCopiedSample(true);
                  setTimeout(() => setCopiedSample(false), 2000);
                }}
                className="inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                {copiedSample ? <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <Copy className="w-3.5 h-3.5 shrink-0" />}
                <span>{copiedSample ? 'Copied' : 'Copy Sample'}</span>
              </button>
            </div>

            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed italic bg-slate-950/60 p-4 rounded-xl border border-slate-800">
              &ldquo;{activeRecordToDisplay.strongerSampleAnswer}&rdquo;
            </p>
          </div>
        </div>
      )}

      {/* 5. Persistent Attempt History & Progression Log */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Recorded Attempt History ({state.interviews.length} Total Attempts)
            </h3>
          </div>
          <span className="text-xs text-slate-500">Every voice attempt is saved to local storage</span>
        </div>

        {state.interviews.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No interview attempts recorded yet. Select a question above and record your first voice answer!
          </div>
        ) : (
          <div className="space-y-2.5">
            {state.interviews.map((item, idx) => {
              const score = item.rubric?.totalScore || item.scores?.totalScore || 18;
              const maxScore = item.rubric?.maxScore || 25;
              const isSelected = activeRecordToDisplay?.id === item.id;

              return (
                <div
                  key={item.id || idx}
                  onClick={() => setSelectedHistoricalRecord(item)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-indigo-50/60 dark:bg-indigo-950/40 border-indigo-500 ring-1 ring-indigo-500/30'
                      : 'bg-slate-50/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                        Attempt #{item.attemptNumber || (state.interviews.length - idx)}
                      </span>
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {item.date}
                      </span>
                      {typeof item.scoreDelta === 'number' && item.scoreDelta !== 0 && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          item.scoreDelta > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {item.scoreDelta > 0 ? `+${item.scoreDelta}` : item.scoreDelta} pts
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-medium text-slate-800 dark:text-slate-200 line-clamp-1">
                      {item.question}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="text-sm font-black text-slate-900 dark:text-white">
                        {score}/{maxScore}
                      </div>
                      <span className="text-[10px] text-slate-500 font-medium">
                        {score >= 21 ? 'Strong' : score >= 17 ? 'Good' : 'Needs Practice'}
                      </span>
                    </div>

                    <ChevronRight className="w-4 h-4 shrink-0 text-slate-400" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Sub-component for individual rubric criterion
function RubricCriterionCard({
  index,
  title,
  description,
  criterion
}: {
  index: string;
  title: string;
  description: string;
  criterion?: RubricCriterion;
}) {
  const score = criterion?.score || 3;
  const reason = criterion?.reason || 'Evaluation complete against target expectations.';

  const scoreColor = 
    score >= 5 ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/70 border-emerald-200 dark:border-emerald-800' :
    score === 4 ? 'text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/70 border-indigo-200 dark:border-indigo-800' :
    score === 3 ? 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/70 border-amber-200 dark:border-amber-800' :
    'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/70 border-rose-200 dark:border-rose-800';

  const barColor = 
    score >= 5 ? 'bg-emerald-500' :
    score === 4 ? 'bg-indigo-500' :
    score === 3 ? 'bg-amber-500' :
    'bg-rose-500';

  const percent = Math.round((score / 5) * 100);

  return (
    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex flex-col justify-between gap-2.5">
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {index}. {title}
          </span>
          <span className={`text-[11px] font-black px-2 py-0.5 rounded-md border ${scoreColor}`}>
            {score}/5
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${percent}%` }}
          />
        </div>

        <p className="text-[10px] text-slate-500 dark:text-slate-400">
          {description}
        </p>
      </div>

      <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
        <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-snug">
          {reason}
        </p>
      </div>
    </div>
  );
}
