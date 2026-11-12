'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  AudioWaveform, 
  Mic, 
  MicOff, 
  Trophy, 
  ChevronRight, 
  TrendingUp, 
  Check, 
  Copy, 
  History,
  AlertCircle
} from 'lucide-react';
import { useAppState, saveStoredState } from '@/lib/storage';
import { InterviewRecord, RubricCriterion } from '@/types';
import AILoadingIndicator from '@/components/AILoadingIndicator';
import EmptyState from '@/components/EmptyState';
import { apiFetch } from '@/lib/apiClient';

interface QuestionItem {
  id: string;
  text: string;
  type: 'technical' | 'behavioral';
  targetSkill: string;
  contextWhy: string;
}

export default function MockInterviewPage() {
  const [state, setState] = useAppState();
  const [questionIndex, setQuestionIndex] = useState(0);
  const [customQuestionList, setCustomQuestionList] = useState<QuestionItem[]>([]);
  
  // Voice & Input states
  const [userAnswer, setUserAnswer] = useState<string>('');
  const [cleanedAnswer, setCleanedAnswer] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isScoring, setIsScoring] = useState<boolean>(false);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Evaluation tracking
  const [latestEvaluation, setLatestEvaluation] = useState<InterviewRecord | null>(null);
  const [selectedHistoricalRecord, setSelectedHistoricalRecord] = useState<InterviewRecord | null>(null);
  const [copiedSample, setCopiedSample] = useState<boolean>(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
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

      recognition.onerror = () => {
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
        } catch {}
      }
    };
  }, []);

  const gapSkills = state?.skillGapMap?.skills;
  const weakestSkills = useMemo(() => {
    if (!gapSkills || !Array.isArray(gapSkills)) return [];
    return gapSkills
      .filter(s => s && (s.matchStatus === 'lacks' || s.matchStatus === 'partly' || s.gapSeverity === 'Critical'))
      .map(s => s.skillName)
      .filter(Boolean);
  }, [gapSkills]);

  const defaultQuestions: QuestionItem[] = useMemo(() => {
    const role = state?.profile?.targetRole || 'Target Role';
    return [
      {
        id: 'q-default-1',
        text: `Tell me about a time you solved a complex problem or improved a workflow relevant to ${role}.`,
        type: 'behavioral',
        targetSkill: 'Problem Solving',
        contextWhy: 'Evaluates your structured thinking and past ownership.'
      },
      {
        id: 'q-default-2',
        text: `Walk me through how you approach analyzing requirements and selecting tools for a project in ${role}.`,
        type: 'technical',
        targetSkill: 'Technical Execution',
        contextWhy: 'Evaluates your technical depth and ability to explain workflows.'
      }
    ];
  }, [state?.profile?.targetRole]);

  const allQuestions = customQuestionList.length > 0 ? customQuestionList : defaultQuestions;
  const selectedQuestion = allQuestions[questionIndex % allQuestions.length] || allQuestions[0];

  if (!state) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-slate-500 text-sm">
          Loading...
        </div>
      </div>
    );
  }

  if (!state.profile.targetRole) {
    return (
      <div className="space-y-8 max-w-5xl mx-auto pb-16">
        <EmptyState
          icon={AudioWaveform}
          title="Target Role Required"
          description="Set your target role in Profile to unlock interview practice."
          action={{
            label: "Go to Profile",
            href: "/profile"
          }}
        />
      </div>
    );
  }

  const currentQuestionAttempts = (state?.interviews || []).filter(
    i => selectedQuestion && i.question === selectedQuestion.text
  );
  const currentAttemptNumber = (currentQuestionAttempts.length || 0) + 1;
  const previousAttempt = currentQuestionAttempts[0] || null;

  const toggleRecording = () => {
    const rec = recognitionRef.current;
    if (!rec) {
      setErrorMessage("Speech recognition is not supported in this browser. You can type directly into the box.");
      return;
    }
    if (isRecording) {
      try {
        rec.stop();
      } catch {}
      setIsRecording(false);
    } else {
      try {
        rec.start();
        setIsRecording(true);
      } catch {
        setIsRecording(true);
      }
    }
  };

  const handleNextQuestion = async () => {
    setErrorMessage(null);
    setUserAnswer('');
    setCleanedAnswer('');
    setLatestEvaluation(null);
    setSelectedHistoricalRecord(null);

    // If we have more questions in the current list, simply advance
    if (questionIndex + 1 < allQuestions.length) {
      setQuestionIndex(prev => prev + 1);
      return;
    }

    // Otherwise, fetch more questions
    if (!state?.profile?.targetRole) {
      setQuestionIndex(prev => prev + 1);
      return;
    }

    setIsGeneratingQuestions(true);
    try {
      const res = await apiFetch('/api/ai/generate-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetRole: state.profile.targetRole,
          currentRole: state.profile.currentRole,
          weakestSkills: weakestSkills,
          type: 'all'
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.questions) && data.questions.length > 0) {
          setCustomQuestionList(prev => [...prev, ...data.questions]);
          setQuestionIndex(prev => prev + 1);
        } else {
          setQuestionIndex(prev => prev + 1);
        }
      } else {
        setQuestionIndex(prev => prev + 1);
      }
    } catch {
      setQuestionIndex(prev => prev + 1);
    } finally {
      setIsGeneratingQuestions(false);
    }
  };

  const handleScoreInterview = async () => {
    const rawText = userAnswer.trim();
    if (!rawText && !cleanedAnswer.trim()) {
      setErrorMessage('Please record or type your answer first.');
      return;
    }

    setIsScoring(true);
    setErrorMessage(null);

    try {
      let textForScoring = cleanedAnswer.trim();
      if (!textForScoring) {
        try {
          const cleanRes = await apiFetch('/api/ai/clean-speech', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              rawSpeech: rawText,
              context: `Interview answer for target role: ${state.profile.targetRole}. Question: ${selectedQuestion?.text}`
            })
          });
          if (cleanRes.ok) {
            const cleanData = await cleanRes.json();
            textForScoring = cleanData.cleanText || cleanData.cleanedSpeech || rawText;
            setCleanedAnswer(textForScoring);
          } else {
            textForScoring = rawText;
          }
        } catch {
          textForScoring = rawText;
        }
      }

      const res = await apiFetch('/api/ai/score-interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: selectedQuestion?.text,
          userTranscript: textForScoring,
          targetRole: state.profile.targetRole || 'Target Role',
          currentRole: state.profile.currentRole || '',
          targetSkill: selectedQuestion?.targetSkill,
          questionType: selectedQuestion?.type,
          attemptNumber: currentAttemptNumber,
          previousScore: previousAttempt?.rubric?.totalScore || previousAttempt?.scores?.totalScore
        })
      });

      if (!res.ok) throw new Error();
      const data = await res.json();

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

      const updatedInterviews = [newRecord, ...state.interviews];
      const updatedState = { ...state, interviews: updatedInterviews };
      saveStoredState(updatedState);
      setState(updatedState);
    } catch {
      setErrorMessage('Something went wrong. Please try again.');
    } finally {
      setIsScoring(false);
    }
  };

  const activeRecordToDisplay = selectedHistoricalRecord || latestEvaluation;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Mock Interview</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Practice answering questions aloud.
          </p>
        </div>

        {/* The two allowed AI actions: "Next question" and "Score my answer" */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleNextQuestion}
            disabled={isGeneratingQuestions || isScoring}
            type="button"
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
          >
            {isGeneratingQuestions ? 'Loading...' : 'Next question'}
          </button>

          <button
            onClick={handleScoreInterview}
            disabled={isScoring || (!userAnswer.trim() && !cleanedAnswer.trim())}
            type="button"
            className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-all cursor-pointer shadow-xs"
          >
            {isScoring ? 'Scoring...' : 'Score my answer'}
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs flex items-center gap-2.5">
          <AlertCircle size={16} className="text-rose-600 shrink-0" />
          <span className="font-medium">{errorMessage}</span>
        </div>
      )}

      {isScoring && (
        <AILoadingIndicator />
      )}

      {/* Active Question & Voice Input Card */}
      {selectedQuestion ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                {selectedQuestion.type} Question
              </span>
              <span className="text-slate-400">•</span>
              <span className="text-xs text-slate-500">
                Skill: {selectedQuestion.targetSkill}
              </span>
            </div>

            <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-relaxed">
              &ldquo;{selectedQuestion.text}&rdquo;
            </h2>

            {selectedQuestion.contextWhy && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {selectedQuestion.contextWhy}
              </p>
            )}
          </div>

          {/* Voice Input */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Your Answer
              </label>

              <button
                type="button"
                onClick={toggleRecording}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isRecording 
                    ? 'bg-rose-600 text-white animate-pulse' 
                    : 'bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 text-white'
                }`}
              >
                {isRecording ? <MicOff size={14} /> : <Mic size={14} className="text-rose-400 dark:text-rose-600" />}
                <span>{isRecording ? 'Stop Recording' : 'Record Voice Answer'}</span>
              </button>
            </div>

            <textarea
              rows={5}
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              placeholder="Record your spoken response, or type here..."
              className="w-full p-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs sm:text-sm text-slate-900 dark:text-white leading-relaxed focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>
        </div>
      ) : (
        <EmptyState
          icon={AudioWaveform}
          title="No Question Loaded"
          description="Click Next question to load an interview question."
          action={{
            label: "Next question",
            onClick: handleNextQuestion
          }}
        />
      )}

      {/* Assessment Scorecard */}
      {activeRecordToDisplay && !isScoring && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <span className="text-xs text-slate-400">
                Attempt #{activeRecordToDisplay.attemptNumber} • {activeRecordToDisplay.date}
              </span>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                Feedback & Score
              </h2>
            </div>

            <div className="flex items-center gap-3">
              {typeof activeRecordToDisplay.scoreDelta === 'number' && (
                <div className={`px-3 py-1 rounded-xl text-xs font-bold border flex items-center gap-1.5 ${
                  activeRecordToDisplay.scoreDelta > 0
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}>
                  <TrendingUp size={14} className="shrink-0" />
                  <span>
                    {activeRecordToDisplay.scoreDelta > 0
                      ? `+${activeRecordToDisplay.scoreDelta} pts improvement`
                      : 'Score maintained'}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2 bg-slate-900 dark:bg-slate-800 text-white px-4 py-2 rounded-xl">
                <Trophy size={16} className="text-amber-400" />
                <span className="text-lg font-bold">
                  {activeRecordToDisplay.rubric.totalScore}
                  <span className="text-xs text-slate-400"> / {activeRecordToDisplay.rubric.maxScore}</span>
                </span>
              </div>
            </div>
          </div>

          {/* 5 Criteria */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            <CriterionCard
              index="1"
              title="Relevance"
              criterion={activeRecordToDisplay.rubric.relevance}
            />
            <CriterionCard
              index="2"
              title="Structure"
              criterion={activeRecordToDisplay.rubric.structure}
            />
            <CriterionCard
              index="3"
              title="Specific Examples"
              criterion={activeRecordToDisplay.rubric.specificExamples}
            />
            <CriterionCard
              index="4"
              title="Technical Accuracy"
              criterion={activeRecordToDisplay.rubric.technicalAccuracy}
            />
            <CriterionCard
              index="5"
              title="Clarity"
              criterion={activeRecordToDisplay.rubric.clarity}
            />
          </div>

          {/* Biggest Improvement */}
          {activeRecordToDisplay.singleBiggestImprovement && (
            <div className="p-4 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 space-y-1">
              <span className="text-xs font-bold text-amber-900 dark:text-amber-300">
                Key Improvement
              </span>
              <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
                {activeRecordToDisplay.singleBiggestImprovement}
              </p>
            </div>
          )}

          {/* Sample Model Answer */}
          {activeRecordToDisplay.strongerSampleAnswer && (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Sample Answer
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(activeRecordToDisplay.strongerSampleAnswer);
                    setCopiedSample(true);
                    setTimeout(() => setCopiedSample(false), 2000);
                  }}
                  className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                >
                  {copiedSample ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                  <span>{copiedSample ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 italic leading-relaxed">
                &ldquo;{activeRecordToDisplay.strongerSampleAnswer}&rdquo;
              </p>
            </div>
          )}
        </div>
      )}

      {/* Attempt History */}
      {state.interviews.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <History size={16} className="text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Attempt History ({state.interviews.length})
            </h3>
          </div>

          <div className="space-y-2">
            {state.interviews.map((item, idx) => {
              const score = item.rubric?.totalScore || item.scores?.totalScore || 18;
              const maxScore = item.rubric?.maxScore || 25;
              const isSelected = activeRecordToDisplay?.id === item.id;

              return (
                <div
                  key={item.id || idx}
                  onClick={() => setSelectedHistoricalRecord(item)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-indigo-50/60 dark:bg-indigo-950/40 border-indigo-500'
                      : 'bg-slate-50/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="space-y-0.5 truncate">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block truncate">
                      {item.question}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {item.date} • Attempt #{item.attemptNumber || (state.interviews.length - idx)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {score}/{maxScore}
                    </span>
                    <ChevronRight size={14} className="text-slate-400" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function CriterionCard({
  index,
  title,
  criterion
}: {
  index: string;
  title: string;
  criterion?: RubricCriterion;
}) {
  const score = criterion?.score || 3;
  const reason = criterion?.reason || 'Evaluation complete.';

  return (
    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex flex-col justify-between gap-2">
      <div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {index}. {title}
          </span>
          <span className="text-xs font-bold text-slate-900 dark:text-white">
            {score}/5
          </span>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-snug">
          {reason}
        </p>
      </div>
    </div>
  );
}
