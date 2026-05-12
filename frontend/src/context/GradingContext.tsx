import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import type { ScoreResult } from '../types';
import { API } from '../config';

const API_BASE = API;

interface GradingJob {
  id: string; // session_id
  examTitle: string;
  startTime: number;
  status: 'grading' | 'completed' | 'error';
  results?: Record<string, ScoreResult>;
  error?: string;
}

interface GradingContextType {
  jobs: GradingJob[];
  addJob: (examId: string, examTitle: string, tasks: any, taskMode: string, timeLeft: number, sourceExamId: string | null) => Promise<void>;
  clearJob: (id: string) => void;
  showResultPopup: (results: Record<string, ScoreResult>, title: string) => void;
  activeResult: { results: Record<string, ScoreResult>, title: string } | null;
  closeResultPopup: () => void;
}

const GradingContext = createContext<GradingContextType | undefined>(undefined);

export const GradingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [jobs, setJobs] = useState<GradingJob[]>([]);
  const [activeResult, setActiveResult] = useState<{ results: Record<string, ScoreResult>, title: string } | null>(null);

  const showResultPopup = useCallback((results: Record<string, ScoreResult>, title: string) => {
    setActiveResult({ results, title });
  }, []);

  const closeResultPopup = useCallback(() => {
    setActiveResult(null);
  }, []);

  const addJob = useCallback(async (
    examId: string, 
    examTitle: string, 
    tasks: any, 
    taskMode: string, 
    timeLeft: number, 
    sourceExamId: string | null,
    sessionType: string = "exam"
  ) => {
    let actualSessionId = examId;
    if (examId === "quick-score") {
        const timestamp = Math.floor(new Date().getTime() / 1000).toString(16);
        const randomHex = [...Array(16)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
        actualSessionId = timestamp + randomHex;
    }

    const newJob: GradingJob = {
      id: actualSessionId,
      examTitle,
      startTime: Date.now(),
      status: 'grading'
    };
    
    setJobs(prev => [...prev, newJob]);

    try {
      const finalResults: Record<string, ScoreResult> = {};
      const updatedTasks: any = { ...tasks };
      let submittedCount = 0;

      // Processing tasks (similar logic to handleSubmitExam in ExamSim)
      // Note: In a real world app, the backend should handle this async.
      // Here we do it in the frontend "background" (by not blocking the UI).
      
      const tasksToProcess = [];
      if (tasks["1"] && tasks["1"].essay && tasks["1"].status !== "submitted") {
        tasksToProcess.push({ id: "1", task: tasks["1"] });
      } else if (tasks["1"] && tasks["1"].result) {
        finalResults["1"] = tasks["1"].result;
        submittedCount++;
      }

      if (tasks["2"] && tasks["2"].essay && tasks["2"].status !== "submitted") {
        tasksToProcess.push({ id: "2", task: tasks["2"] });
      } else if (tasks["2"] && tasks["2"].result) {
        finalResults["2"] = tasks["2"].result;
        submittedCount++;
      }

      // Lấy thông tin user để lưu lịch sử
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;

      // Sequential scoring to avoid overloading
      for (const item of tasksToProcess) {
        const res = await axios.post(`${API_BASE}/score`, { 
          task_type: parseInt(item.id), 
          question: item.task.question, 
          essay: item.task.essay, 
          user_id: user ? user.username : null,
          session_id: actualSessionId,
          task_mode: taskMode,
          exam_title: examTitle
        });
        finalResults[item.id] = res.data;
        updatedTasks[item.id] = { ...item.task, status: "submitted", result: res.data };
        submittedCount++;
      }

      let newStatus = "in_progress";
      if (taskMode === 'both' && submittedCount === 2) newStatus = "completed";
      else if (taskMode !== 'both' && submittedCount === 1) newStatus = "completed";

      let overallScore: number | undefined = undefined;
      const s1 = finalResults["1"]?.overall;
      const s2 = finalResults["2"]?.overall;
      
      if (taskMode === 'both') {
        if (s1 !== undefined && s2 !== undefined) {
          const raw = (s1 * (1/3)) + (s2 * (2/3));
          const fraction = raw - Math.floor(raw);
          if (fraction < 0.25) overallScore = Math.floor(raw);
          else if (fraction < 0.75) overallScore = Math.floor(raw) + 0.5;
          else overallScore = Math.floor(raw) + 1;
        } else if (s1 !== undefined) {
          overallScore = s1;
        } else if (s2 !== undefined) {
          overallScore = s2;
        }
      } else if (taskMode === 'task1') {
        overallScore = s1;
      } else {
        overallScore = s2;
      }

      // Final submission to DB
      
      if (user) {
        await axios.post(`${API_BASE}/exam/submit`, {
          id: actualSessionId,
          user_id: user.username,
          source_exam_id: sourceExamId,
          task_mode: taskMode,
          session_type: sessionType,
          time_left: timeLeft,
          tasks: updatedTasks,
          overall_status: newStatus,
          overall: overallScore,
          total_time_spent: (taskMode === 'both' ? 3600 : (taskMode === 'task1' ? 1200 : 2400)) - timeLeft
        });
      }

      setJobs(prev => prev.map(j => 
        j.id === actualSessionId ? { ...j, status: 'completed', results: finalResults } : j
      ));
    } catch (err: any) {
      console.error("Grading failed:", err);
      setJobs(prev => prev.map(j => 
        j.id === actualSessionId ? { ...j, status: 'error', error: err.message } : j
      ));
    }
  }, []);

  const clearJob = useCallback((id: string) => {
    setJobs(prev => prev.filter(j => j.id !== id));
  }, []);

  return (
    <GradingContext.Provider value={{ jobs, addJob, clearJob, showResultPopup, activeResult, closeResultPopup }}>
      {children}
    </GradingContext.Provider>
  );
};

export const useGrading = () => {
  const context = useContext(GradingContext);
  if (context === undefined) {
    throw new Error('useGrading must be used within a GradingProvider');
  }
  return context;
};
