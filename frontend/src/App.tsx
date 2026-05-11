import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, Link } from 'react-router-dom';
import Home from './pages/Home';
import { LoginPage, RegisterPage } from './pages/AuthPages';
import Dashboard from './pages/Dashboard';
import ExamSim from './pages/ExamSim';
import ExamLibrary from './pages/ExamLibrary';
import ExamDetail from './pages/ExamDetail';
import Leaderboard from './pages/Leaderboard';
import Profile from './pages/Profile';
import { useAuth } from './context/AuthContext';
import { useGrading } from './context/GradingContext';
import { useLocation } from 'react-router-dom';
import GradingStatusToast from './Component/GradingStatusToast';
import ModelGenerationStatus from './Component/ModelGenerationStatus';
import ResultCard from './Component/ResultCard';
import { X, ChevronRight, Flame, User } from 'lucide-react';
import './index.css';

function App() {
  const { isAuthenticated, user, logout } = useAuth();
  const location = useLocation();
  const [hideHeader, setHideHeader] = useState(false);

  return (
    <div className="app min-h-screen bg-slate-50">
      {/* Global Navigation Header */}
      {!hideHeader && (
        <nav className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-[100]">
        <Link to="/" className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
          IELTS Scorer
        </Link>
        <div className="flex items-center gap-6">
          {/* <Link to="/" className="text-slate-600 hover:text-indigo-600 font-medium transition-colors">Luyện tập</Link> */}
          <Link to="/library" className="text-slate-600 hover:text-indigo-600 font-medium transition-colors flex items-center gap-2">
            <span className="w-2 h-2 bg-rose-500 rounded-full animate-pulse"></span>
            Đề thi online
          </Link>
          <Link to="/leaderboard" className="text-slate-600 hover:text-indigo-600 font-medium transition-colors flex items-center gap-2">
            Xếp hạng
          </Link>
          {isAuthenticated ? (
            <>
              <Link to="/dashboard" className="text-slate-600 hover:text-indigo-600 font-medium transition-colors">Dashboard</Link>
              <div className="flex items-center gap-4 pl-6 border-l border-slate-200">
                {user?.streak !== undefined && (
                  <div className="flex items-center gap-1 bg-orange-50 px-3 py-1.5 rounded-full border border-orange-100 shadow-sm">
                    <Flame size={16} className="text-orange-500 fill-orange-500" />
                    <span className="text-orange-700 font-bold text-sm">{user.streak}</span>
                  </div>
                )}
                <Link to="/profile" className="flex items-center gap-2 group">
                  <div className="w-9 h-9 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all overflow-hidden">
                    {user?.avatar_url ? (
                      <img src={user.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <User size={18} />
                    )}
                  </div>
                  <span className="text-slate-900 font-semibold group-hover:text-indigo-600 transition-colors">{user?.username}</span>
                </Link>
                <button 
                  onClick={logout}
                  className="px-4 py-2 text-sm font-medium text-white bg-slate-800 rounded-xl hover:bg-slate-900 transition-all shadow-sm"
                >
                  Đăng xuất
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-4">
              <Link to="/login" className="text-slate-600 hover:text-indigo-600 font-medium">Đăng nhập</Link>
              <Link to="/register" className="px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200">
                Bắt đầu ngay
              </Link>
            </div>
          )}
        </div>
      </nav>
      )}

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={!isAuthenticated ? <LoginPage /> : <Navigate to="/dashboard" />} />
        <Route path="/register" element={!isAuthenticated ? <RegisterPage /> : <Navigate to="/dashboard" />} />
        <Route path="/dashboard" element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" />} />
        <Route path="/library" element={<ExamLibrary />} />
        <Route path="/exam-detail/:id" element={<ExamDetail />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/profile" element={isAuthenticated ? <Profile /> : <Navigate to="/login" />} />
        <Route path="/exam" element={<ExamSim setGlobalHeaderHide={setHideHeader} />} />
      </Routes>

      {/* Global Background Status Components */}
      <GradingStatusToast />
      <ModelGenerationStatus />
      <GlobalResultPopup />
    </div>
  );
}

// ─── Global Result Popup Component ──────────────────────────────────────────
const GlobalResultPopup = () => {
  const { activeResult, closeResultPopup } = useGrading();
  const [viewTask, setViewTask] = useState<number>(1);

  useEffect(() => {
    if (activeResult) {
      setViewTask(activeResult.results["2"] ? 2 : 1);
    }
  }, [activeResult]);

  if (!activeResult) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-3xl z-[10000] flex items-center justify-center p-6 animate-in fade-in duration-500">
      <div className="relative w-full max-w-[1400px]">
        {/* Task Switcher for Full Exam */}
        {activeResult.results["1"] && activeResult.results["2"] && (
          <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[2000] flex justify-center">
            <div className="flex bg-slate-800/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-700 shadow-2xl">
              <button 
                onClick={() => setViewTask(1)}
                className={`px-8 py-2.5 rounded-xl text-xs font-black transition-all ${viewTask === 1 ? 'bg-white text-indigo-600 shadow-lg' : 'text-slate-300 hover:text-white hover:bg-white/10'}`}
              >
                TASK 1
              </button>
              <button 
                onClick={() => setViewTask(2)}
                className={`px-8 py-2.5 rounded-xl text-xs font-black transition-all ${viewTask === 2 ? 'bg-white text-indigo-600 shadow-lg' : 'text-slate-300 hover:text-white hover:bg-white/10'}`}
              >
                TASK 2
              </button>
            </div>
          </div>
        )}
        
        <ResultCard 
          results={activeResult.results[viewTask.toString()]} 
          onClose={closeResultPopup} 
        />
      </div>
    </div>
  );
};

export default App;
