import React, { useState, useEffect, useRef } from 'react';
import Sidebar from '../Component/Sidebar';
import EditorArea from '../Component/EditorArea';
import OCRUpload from '../Component/OCRUpload';
import ResultCard from '../Component/ResultCard';
import { useAuth } from '../context/AuthContext';
import { useGrading } from '../context/GradingContext';
import { useNavigate } from 'react-router-dom';
import type { ScoreResult } from '../types';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { addJob } = useGrading();
  const [currentTask, setCurrentTask] = useState<number>(2);
  const [questions, setQuestions] = useState<{ [key: number]: string }>({ 1: '', 2: '' });
  const [imageUrls, setImageUrls] = useState<{ [key: number]: string | undefined }>({ 1: undefined, 2: undefined });
  const [essays, setEssays] = useState<{ [key: number]: string }>({ 1: '', 2: '' });
  const [inputMode, setInputMode] = useState<'text' | 'upload'>('text');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [results, setResults] = useState<{ [key: number]: ScoreResult } | null>(null);
  const [examData, setExamData] = useState<any>(null);
  const { user, isAuthenticated } = useAuth();

  // Practice mode states
  const [isPracticeMode, setIsPracticeMode] = useState(false);
  const [practiceMode, setPracticeMode] = useState<string>('task2'); // task1 | task2 | both
  const [timeLimitSeconds, setTimeLimitSeconds] = useState<number>(0); // 0 = count up
  const [elapsed, setElapsed] = useState<number>(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isTimeUp, setIsTimeUp] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Load exam on mount from URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const passedExamId = urlParams.get('exam_id');
    const passedTaskMode = urlParams.get('mode');
    const passedTime = urlParams.get('time'); // minutes

    if (passedExamId && passedTaskMode) {
      setIsPracticeMode(true);
      setPracticeMode(passedTaskMode);
      const timeSeconds = passedTime ? parseInt(passedTime) * 60 : 0;
      setTimeLimitSeconds(timeSeconds);

      const fetchExamDetail = async () => {
        try {
          const res = await fetch(`http://localhost:8000/api/exam/detail/${passedExamId}`);
          if (res.ok) {
            const data = await res.json();
            setExamData(data);

            const newQuestions: { [key: number]: string } = { 1: '', 2: '' };
            const newImageUrls: { [key: number]: string | undefined } = { 1: undefined, 2: undefined };

            if (data.task1) {
              newQuestions[1] = data.task1.prompt;
              newImageUrls[1] = data.task1.image_url || undefined;
            }
            if (data.task2) {
              newQuestions[2] = data.task2.prompt;
            }
            setQuestions(newQuestions);
            setImageUrls(newImageUrls);

            // Set initial active task
            const initialTask = passedTaskMode === 'task2' ? 2 : 1;
            setCurrentTask(initialTask);
          }
        } catch (err) {
          console.error('Failed to fetch exam for practice:', err);
        }
      };
      fetchExamDetail();
    }
  }, []);

  // Start timer once examData is loaded
  useEffect(() => {
    if (isPracticeMode && examData && !isTimerRunning) {
      setIsTimerRunning(true);
    }
  }, [isPracticeMode, examData]);

  // Timer tick
  useEffect(() => {
    if (!isTimerRunning) return;

    timerRef.current = setInterval(() => {
      if (timeLimitSeconds > 0) {
        // Countdown
        setElapsed(prev => {
          const nextElapsed = prev + 1;
          if (nextElapsed >= timeLimitSeconds) {
            clearInterval(timerRef.current!);
            setIsTimerRunning(false);
            setIsTimeUp(true);
          }
          return nextElapsed;
        });
      } else {
        // Count up
        setElapsed(prev => prev + 1);
      }
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTimerRunning, timeLimitSeconds]);

  // Switch task in practice mode
  useEffect(() => {
    if (examData && isPracticeMode) {
      if (currentTask === 1 && examData.task1) {
        setQuestions(prev => ({ ...prev, 1: examData.task1.prompt }));
        setImageUrls(prev => ({ ...prev, 1: examData.task1.image_url || undefined }));
      } else if (currentTask === 2 && examData.task2) {
        setQuestions(prev => ({ ...prev, 2: examData.task2.prompt }));
        setImageUrls(prev => ({ ...prev, 2: undefined }));
      }
    }
  }, [currentTask, examData]);

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const displayTime = () => {
    if (timeLimitSeconds > 0) {
      const remaining = Math.max(0, timeLimitSeconds - elapsed);
      return formatTimer(remaining);
    }
    return formatTimer(elapsed);
  };

  const isCountdown = timeLimitSeconds > 0;
  const timerWarning = isCountdown && (timeLimitSeconds - elapsed) <= 120; // < 2 min warning

  // Handle submit - either single task (normal mode) or multi-task (practice mode)
  const handleSubmit = async () => {
    if (isPracticeMode) {
      await handlePracticeSubmit();
    } else {
      await handleSingleSubmit();
    }
  };

  const handleSingleSubmit = async () => {
    const currentEssay = essays[currentTask];
    const currentQuestion = questions[currentTask];
    if (!currentEssay || !currentQuestion) {
      alert('Vui lòng nhập đầy đủ câu hỏi và nội dung bài làm.');
      return;
    }
    
    const currentTasks: any = {
      [currentTask.toString()]: { essay: currentEssay, question: currentQuestion, status: "draft" }
    };

    addJob(
      "quick-score",
      `IELTS Writing Task ${currentTask}`,
      currentTasks,
      currentTask === 1 ? "task1" : "task2",
      0,
      null,
      "practice"
    );

    navigate('/library');
  };

  const handlePracticeSubmit = async () => {
    // Stop timer
    if (timerRef.current) clearInterval(timerRef.current);
    setIsTimerRunning(false);
    setIsTimeUp(false);

    const tasksToSubmit: number[] = [];
    if ((practiceMode === 'task1' || practiceMode === 'both') && essays[1].trim()) tasksToSubmit.push(1);
    if ((practiceMode === 'task2' || practiceMode === 'both') && essays[2].trim()) tasksToSubmit.push(2);

    if (tasksToSubmit.length === 0) {
      alert('Bạn chưa viết bài nào. Vui lòng nhập bài làm trước khi nộp!');
      return;
    }

    const currentTasks: any = {};
    if (practiceMode === 'task1' || practiceMode === 'both') {
      currentTasks["1"] = { essay: essays[1], question: questions[1], status: essays[1].trim() ? "draft" : "not_started" };
    }
    if (practiceMode === 'task2' || practiceMode === 'both') {
      currentTasks["2"] = { essay: essays[2], question: questions[2], status: essays[2].trim() ? "draft" : "not_started" };
    }

    addJob(
      examData?.id || "quick-score",
      examData?.title || (practiceMode === 'both' ? 'Full Exam' : `Writing ${practiceMode}`),
      currentTasks,
      practiceMode,
      timeLimitSeconds > 0 ? (timeLimitSeconds - elapsed) : elapsed,
      examData?.id || null,
      "practice"
    );

    navigate('/library');
  };

  const handleTimeUpAction = (action: 'submit' | 'exit') => {
    setIsTimeUp(false);
    if (action === 'submit') handlePracticeSubmit();
  };

  return (
    <div className="flex min-h-screen bg-[#f9fafb]">
      <Sidebar 
        currentTask={currentTask} 
        setTask={setCurrentTask} 
        isPracticeMode={isPracticeMode}
        practiceMode={practiceMode}
      />

      <main className="flex-1 lg:ml-64 px-6 py-10 lg:px-16 overflow-y-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-12 animate-fade-in">
          <div>
            <h1 className="text-4xl font-bold font-display text-slate-800 tracking-tight">
              IELTS Writing Task {currentTask}
            </h1>
            <p className="text-slate-400 text-sm mt-1 font-medium">
              {isPracticeMode ? 'Chế độ luyện tập có giới hạn thời gian' : 'Phân tích và chấm điểm bài viết tự động bằng AI'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {isPracticeMode && (
              <>
                {/* Timer display */}
                <div className={`px-5 py-2 rounded-xl border shadow-sm flex items-center gap-2 font-mono font-bold text-lg transition-colors ${
                  timerWarning ? 'bg-red-50 border-red-300 text-red-600 animate-pulse' : 'bg-white border-slate-200 text-slate-800'
                }`}>
                  <i className={`fas fa-clock text-sm ${timerWarning ? 'text-red-500' : 'text-slate-400'}`}></i>
                  {displayTime()}
                </div>
                {/* Submit button */}
                <button
                  onClick={handleSubmit}
                  className="btn-premium group"
                >
                  <span>Nộp bài chấm điểm</span>
                  <i className="fas fa-arrow-right text-xs group-hover:translate-x-1 transition-transform"></i>
                </button>
              </>
            )}
            {!isPracticeMode && (
              <>
                <div className="h-8 w-[1px] bg-slate-200 mx-2"></div>
                <div className="px-4 py-2 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center gap-2">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                  <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">IELTS WRITING Online</span>
                </div>
              </>
            )}
          </div>
        </header>

        <section className="max-w-6xl mx-auto pb-20">
          {inputMode === 'text' ? (
            <EditorArea
              question={questions[currentTask] || ''}
              essay={essays[currentTask] || ''}
              imageUrl={imageUrls[currentTask]}
              isPracticeMode={isPracticeMode}
              setQuestion={val => setQuestions(prev => ({ ...prev, [currentTask]: val }))}
              setEssay={val => setEssays(prev => ({ ...prev, [currentTask]: val }))}
              inputMode={inputMode}
              setInputMode={setInputMode}
              onSubmit={handleSubmit}
            />
          ) : (
            <div className="card-premium p-10 bg-white">
              <div className="flex justify-between items-center mb-10 pb-5 border-b border-slate-50">
                <h2 className="text-xl font-bold text-slate-800">Trích xuất văn bản từ ảnh</h2>
                <button
                  onClick={() => setInputMode('text')}
                  className="text-xs font-bold text-primary hover:underline uppercase tracking-widest"
                >
                  Quay lại nhập liệu →
                </button>
              </div>
              <OCRUpload
                onExtractedText={(text) => {
                  setEssays(prev => ({ ...prev, [currentTask]: text }));
                  setInputMode('text');
                }}
                showLoader={setIsLoading}
              />
            </div>
          )}
        </section>
      </main>

      {/* Time Up Dialog */}
      {isTimeUp && (
        <div className="fixed inset-0 z-[3000] bg-black/50 backdrop-blur-sm flex items-center justify-center animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-md mx-4 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fas fa-clock text-2xl text-red-500"></i>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Hết giờ!</h2>
            <p className="text-slate-500 mb-8">Thời gian luyện tập đã kết thúc. Bạn muốn làm gì với bài làm của mình?</p>
            <div className="flex gap-3">
              <button
                onClick={() => handleTimeUpAction('exit')}
                className="flex-1 py-3 border border-slate-300 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors"
              >
                Thoát
              </button>
              <button
                onClick={() => handleTimeUpAction('submit')}
                className="flex-1 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-colors"
              >
                Nộp bài chấm điểm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Results Modal */}
      {results && (
        <PracticeResultModal results={results} onClose={() => setResults(null)} />
      )}

      {/* Global Loader */}
      {isLoading && (
        <div className="fixed inset-0 z-[2000] bg-white/60 backdrop-blur-xl flex flex-col items-center justify-center animate-in fade-in duration-300">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-slate-100 rounded-full"></div>
            <div className="w-20 h-20 border-4 border-transparent border-t-primary rounded-full animate-spin absolute top-0"></div>
          </div>
          <p className="mt-8 text-slate-800 font-bold font-display text-lg tracking-tight animate-pulse">
            Chuyên gia AI đang phân tích bài làm của bạn...
          </p>
          {isPracticeMode && (
            <p className="mt-2 text-slate-400 text-sm">Đang chấm điểm {Object.keys(results || {}).length || 'các'} bài viết, vui lòng chờ...</p>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Practice Result Modal ──────────────────────────────────────────
const PracticeResultModal: React.FC<{
  results: { [key: number]: ScoreResult };
  onClose: () => void;
}> = ({ results, onClose }) => {
  const taskKeys = Object.keys(results).map(Number).sort();
  const [activeTab, setActiveTab] = useState<number>(taskKeys[0]);

  return (
    <div className="fixed inset-0 z-[2500] bg-black/50 backdrop-blur-sm flex items-start justify-center pt-8 pb-8 px-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl animate-in slide-in-from-bottom-4">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-800">Kết quả luyện tập</h2>
          {taskKeys.length > 1 && (
            <div className="flex gap-2">
              {taskKeys.map(tk => (
                <button
                  key={tk}
                  onClick={() => setActiveTab(tk)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                    activeTab === tk ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Task {tk}
                </button>
              ))}
            </div>
          )}
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
            <i className="fas fa-times text-slate-500 text-sm"></i>
          </button>
        </div>
        <div className="p-6">
          <ResultCard results={results[activeTab]} onClose={onClose} isInline />
        </div>
      </div>
    </div>
  );
};

export default Home;
