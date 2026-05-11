import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Clock, 
  Type, 
  AlertTriangle, 
  CheckCircle2, 
  Save, 
  ChevronLeft,
  Layout,
  Maximize2,
  Send,
  ArrowRight,
  ArrowLeft,
  LogOut,
  X,
  History,
  Trash2,
  Play
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useGrading } from '../context/GradingContext';
import axios from 'axios';
import type { ScoreResult } from '../types';
import ResultCard from '../Component/ResultCard';

const API_BASE = 'http://localhost:8000/api';

interface ExamSimProps {
  setGlobalHeaderHide: (hide: boolean) => void;
}

const ExamSim: React.FC<ExamSimProps> = ({ setGlobalHeaderHide }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Setup States
  const [taskMode, setTaskMode] = useState<'task1' | 'task2' | 'both' | null>(null);
  const [customTime, setCustomTime] = useState<number>(0); // minutes
  const [hasDraft, setHasDraft] = useState(false);
  const [examId, setExamId] = useState<string | null>(null);
  
  // Exam States
  const [activeTask, setActiveTask] = useState<1 | 2>(1);
  const [essays, setEssays] = useState<{[key: string]: string}>({"1": "", "2": ""});
  const [taskStatus, setTaskStatus] = useState<{[key: string]: string}>({"1": "draft", "2": "draft"});
  const [existingResults, setExistingResults] = useState<{[key: string]: any}>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [isExamStarted, setIsExamStarted] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [sourceExamId, setSourceExamId] = useState<string | null>(null);
  
  // Results
  const [results, setResults] = useState<{[key: string]: ScoreResult | undefined}>({});
  const [showResults, setShowResults] = useState(false);
  const [resultViewTask, setResultViewTask] = useState<1 | 2>(1);

  const [isInitializing, setIsInitializing] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.has('exam_id') || params.has('sessionId');
  });

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const [questions, setQuestions] = useState<{[key: number]: {text: string, image?: string}}>({
    1: { text: "The graph below shows the changes in global population between 1950 and 2050 (predicted). Summarize the information by selecting and reporting the main features, and make comparisons where relevant." },
    2: { text: "Some people believe that it is better to work for the same organization for one's whole life. Others think that it is better to change jobs frequently. Discuss both views and give your opinion." }
  });

  // --- NAVIGATION GUARD ---
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isExamStarted && !isFinished && !showResults) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    const handlePopState = (e: PopStateEvent) => {
      if (isExamStarted && !isFinished && !showResults) {
        if (!window.confirm("Bạn đang trong phòng thi. Nếu thoát bây giờ, tiến trình có thể bị mất. Bạn có chắc chắn muốn thoát?")) {
          window.history.pushState(null, '', window.location.pathname);
        } else {
          exitExam();
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);
    
    if (isExamStarted && !isFinished) {
      window.history.pushState(null, '', window.location.pathname);
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isExamStarted, isFinished, showResults, navigate]);

  // Load session from DB on mount
  useEffect(() => {
    const loadSession = async () => {
      if (user) {
        try {
          const urlParams = new URLSearchParams(window.location.search);
          const sessionId = urlParams.get('sessionId');
          const passedExamId = urlParams.get('exam_id');
          const passedMode = urlParams.get('mode') as 'task1' | 'task2' | 'both';
          
          if (sessionId) {
            let url = `${API_BASE}/exam/load-session?user_id=${user.username}&session_id=${sessionId}`;
            const res = await axios.get(url);
            if (res.data) {
              const session = res.data;
              setTaskMode(session.task_mode);
              setEssays({
                "1": session.tasks["1"]?.essay || "",
                "2": session.tasks["2"]?.essay || ""
              });
              setTaskStatus({
                "1": session.tasks["1"]?.status || "draft",
                "2": session.tasks["2"]?.status || "draft"
              });
              setExistingResults({
                "1": session.tasks["1"]?.result,
                "2": session.tasks["2"]?.result
              });
              const sessionQs = {
                1: { text: session.tasks["1"]?.question?.text || session.tasks["1"]?.question || questions[1].text, image: session.tasks["1"]?.question?.image },
                2: { text: session.tasks["2"]?.question?.text || session.tasks["2"]?.question || questions[2].text, image: session.tasks["2"]?.question?.image }
              };
              setQuestions(sessionQs);
              setTimeLeft(session.time_left);
              setExamId(session._id);
              setSourceExamId(session.source_exam_id || null);
              setHasDraft(true);
              
              let defaultTask: 1 | 2 = session.task_mode === 'task2' ? 2 : 1;
              if (session.task_mode === 'both') {
                 if (session.tasks["1"]?.status === "submitted" && session.tasks["2"]?.status !== "submitted") {
                    defaultTask = 2;
                 } else if (session.tasks["2"]?.status === "submitted" && session.tasks["1"]?.status !== "submitted") {
                    defaultTask = 1;
                 }
              }
              setActiveTask(defaultTask);
              setIsExamStarted(true);
              setGlobalHeaderHide(true);
            }
          } else if (passedExamId && passedMode) {
            // Khởi tạo bài thi mới từ thư viện
            const res = await axios.get(`${API_BASE}/exam/detail/${passedExamId}`);
            if (res.data) {
              const examDetail = res.data;
              const newQuestions = {...questions};
              if (examDetail.task1) {
                newQuestions[1] = { text: examDetail.task1.prompt, image: examDetail.task1.image_url };
              }
              if (examDetail.task2) {
                newQuestions[2] = { text: examDetail.task2.prompt };
              }
              setQuestions(newQuestions);
              
              let time = 0;
              if (passedMode === 'task1') time = 1200;
              else if (passedMode === 'task2') time = 2400;
              else time = 3600;
              
              const initialTasks: any = {};
              if (passedMode === 'task1' || passedMode === 'both') {
                initialTasks["1"] = { essay: "", question: newQuestions[1], status: "draft" };
              }
              if (passedMode === 'task2' || passedMode === 'both') {
                initialTasks["2"] = { essay: "", question: newQuestions[2], status: "draft" };
              }

              const createRes = await axios.post(`${API_BASE}/exam/save-session`, {
                user_id: user.username,
                task_mode: passedMode,
                source_exam_id: passedExamId,
                time_left: time,
                tasks: initialTasks
              });
              
              setExamId(createRes.data.id);
              setSourceExamId(passedExamId);
              setTaskMode(passedMode);
              setTimeLeft(time);
              setEssays({"1": "", "2": ""});
              setActiveTask(passedMode === 'task2' ? 2 : 1);
              setIsExamStarted(true);
              setGlobalHeaderHide(true);
            }
          } else {
             // Kịch bản bình thường: kiểm tra bài dở mới nhất
             let url = `${API_BASE}/exam/load-session?user_id=${user.username}`;
             const res = await axios.get(url);
             if (res.data) {
                setHasDraft(true);
                setExamId(res.data._id);
                setTaskMode(res.data.task_mode);
                // Các thông tin khác sẽ load đầy đủ khi bấm "Resume"
             }
          }
        } catch (err) {
          console.error("Lỗi khi load session:", err);
        } finally {
          setIsInitializing(false);
        }
      } else if (user === null) {
        setIsInitializing(false);
      }
    };
    loadSession();
  }, [user]);

  // Timer logic
  useEffect(() => {
    if (isExamStarted && timeLeft > 0 && !isFinished) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            handleFinish();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (isExamStarted && timeLeft === 0 && !isFinished) {
      handleFinish();
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isExamStarted, isFinished]);

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const stateRef = useRef({ essays, timeLeft, taskMode, examId, sourceExamId, questions });
  useEffect(() => {
    stateRef.current = { essays, timeLeft, taskMode, examId, sourceExamId, questions };
  }, [essays, timeLeft, taskMode, examId, sourceExamId, questions]);

  // Unified Save Function
  const triggerSave = async () => {
    const { essays: curEssays, timeLeft: curTime, taskMode: curMode, examId: curId, sourceExamId: curSourceId, questions: curQs } = stateRef.current;
    if (!curId || !user) return;

    setSaveStatus('saving');
    try {
      const currentTasks: any = {};
      if (curMode === 'task1' || curMode === 'both') {
        currentTasks["1"] = { essay: curEssays["1"], question: curQs[1], status: taskStatus["1"], result: existingResults["1"] };
      }
      if (curMode === 'task2' || curMode === 'both') {
        currentTasks["2"] = { essay: curEssays["2"], question: curQs[2], status: taskStatus["2"], result: existingResults["2"] };
      }

      await axios.post(`${API_BASE}/exam/save-session`, {
        id: curId,
        user_id: user.username,
        source_exam_id: curSourceId,
        task_mode: curMode,
        time_left: curTime,
        tasks: currentTasks
      });
      setLastSaved(new Date().toLocaleTimeString('vi-VN'));
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      console.error("Lỗi auto-save:", err);
      setSaveStatus('error');
    }
  };

  // 1. Debounced save (after typing stops for 5s)
  useEffect(() => {
    if (isExamStarted && !isFinished) {
      const timer = setTimeout(() => {
        triggerSave();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [essays]);

  // 2. Interval save (every 30s as backup for timer)
  useEffect(() => {
    if (isExamStarted && !isFinished) {
      const interval = setInterval(() => {
        triggerSave();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [isExamStarted, isFinished, user, examId]);

  const wordCount1 = essays["1"].trim() ? essays["1"].trim().split(/\s+/).length : 0;
  const wordCount2 = essays["2"].trim() ? essays["2"].trim().split(/\s+/).length : 0;
  
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs > 0 ? hrs + ':' : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStart = async () => {
    if (!taskMode) return;
    if (customTime !== 0 && (customTime < 1 || customTime > 60)) {
      alert("Thời gian thi phải từ 1 đến 60 phút.");
      return;
    }
    let time = 0;
    if (customTime > 0) time = customTime * 60;
    else {
      if (taskMode === 'task1') time = 1200;
      else if (taskMode === 'task2') time = 2400;
      else time = 3600;
    }

    // Create NEW session in DB immediately to get an ID
    if (user) {
      try {
        const initialTasks: any = {};
        if (taskMode === 'task1' || taskMode === 'both') {
          initialTasks["1"] = { essay: "", question: questions[1], status: "draft" };
        }
        if (taskMode === 'task2' || taskMode === 'both') {
          initialTasks["2"] = { essay: "", question: questions[2], status: "draft" };
        }

        const res = await axios.post(`${API_BASE}/exam/save-session`, {
          user_id: user.username,
          task_mode: taskMode,
          time_left: time,
          tasks: initialTasks
        });
        setExamId(res.data.id);
        setTimeLeft(time);
        setEssays({"1": "", "2": ""});
        setActiveTask(taskMode === 'task2' ? 2 : 1);
        setIsExamStarted(true);
        setGlobalHeaderHide(true);
      } catch (err) {
        alert("Không thể khởi tạo bài thi mới. Vui lòng thử lại.");
      }
    }
  };

  const handleResume = () => {
    if (!taskMode || !examId) return;
    setActiveTask(taskMode === 'task2' ? 2 : 1);
    setIsExamStarted(true);
    setGlobalHeaderHide(true);
  };

  const handleFinish = () => {
    setIsFinished(true);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const exitExam = () => {
    setIsExamStarted(false);
    setGlobalHeaderHide(false);
    navigate('/dashboard');
  };

  const handleSaveAndExit = async () => {
    if (user && examId) {
      try {
        const currentTasks: any = {};
        if (taskMode === 'task1' || taskMode === 'both') {
          currentTasks["1"] = { essay: essays["1"], question: questions[1], status: taskStatus["1"], result: existingResults["1"] };
        }
        if (taskMode === 'task2' || taskMode === 'both') {
          currentTasks["2"] = { essay: essays["2"], question: questions[2], status: taskStatus["2"], result: existingResults["2"] };
        }

        await axios.post(`${API_BASE}/exam/save-session`, {
          id: examId,
          user_id: user.username,
          source_exam_id: sourceExamId,
          task_mode: taskMode,
          time_left: timeLeft,
          tasks: currentTasks
        });
        exitExam();
      } catch (err) {
        alert("Lỗi khi lưu bài làm.");
      }
    }
  };

  const handleExitWithoutSave = async () => {
    if (window.confirm("Thoát mà không lưu? Toàn bộ tiến trình bài thi này sẽ bị xóa.")) {
      if (user && examId) {
        try {
          await axios.delete(`${API_BASE}/exam/delete-session?user_id=${user.username}&session_id=${examId}`);
          exitExam();
        } catch (err) {
          exitExam();
        }
      } else {
        exitExam();
      }
    }
  };

  const { addJob } = useGrading();

  const handleSubmitExam = async () => {
    const isTask1Valid = (taskMode === 'task1' || taskMode === 'both') && essays["1"].trim().split(/\s+/).length > 5;
    const isTask2Valid = (taskMode === 'task2' || taskMode === 'both') && essays["2"].trim().split(/\s+/).length > 5;

    if (!isTask1Valid && !isTask2Valid) {
      alert("Bạn chưa viết bài nào đủ độ dài để chấm điểm.");
      return;
    }

    const currentTasks: any = {};
    if (taskMode === 'task1' || taskMode === 'both') {
      currentTasks["1"] = { 
        essay: essays["1"], 
        question: questions[1]?.text || '', 
        status: taskStatus["1"], 
        result: existingResults["1"] 
      };
    }
    if (taskMode === 'task2' || taskMode === 'both') {
      currentTasks["2"] = { 
        essay: essays["2"], 
        question: questions[2]?.text || '', 
        status: taskStatus["2"], 
        result: existingResults["2"] 
      };
    }

    // Register the background grading job
    addJob(
      examId!, 
      taskMode === 'both' ? 'Full Exam Simulation' : `IELTS Writing ${taskMode}`,
      currentTasks,
      taskMode!,
      timeLeft,
      sourceExamId
    );

    // Exit immediately to the library/dashboard
    setGlobalHeaderHide(false);
    navigate('/library');
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-slate-200 rounded-full"></div>
          <div className="w-16 h-16 border-4 border-transparent border-t-indigo-600 rounded-full animate-spin absolute top-0"></div>
        </div>
        <p className="mt-6 text-slate-500 font-bold tracking-tight animate-pulse">Đang chuẩn bị phòng thi...</p>
      </div>
    );
  }

  if (!isExamStarted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-4xl w-full bg-white rounded-[40px] shadow-2xl border border-slate-100 p-12 text-center animate-in fade-in zoom-in duration-500">
          
          {hasDraft && (
            <div className="mb-10 p-6 bg-amber-50 border border-amber-100 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6 animate-in slide-in-from-top-4">
              <div className="flex items-center gap-4 text-left">
                <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center">
                  <History size={24} />
                </div>
                <div>
                  <h4 className="font-black text-slate-900">Tiếp tục bài thi dở?</h4>
                  <p className="text-slate-500 text-xs">Bạn có một bài thi chưa hoàn thành ({taskMode === 'both' ? 'Full Exam' : taskMode}).</p>
                </div>
              </div>
              <button 
                onClick={handleResume}
                className="flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-black transition-all shadow-lg shadow-amber-200"
              >
                <Play size={18} fill="currentColor" /> TIẾP TỤC NGAY
              </button>
            </div>
          )}

          <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center text-white mx-auto mb-8 shadow-xl shadow-indigo-200">
            <Layout size={40} />
          </div>
          <h1 className="text-4xl font-black text-slate-900 mb-4 tracking-tight text-center">Mô phỏng phòng thi IELTS</h1>
          <p className="text-slate-500 mb-10 text-lg text-center">Chọn chế độ làm bài và thiết lập thời gian của bạn.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <button onClick={() => setTaskMode('task1')} className={`group p-8 rounded-3xl border-2 transition-all text-left ${taskMode === 'task1' ? 'border-indigo-600 bg-indigo-50' : 'border-slate-100 hover:border-slate-200'}`}>
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-colors ${taskMode === 'task1' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                <Type size={24} />
              </div>
              <h3 className="font-black text-slate-900 text-lg mb-2 text-left">Task 1 Only</h3>
              <p className="text-slate-400 text-xs text-left">Mô tả biểu đồ/đồ thị.</p>
            </button>
            <button onClick={() => setTaskMode('task2')} className={`group p-8 rounded-3xl border-2 transition-all text-left ${taskMode === 'task2' ? 'border-indigo-600 bg-indigo-50' : 'border-slate-100 hover:border-slate-200'}`}>
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-colors ${taskMode === 'task2' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                <Maximize2 size={24} />
              </div>
              <h3 className="font-black text-slate-900 text-lg mb-2 text-left">Task 2 Only</h3>
              <p className="text-slate-400 text-xs text-left">Viết bài luận xã hội.</p>
            </button>
            <button onClick={() => setTaskMode('both')} className={`group p-8 rounded-3xl border-2 transition-all text-left ${taskMode === 'both' ? 'border-indigo-600 bg-indigo-50' : 'border-slate-100 hover:border-slate-200'}`}>
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-colors ${taskMode === 'both' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                <History size={24} />
              </div>
              <h3 className="font-black text-slate-900 text-lg mb-2 text-left">Full Exam (1+2)</h3>
              <p className="text-slate-400 text-xs text-left">Làm cả 2 bài trong 60 phút.</p>
            </button>
          </div>

          {taskMode && (
            <div className="bg-slate-50 p-8 rounded-[32px] border border-slate-100 mb-10">
              <h4 className="font-bold text-slate-900 mb-4 flex items-center justify-center gap-2">
                <Clock size={18} className="text-indigo-600" /> Thiết lập thời gian (phút)
              </h4>
              <div className="flex items-center justify-center gap-4">
                <input type="number" min="1" max="60" placeholder={taskMode === 'both' ? '60' : (taskMode === 'task1' ? '20' : '40')} onChange={(e) => setCustomTime(parseInt(e.target.value) || 0)} className="w-32 p-4 rounded-2xl border border-slate-200 text-center font-black text-xl outline-none" />
                <span className="text-slate-400 font-bold">phút</span>
              </div>
            </div>
          )}
          
          <button disabled={!taskMode} onClick={handleStart} className="px-12 py-5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white rounded-[24px] font-black text-lg transition-all shadow-xl shadow-indigo-200 flex items-center gap-3 mx-auto">
            BẮT ĐẦU THI MỚI <ArrowRight size={24} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-white flex flex-col overflow-hidden font-sans">
      <header className="h-20 bg-slate-900 text-white px-8 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-6 text-left">
          <button disabled={isExamStarted && !isFinished} onClick={exitExam} className={`p-2 rounded-lg transition-all ${isExamStarted && !isFinished ? 'text-slate-700 opacity-30 cursor-not-allowed' : 'text-slate-400 hover:bg-white/10'}`}>
            <ChevronLeft size={24} />
          </button>
          <div>
            <h2 className="font-black text-lg tracking-tight uppercase">IELTS WRITING {taskMode === 'both' ? 'Full Exam' : taskMode}</h2>
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500"></span> Live Session
            </div>
          </div>
        </div>

        {taskMode === 'both' && (
          <div className="flex bg-slate-800 p-1 rounded-2xl border border-slate-700">
            <button onClick={() => setActiveTask(1)} className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${activeTask === 1 ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>TASK 1</button>
            <button onClick={() => setActiveTask(2)} className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${activeTask === 2 ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>TASK 2</button>
          </div>
        )}

        <div className="flex items-center gap-12">
          <div className={`p-3 rounded-2xl flex items-center gap-3 font-black text-2xl tabular-nums ${timeLeft < 300 ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-800 text-indigo-400'}`}>
            <Clock size={24} /> {formatTime(timeLeft)}
          </div>
          <div className="flex items-center gap-4 text-right">
             <div>
                <div className="text-[10px] font-black text-slate-400 uppercase">Words</div>
                <div className="text-xl font-black text-emerald-400">{activeTask === 1 ? wordCount1 : wordCount2}</div>
             </div>
             <button onClick={handleSaveAndExit} className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-black transition-all border border-slate-600">LƯU VÀ THOÁT</button>
             <button onClick={handleSubmitExam} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black transition-all">NỘP BÀI</button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <section className="w-1/3 bg-slate-50 border-r border-slate-200 overflow-y-auto p-12 text-left">
          <h3 className="text-xl font-black text-slate-900 mb-6 uppercase tracking-tight flex items-center gap-2">
            <Type className="text-indigo-600" size={20} /> Task {activeTask} Question
          </h3>
          <div className="p-8 bg-white rounded-3xl border border-slate-200 shadow-sm leading-relaxed text-slate-700 font-medium text-lg">
            <div className="whitespace-pre-wrap">{questions[activeTask]?.text}</div>
            {questions[activeTask]?.image && (
              <div className="mt-6 text-center">
                <img src={questions[activeTask].image} alt="Task Image" className="max-w-full max-h-[400px] mx-auto rounded shadow-sm border border-slate-100" />
              </div>
            )}
            <p className="mt-6 pt-6 border-t border-slate-100 text-sm italic text-slate-400">Write at least {activeTask === 1 ? 150 : 250} words.</p>
          </div>

          <div className="mt-12 p-6 bg-indigo-50/50 rounded-2xl border border-indigo-100/50 flex items-center justify-between">
            <div className="flex items-center gap-3 text-left">
              <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-white shadow-sm">
                {saveStatus === 'saving' && <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>}
                {saveStatus === 'saved' && <CheckCircle2 size={20} className="text-emerald-500 animate-in zoom-in" />}
                {saveStatus === 'error' && <AlertTriangle size={20} className="text-rose-500" />}
                {saveStatus === 'idle' && <Save size={20} className="text-indigo-400" />}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-black text-indigo-900 uppercase tracking-wider">
                  {saveStatus === 'saving' ? 'Đang lưu bài...' : (saveStatus === 'saved' ? 'Đã lưu an toàn' : 'Hệ thống tự động lưu')}
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Lần cuối: {lastSaved || '...'}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${saveStatus === 'saving' ? 'bg-indigo-600 animate-ping' : 'bg-emerald-500'}`}></div>
              <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Live Sync</div>
            </div>
          </div>
        </section>

        <section className="flex-1 bg-white flex flex-col">
          <textarea
            value={essays[activeTask.toString()]}
            onChange={(e) => setEssays({...essays, [activeTask.toString()]: e.target.value})}
            disabled={isFinished || taskStatus[activeTask.toString()] === "submitted"}
            spellCheck={false}
            placeholder={taskStatus[activeTask.toString()] === "submitted" ? "Bài thi này đã được nộp và không thể chỉnh sửa." : "Write your essay here..."}
            className={`flex-1 w-full p-16 text-lg leading-relaxed outline-none resize-none font-medium custom-scrollbar ${taskStatus[activeTask.toString()] === "submitted" ? "text-slate-500 bg-slate-50" : "text-slate-800"}`}
          />
        </section>
      </main>

      {showResults && results && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl z-[3000] flex flex-col p-10 animate-in fade-in duration-500 overflow-y-auto text-left">
           <div className="max-w-6xl w-full mx-auto bg-white rounded-[40px] shadow-2xl flex flex-col">
              <header className="bg-slate-50 px-10 py-8 border-b border-slate-100 flex justify-between items-center">
                 <div><h2 className="text-3xl font-black text-slate-900 tracking-tight">KẾT QUẢ THI THỬ</h2></div>
                 <div className="flex items-center gap-4">
                    {taskMode === 'both' && (
                       <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-inner">
                          <button onClick={() => setResultViewTask(1)} className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${resultViewTask === 1 ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>TASK 1</button>
                          <button onClick={() => setResultViewTask(2)} className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${resultViewTask === 2 ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>TASK 2</button>
                       </div>
                    )}
                    <button onClick={exitExam} className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl"><X size={24} /></button>
                 </div>
              </header>
              <div className="p-10">
                 {results[resultViewTask.toString()] && <ResultCard results={results[resultViewTask.toString()]!} isInline={true} />}
              </div>
              <footer className="bg-slate-50 px-10 py-8 border-t border-slate-100 text-center">
                 <button onClick={exitExam} className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black">QUAY LẠI DASHBOARD</button>
              </footer>
           </div>
        </div>
      )}
    </div>
  );
};

export default ExamSim;
