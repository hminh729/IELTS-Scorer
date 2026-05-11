import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Camera, User, Mail, Target, FileText, Flame, Save, Loader2, Edit3, Trash2 } from 'lucide-react';

const Profile = () => {
  const { user, updateUser } = useAuth();
  const [formData, setFormData] = useState({
    full_name: '',
    bio: '',
    target_band: 7.0,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [pwdData, setPwdData] = useState({ current: '', new: '', confirm: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.full_name || '',
        bio: user.bio || '',
        target_band: user.target_band || 7.0,
      });
    }
  }, [user]);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage({ type: '', text: '' });
    try {
      const res = await fetch(`http://localhost:8000/api/user/profile?user_id=${user.username}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      
      if (res.ok) {
        updateUser(formData);
        setMessage({ type: 'success', text: 'Cập nhật thông tin thành công!' });
      } else {
        setMessage({ type: 'error', text: 'Có lỗi xảy ra, vui lòng thử lại.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Không thể kết nối đến server.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      alert('Chỉ hỗ trợ định dạng .jpg và .png');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`http://localhost:8000/api/user/avatar?user_id=${user.username}`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        updateUser({ avatar_url: data.avatar_url });
        setMessage({ type: 'success', text: 'Cập nhật ảnh đại diện thành công!' });
      } else {
        alert('Tải ảnh thất bại.');
      }
    } catch (err) {
      console.error(err);
      alert('Lỗi kết nối.');
    } finally {
      setIsUploading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!pwdData.current || !pwdData.new || !pwdData.confirm) {
      setMessage({ type: 'error', text: 'Vui lòng điền đầy đủ thông tin mật khẩu.' });
      return;
    }
    if (pwdData.new !== pwdData.confirm) {
      setMessage({ type: 'error', text: 'Mật khẩu mới không khớp.' });
      return;
    }
    if (pwdData.new.length < 6) {
      setMessage({ type: 'error', text: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
      return;
    }

    setIsChangingPassword(true);
    setMessage({ type: '', text: '' });
    try {
      const res = await fetch(`http://localhost:8000/api/user/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.username,
          current_password: pwdData.current,
          new_password: pwdData.new
        }),
      });
      
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: 'Đổi mật khẩu thành công!' });
        setPwdData({ current: '', new: '', confirm: '' });
      } else {
        setMessage({ type: 'error', text: data.detail || 'Có lỗi xảy ra.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Lỗi kết nối server.' });
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="mb-10">
        <h1 className="text-3xl font-black text-slate-900 mb-2">Trang cá nhân</h1>
        <p className="text-slate-500">Quản lý thông tin và theo dõi tiến độ học tập của bạn</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Avatar & Stats */}
        <div className="lg:col-span-1 space-y-8">
          {/* Avatar Card */}
          <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-xl shadow-slate-200/40 flex flex-col items-center text-center">
            <div className="relative group mb-6">
              <div className="w-32 h-32 rounded-full bg-indigo-50 border-4 border-white shadow-lg overflow-hidden flex items-center justify-center">
                {isUploading ? (
                  <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                ) : user?.avatar_url ? (
                  <img src={user.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-16 h-16 text-indigo-300" />
                )}
              </div>
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="absolute bottom-1 right-1 w-10 h-10 bg-indigo-600 rounded-full border-4 border-white text-white flex items-center justify-center shadow-md hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
              >
                <Camera size={16} />
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleAvatarUpload} 
                className="hidden" 
                accept=".jpg,.jpeg,.png"
              />
            </div>
            
            <h2 className="text-xl font-bold text-slate-900 mb-1">{user?.username}</h2>
            <p className="text-slate-400 text-sm mb-6">{user?.email}</p>
            
            <div className="w-full pt-6 border-t border-slate-50 grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-2xl font-black text-indigo-600">{user?.streak || 0}</div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-center gap-1">
                  Streak <Flame size={10} className="text-orange-500 fill-orange-500" />
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-black text-indigo-600">{user?.target_band || '7.0'}</div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mục tiêu</div>
              </div>
            </div>
          </div>

          {/* Mini Stats Card */}
          <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-8 rounded-[40px] text-white shadow-xl shadow-indigo-200">
            <h3 className="font-bold text-indigo-100 mb-6 flex items-center gap-2">
              <Target size={18} /> Tóm tắt học tập
            </h3>
            <div className="space-y-4">
               <div className="flex justify-between items-center bg-white/10 backdrop-blur-sm p-4 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <FileText size={16} className="text-indigo-200" />
                    <span className="text-sm font-medium">Tổng số bài</span>
                  </div>
                  <span className="font-black">{user?.total_essays || 0}</span>
               </div>
               <div className="flex justify-between items-center bg-white/10 backdrop-blur-sm p-4 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <Flame size={16} className="text-orange-300" />
                    <span className="text-sm font-medium">Chuỗi ngày</span>
                  </div>
                  <span className="font-black">{user?.streak || 0} 🔥</span>
               </div>
            </div>
          </div>
        </div>

        {/* Right Column: Edit Profile Form */}
        <div className="lg:col-span-2">
          <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-xl shadow-slate-200/40">
            <div className="flex items-center gap-4 mb-10 border-b border-slate-50 pb-8">
              <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600">
                <Edit3 size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Thông tin cá nhân</h3>
                <p className="text-slate-400 text-sm">Cập nhật thông tin để chúng tôi hỗ trợ bạn tốt hơn</p>
              </div>
            </div>

            <div className="space-y-8">
              {message.text && (
                <div className={`p-4 rounded-2xl text-sm font-bold animate-in fade-in slide-in-from-top-2 ${
                  message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
                }`}>
                  {message.text}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Họ và tên</label>
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={18} />
                    <input 
                      type="text" 
                      value={formData.full_name}
                      onChange={e => setFormData({...formData, full_name: e.target.value})}
                      placeholder="Nhập họ tên của bạn"
                      className="w-full bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-600 rounded-2xl py-4 pl-12 pr-4 outline-none transition-all font-medium text-slate-700"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Email (Không thể thay đổi)</label>
                  <div className="relative group opacity-60">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input 
                      type="email" 
                      value={user?.email || ''}
                      readOnly
                      className="w-full bg-slate-100 border border-transparent rounded-2xl py-4 pl-12 pr-4 outline-none font-medium text-slate-500 cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Giới thiệu ngắn</label>
                  <textarea 
                    value={formData.bio}
                    onChange={e => setFormData({...formData, bio: e.target.value})}
                    placeholder="Chia sẻ một chút về bản thân hoặc mục tiêu học tập của bạn..."
                    rows={4}
                    className="w-full bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-600 rounded-2xl py-4 px-6 outline-none transition-all font-medium text-slate-700 resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Mục tiêu Band điểm</label>
                  <div className="flex items-center gap-4">
                    <div className="relative flex-1 group">
                      <Target className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={18} />
                      <select 
                        value={formData.target_band}
                        onChange={e => setFormData({...formData, target_band: parseFloat(e.target.value)})}
                        className="w-full bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-600 rounded-2xl py-4 pl-12 pr-10 outline-none transition-all font-black text-slate-700 appearance-none"
                      >
                        {[5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0].map(band => (
                          <option key={band} value={band}>Band {band.toFixed(1)}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-6 flex justify-end">
                <button 
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-3 px-10 py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                  LƯU THAY ĐỔI
                </button>
              </div>
            </div>
          </div>

          {/* Password Change Section */}
          <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-xl shadow-slate-200/40 mt-8">
            <div className="flex items-center gap-4 mb-10 border-b border-slate-50 pb-8">
              <div className="p-3 bg-rose-50 rounded-2xl text-rose-600">
                <Target size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Đổi mật khẩu</h3>
                <p className="text-slate-400 text-sm">Bảo mật tài khoản của bạn</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Mật khẩu hiện tại</label>
                <input 
                  type="password" 
                  value={pwdData.current}
                  onChange={e => setPwdData({...pwdData, current: e.target.value})}
                  className="w-full bg-slate-50 border border-transparent focus:bg-white focus:border-rose-600 rounded-2xl py-4 px-6 outline-none transition-all font-medium text-slate-700"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Mật khẩu mới</label>
                <input 
                  type="password" 
                  value={pwdData.new}
                  onChange={e => setPwdData({...pwdData, new: e.target.value})}
                  className="w-full bg-slate-50 border border-transparent focus:bg-white focus:border-rose-600 rounded-2xl py-4 px-6 outline-none transition-all font-medium text-slate-700"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Xác nhận mật khẩu</label>
                <input 
                  type="password" 
                  value={pwdData.confirm}
                  onChange={e => setPwdData({...pwdData, confirm: e.target.value})}
                  className="w-full bg-slate-50 border border-transparent focus:bg-white focus:border-rose-600 rounded-2xl py-4 px-6 outline-none transition-all font-medium text-slate-700"
                />
              </div>
            </div>

            <div className="pt-8 flex justify-end">
              <button 
                onClick={handlePasswordChange}
                disabled={isChangingPassword}
                className="flex items-center gap-3 px-10 py-4 bg-slate-900 text-white font-black rounded-2xl hover:bg-black transition-all shadow-lg shadow-slate-100 active:scale-95 disabled:opacity-50"
              >
                {isChangingPassword ? <Loader2 className="animate-spin" size={20} /> : <Flame size={20} className="text-orange-400" />}
                ĐỔI MẬT KHẨU
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
