import React from 'react';

interface SidebarProps {
  currentTask: number;
  setTask: (task: number) => void;
  isPracticeMode?: boolean;
  practiceMode?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ currentTask, setTask, isPracticeMode, practiceMode }) => {
  const showTask1 = !isPracticeMode || practiceMode === 'task1' || practiceMode === 'both';
  const showTask2 = !isPracticeMode || practiceMode === 'task2' || practiceMode === 'both';

  return (
    <aside className="w-72 bg-white border-r border-slate-100 p-8 flex flex-col fixed h-full hidden lg:flex overflow-y-auto custom-scrollbar">
      <div className="flex items-center gap-3 text-2xl font-bold text-primary mb-12 font-display tracking-tight">
        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
          <i className="fas fa-pen-fancy text-sm"></i>
        </div>
        <span>IELTS AI</span>
      </div>
      
      <div className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 px-2">
        Phân loại Task
      </div>
      
      <nav className="flex flex-col gap-3">
        {showTask1 && (
          <div 
            onClick={() => setTask(1)}
            className={`group flex items-center gap-4 px-6 py-4 rounded-[20px] cursor-pointer transition-all duration-300 ${
              currentTask === 1 
                ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200 translate-x-2' 
                : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
            }`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
              currentTask === 1 ? 'bg-white/20' : 'bg-slate-100 group-hover:bg-white'
            }`}>
              <i className="fas fa-chart-pie text-xs"></i>
            </div>
            <span className="font-black text-sm">Writing Task 1</span>
          </div>
        )}

        {showTask2 && (
          <div 
            onClick={() => setTask(2)}
            className={`group flex items-center gap-4 px-6 py-4 rounded-[20px] cursor-pointer transition-all duration-300 ${
              currentTask === 2 
                ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200 translate-x-2' 
                : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
            }`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
              currentTask === 2 ? 'bg-white/20' : 'bg-slate-100 group-hover:bg-white'
            }`}>
              <i className="fas fa-edit text-xs"></i>
            </div>
            <span className="font-black text-sm">Writing Task 2</span>
          </div>
        )}
      </nav>

      <div className="mt-auto pt-10 pb-4">
        <div className="p-6 bg-gradient-to-br from-indigo-50 to-white rounded-[32px] border border-indigo-100 shadow-sm relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-16 h-16 bg-indigo-600/5 rounded-full blur-2xl group-hover:bg-indigo-600/10 transition-colors"></div>
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white mb-4 shadow-lg shadow-indigo-100">
            <i className="fas fa-crown text-sm"></i>
          </div>
          <h4 className="font-black text-slate-900 text-sm mb-2">Chế độ Premium</h4>
          <p className="text-slate-500 text-[11px] leading-relaxed mb-4">
            Nâng cấp tài khoản để sử dụng mô hình AI mạnh mẽ hơn và không giới hạn lượt chấm.
          </p>
          <button className="flex items-center gap-2 text-indigo-600 text-[11px] font-black hover:gap-3 transition-all group-hover:translate-x-1">
            Tìm hiểu thêm <i className="fas fa-arrow-right text-[10px]"></i>
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
