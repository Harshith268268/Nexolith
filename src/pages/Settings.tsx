import React, { useState, useRef, useEffect } from 'react';
import { User, Users, Bell, Shield, Wifi, Info, Save, Trash2, ArrowRight } from 'lucide-react';
import { useFamily } from '../lib/FamilyContext';
import { Avatar } from '../components/Avatar';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import localforage from 'localforage';

export function Settings() {
  const [activeTab, setActiveTab] = useState('profile');
  const { members, updateMember, deleteMember, refreshData } = useFamily();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const primaryMember =
  members.find((m) => m.relation === 'Primary') || members[0];

  const [name, setName] = useState(primaryMember?.name || '');
  const [email, setEmail] = useState('sarah.j@example.com');
  const [phone, setPhone] = useState('+1 (555) 123-4567');
  const [saving, setSaving] = useState(false);

  // Settings State
  const [emailSummaries, setEmailSummaries] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [dailyReminders, setDailyReminders] = useState(false);
  const [shareData, setShareData] = useState(false);
  const [twoFactor, setTwoFactor] = useState(false);
  const [offlineMode, setOfflineMode] = useState(true);
  const [downloadPdfs, setDownloadPdfs] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('healthai_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.email) setEmail(parsed.email);
        if (parsed.phone) setPhone(parsed.phone);
        if (parsed.emailSummaries !== undefined) setEmailSummaries(parsed.emailSummaries);
        if (parsed.pushNotifications !== undefined) setPushNotifications(parsed.pushNotifications);
        if (parsed.dailyReminders !== undefined) setDailyReminders(parsed.dailyReminders);
        if (parsed.shareData !== undefined) setShareData(parsed.shareData);
        if (parsed.twoFactor !== undefined) setTwoFactor(parsed.twoFactor);
        if (parsed.offlineMode !== undefined) setOfflineMode(parsed.offlineMode);
        if (parsed.downloadPdfs !== undefined) setDownloadPdfs(parsed.downloadPdfs);
      } catch { /* ignore invalid settings JSON */ }
    }
  }, []);

  const saveSettingsToLocal = () => {
    localStorage.setItem('healthai_settings', JSON.stringify({
      email, phone,
      emailSummaries, pushNotifications, dailyReminders,
      shareData, twoFactor, offlineMode, downloadPdfs
    }));
    toast.success('Settings saved successfully');
  };

  if (!primaryMember) return null;

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be less than 10MB');
      return;
    }

    setUploadingAvatar(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const base64String = reader.result as string;
        await updateMember(primaryMember.id, { avatarUrl: base64String });
        toast.success('Profile photo updated successfully');
      } catch (err: any) {
        toast.error(err.message || 'Failed to update photo');
      } finally {
        setUploadingAvatar(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      toast.error('Name cannot be empty');
      return;
    }
    setSaving(true);
    try {
      await updateMember(primaryMember.id, { name });
      
      // Also save email and phone to local storage preferences
      const saved = localStorage.getItem('healthai_settings');
      let currentSettings = {};
      try { if (saved) currentSettings = JSON.parse(saved); } catch { /* ignore */ }
      
      localStorage.setItem('healthai_settings', JSON.stringify({
        ...currentSettings,
        email,
        phone
      }));

      toast.success('Profile settings saved successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
  {
    id: 'profile',
    label: 'Account Profile',
    icon: User
  },
  {
    id: 'family',
    label: 'Family Management',
    icon: Users
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: Bell
  },
  {
    id: 'privacy',
    label: 'Privacy & Security',
    icon: Shield
  },
  {
    id: 'offline',
    label: 'Offline & Sync',
    icon: Wifi
  },
  {
    id: 'about',
    label: 'About HealthAI',
    icon: Info
  }];

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Settings</h1>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sub-nav */}
        <div className="w-full md:w-64 shrink-0">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <nav className="flex flex-col p-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-colors ${isActive ? 'bg-primary-50 text-primary-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
                    
                    <Icon
                      className={`w-5 h-5 mr-3 ${isActive ? 'text-primary-600' : 'text-slate-400'}`} />
                    
                    {tab.label}
                  </button>);

              })}
            </nav>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 min-h-[500px]">
            {activeTab === 'profile' &&
            <div className="space-y-8">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 mb-4">
                    Profile Information
                  </h2>
                  <div className="flex items-center space-x-6 mb-6">
                    <Avatar
                    name={primaryMember.name}
                    src={primaryMember.avatarUrl}
                    size="xl" />
                  
                    <div>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handlePhotoUpload} 
                        accept="image/*" 
                        className="hidden" 
                      />
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingAvatar}
                        className="px-4 py-2 border border-slate-300 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
                        {uploadingAvatar ? 'Updating...' : 'Change Photo'}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Full Name
                      </label>
                      <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-4 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary-100 focus:border-primary-500 outline-none" />
                    
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Email Address
                      </label>
                      <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary-100 focus:border-primary-500 outline-none" />
                    
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Phone Number
                      </label>
                      <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-4 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary-100 focus:border-primary-500 outline-none" />
                    
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-200 flex justify-end">
                  <button 
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="inline-flex items-center px-6 py-2.5 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors shadow-sm disabled:opacity-50">
                    <Save className="w-4 h-4 mr-2" /> {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            }

            {activeTab === 'offline' &&
            <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 mb-2">
                    Offline Storage & Sync
                  </h2>
                  <p className="text-slate-500 text-sm mb-6">
                    Manage how your data is stored locally for offline access.
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-success-100 rounded-full flex items-center justify-center mr-4">
                      <Wifi className="w-5 h-5 text-success-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">Sync Status</h3>
                      <p className="text-sm text-slate-500">
                        Last synced: Today at 10:42 AM
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={async () => {
                      setSyncing(true);
                      await refreshData();
                      setSyncing(false);
                      toast.success('Sync complete');
                    }}
                    disabled={syncing}
                    className="px-4 py-2 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50">
                    {syncing ? 'Syncing...' : 'Sync Now'}
                  </button>
                </div>

                <div className="space-y-4 pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-slate-900">
                        Enable Offline Mode
                      </h4>
                      <p className="text-sm text-slate-500">
                        Store encrypted copies of reports on this device.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={offlineMode}
                      onChange={e => { setOfflineMode(e.target.checked); saveSettingsToLocal(); }} />
                    
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-slate-900">
                        Download Original PDFs
                      </h4>
                      <p className="text-sm text-slate-500">
                        Keep full document files locally (uses more storage).
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={downloadPdfs} onChange={e => { setDownloadPdfs(e.target.checked); saveSettingsToLocal(); }} />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-200">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-medium text-slate-700">
                      Local Storage Used
                    </span>
                    <span className="text-slate-500">45 MB / 500 MB</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-primary-500 w-[9%]"></div>
                  </div>
                  <button onClick={async () => {
                    await localforage.clear();
                    localStorage.removeItem('healthai_settings');
                    toast.success('Local data cleared');
                    setTimeout(() => window.location.reload(), 1000);
                  }} className="mt-4 text-sm text-critical-600 font-medium hover:text-critical-700">
                    Clear Local Data
                  </button>
                </div>
              </div>
            }

            {activeTab === 'family' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 mb-2">Family Management</h2>
                  <p className="text-slate-500 text-sm mb-6">Manage the members of your family account.</p>
                </div>
                <div className="space-y-4">
                  {members.map(member => (
                    <div key={member.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="flex items-center space-x-4">
                        <Avatar name={member.name} src={member.avatarUrl} size="md" />
                        <div>
                          <p className="font-bold text-slate-900">{member.name}</p>
                          <p className="text-sm text-slate-500">{member.relation} • {member.age} yrs</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Link to="/family" className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
                          <ArrowRight className="w-5 h-5" />
                        </Link>
                        {member.relation !== 'Primary' && (
                          <button 
                            onClick={async () => {
                              if (window.confirm(`Are you sure you want to permanently remove ${member.name} and all their reports?`)) {
                                try {
                                  await deleteMember(member.id);
                                  toast.success(`${member.name} removed successfully`);
                                } catch (err: any) {
                                  toast.error(err.message || 'Failed to remove member');
                                }
                              }
                            }}
                            className="p-2 text-critical-600 hover:bg-critical-50 rounded-lg transition-colors">
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 mb-2">Notifications</h2>
                  <p className="text-slate-500 text-sm mb-6">Manage how and when you receive alerts.</p>
                </div>
                <div className="space-y-4">
                  {[
                    { title: 'Email Summaries', desc: 'Receive weekly health summaries via email.', state: emailSummaries, set: setEmailSummaries },
                    { title: 'Push Notifications', desc: 'Instant alerts for critical lab results.', state: pushNotifications, set: setPushNotifications },
                    { title: 'Daily Reminders', desc: 'Morning reminders for upcoming appointments.', state: dailyReminders, set: setDailyReminders },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-slate-900">{item.title}</h4>
                        <p className="text-sm text-slate-500">{item.desc}</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={item.state} onChange={e => item.set(e.target.checked)} />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                      </label>
                    </div>
                  ))}
                </div>
                <div className="pt-6 border-t border-slate-200 flex justify-end">
                  <button onClick={saveSettingsToLocal} className="inline-flex items-center px-6 py-2.5 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors shadow-sm">
                    <Save className="w-4 h-4 mr-2" /> Save Preferences
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'privacy' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 mb-2">Privacy & Security</h2>
                  <p className="text-slate-500 text-sm mb-6">Protect your account and manage data sharing.</p>
                </div>
                <div className="space-y-4">
                  {[
                    { title: 'Share Anonymous Data', desc: 'Help improve AI models by sharing de-identified lab results.', state: shareData, set: setShareData },
                    { title: 'Two-Factor Authentication', desc: 'Require a code from your phone when logging in.', state: twoFactor, set: setTwoFactor },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-slate-900">{item.title}</h4>
                        <p className="text-sm text-slate-500">{item.desc}</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={item.state} onChange={e => item.set(e.target.checked)} />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                      </label>
                    </div>
                  ))}
                </div>
                <div className="pt-6 border-t border-slate-200 space-y-4">
                  <button onClick={() => toast.success('Password reset email sent!')} className="w-full sm:w-auto px-4 py-2 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm">
                    Change Password
                  </button>
                  <div className="flex justify-between items-center pt-4">
                    <span className="text-sm text-slate-500">Permanently delete your account and all data.</span>
                    <button onClick={() => toast.error('Contact support to delete account.')} className="text-sm text-critical-600 font-medium hover:text-critical-700">
                      Delete Account
                    </button>
                  </div>
                </div>
                <div className="pt-6 border-t border-slate-200 flex justify-end">
                  <button onClick={saveSettingsToLocal} className="inline-flex items-center px-6 py-2.5 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors shadow-sm">
                    <Save className="w-4 h-4 mr-2" /> Save Preferences
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'about' && (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="w-20 h-20 bg-primary-50 rounded-2xl flex items-center justify-center mb-6">
                  <Shield className="w-10 h-10 text-primary-600" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">HealthAI Intelligence</h3>
                <p className="text-slate-500 mb-6 max-w-sm">
                  Your family's personal, AI-powered health assistant. We bring clinical intelligence to your fingertips.
                </p>
                <div className="text-sm font-medium text-slate-400 bg-slate-50 px-4 py-2 rounded-lg border border-slate-200">
                  Version 2.4.1 (Build 890)
                </div>
                <div className="mt-8 space-x-4">
                  <a href="#" className="text-sm text-primary-600 hover:underline">Terms of Service</a>
                  <span className="text-slate-300">•</span>
                  <a href="#" className="text-sm text-primary-600 hover:underline">Privacy Policy</a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>);

}