import { useState } from 'react';
import { useFamily } from '../lib/FamilyContext';
import {
  Bell, Calendar, Check, Clock, AlertCircle,
  Loader2, X, Stethoscope, AlarmClock
} from 'lucide-react';
import { Avatar } from '../components/Avatar';
import { toast } from 'sonner';

type ModalType = 'reminder' | 'appointment' | 'reschedule' | null;

export function Alerts() {
  const { activeMember, members, alerts, addAlert, markAlertRead, rescheduleAlert } = useFamily();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'Active' | 'Upcoming' | 'History'>('Active');
  const [modalType, setModalType] = useState<ModalType>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState(activeMember?.id || members[0]?.id || '');
  const [doctorName, setDoctorName] = useState('');
  const [location, setLocation] = useState('');
  const [severity, setSeverity] = useState<'Normal' | 'Borderline' | 'Critical'>('Normal');

  const displayAlerts = alerts.filter((a) => {
    if (activeMember && a.memberId !== activeMember.id) return false;
    return a.status === activeTab;
  });

  const getSeverityStyle = (sev: string) => {
    switch (sev) {
      case 'Critical': return 'bg-red-50 border-red-200 text-red-700';
      case 'Borderline': return 'bg-amber-50 border-amber-200 text-amber-700';
      default: return 'bg-slate-50 border-slate-200 text-slate-700';
    }
  };

  const getIcon = (type: string, sev: string) => {
    if (type === 'Appointment') return <Stethoscope className="w-5 h-5 text-primary-500" />;
    if (type === 'Alert') return <AlertCircle className={`w-5 h-5 ${sev === 'Critical' ? 'text-red-500' : 'text-amber-500'}`} />;
    return <AlarmClock className="w-5 h-5 text-slate-500" />;
  };

  const resetForm = () => {
    setTitle(''); setDescription(''); setDate('');
    setDoctorName(''); setLocation(''); setSeverity('Normal');
    setSelectedMemberId(activeMember?.id || members[0]?.id || '');
    setModalType(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      if (modalType === 'reschedule' && reschedulingId) {
        if (!date) { toast.error('Please select a new date'); return; }
        await rescheduleAlert(reschedulingId, date);
        toast.success('Rescheduled successfully!');
        resetForm();
        setReschedulingId(null);
        return;
      }

      if (!selectedMemberId) { toast.error('Please select a family member'); return; }
      const isAppointment = modalType === 'appointment';
      await addAlert({
        memberId: selectedMemberId,
        title: isAppointment
          ? `Appointment: ${title}${doctorName ? ` with ${doctorName}` : ''}`
          : title,
        description: isAppointment
          ? `${description}${location ? `\nLocation: ${location}` : ''}`
          : description,
        date,
        severity,
        type: isAppointment ? 'Appointment' : 'Reminder',
        status: 'Upcoming'
      });
      toast.success(isAppointment ? 'Appointment added!' : 'Reminder added!');
      resetForm();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setFormLoading(false);
    }
  };

  const alertCounts = {
    Active: alerts.filter(a => (!activeMember || a.memberId === activeMember.id) && a.status === 'Active').length,
    Upcoming: alerts.filter(a => (!activeMember || a.memberId === activeMember.id) && a.status === 'Upcoming').length,
    History: alerts.filter(a => (!activeMember || a.memberId === activeMember.id) && a.status === 'History').length,
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Alerts & Reminders</h1>
          <p className="text-slate-500">Manage health reminders and doctor appointments.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setModalType('reminder'); setSelectedMemberId(activeMember?.id || members[0]?.id || ''); }}
            className="inline-flex items-center justify-center px-4 py-2 bg-slate-800 text-white rounded-xl font-medium hover:bg-slate-900 transition-colors shadow-sm text-sm"
          >
            <AlarmClock className="w-4 h-4 mr-2" /> Add Reminder
          </button>
          <button
            onClick={() => { setModalType('appointment'); setSelectedMemberId(activeMember?.id || members[0]?.id || ''); }}
            className="inline-flex items-center justify-center px-4 py-2 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors shadow-sm text-sm"
          >
            <Stethoscope className="w-4 h-4 mr-2" /> Book Appointment
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-200">
          {(['Active', 'Upcoming', 'History'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-primary-500 text-primary-600 bg-primary-50/50' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
            >
              {tab}
              {alertCounts[tab] > 0 && (
                <span className={`ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${activeTab === tab ? 'bg-primary-100 text-primary-700' : 'bg-slate-100 text-slate-600'}`}>
                  {alertCounts[tab]}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="p-4 sm:p-6">
          {displayAlerts.length > 0 ? (
            <div className="space-y-4">
              {displayAlerts.map((alert) => {
                const member = members.find(m => m.id === alert.memberId);
                return (
                  <div key={alert.id} className={`p-4 rounded-xl border ${getSeverityStyle(alert.severity)} flex flex-col sm:flex-row gap-4`}>
                    <div className="flex items-start flex-1">
                      <div className="mt-1 mr-4 shrink-0 bg-white p-2 rounded-lg shadow-sm">
                        {getIcon(alert.type, alert.severity)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center flex-wrap gap-2 mb-1">
                          <h3 className="font-bold text-slate-900">{alert.title}</h3>
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white/80 border border-current/20 opacity-80">
                            {alert.type}
                          </span>
                        </div>
                        {alert.description && (
                          <p className="text-sm opacity-90 mb-3 whitespace-pre-line">{alert.description}</p>
                        )}
                        <div className="flex items-center flex-wrap gap-4 text-xs font-medium opacity-75">
                          <span className="flex items-center">
                            <Clock className="w-3.5 h-3.5 mr-1" />
                            {new Date(alert.date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                          </span>
                          {!activeMember && member && (
                            <span className="flex items-center">
                              <Avatar name={member.name} src={member.avatarUrl} size="sm" className="w-4 h-4 mr-1.5" />
                              {member.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {activeTab !== 'History' && (
                      <div className="flex sm:flex-col gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 sm:border-l border-current/10 sm:pl-4">
                        <button
                          onClick={async () => {
                            setSavingId(alert.id);
                            await markAlertRead(alert.id);
                            setSavingId(null);
                          }}
                          disabled={savingId === alert.id}
                          className="flex-1 sm:flex-none inline-flex items-center justify-center px-3 py-1.5 bg-white rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm border border-slate-200 text-slate-700 disabled:opacity-60"
                        >
                          {savingId === alert.id
                            ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                            : <Check className="w-4 h-4 mr-1.5 text-green-500" />}
                          Mark Done
                        </button>
                        
                        <button
                          onClick={() => {
                            setReschedulingId(alert.id);
                            setDate(alert.date);
                            setModalType('reschedule');
                          }}
                          className="flex-1 sm:flex-none inline-flex items-center justify-center px-3 py-1.5 bg-white rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm border border-slate-200 text-slate-700"
                        >
                          <Calendar className="w-4 h-4 mr-1.5 text-primary-500" />
                          Reschedule
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Bell className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-1">No {activeTab.toLowerCase()} alerts</h3>
              <p className="text-slate-500">
                {activeTab === 'Upcoming' ? 'Book an appointment or add a reminder to see it here.' : "You're all caught up!"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            {/* Modal Header */}
            <div className={`px-6 py-4 border-b border-slate-200 flex items-center justify-between ${modalType === 'appointment' ? 'bg-primary-50' : 'bg-slate-50'}`}>
              <div className="flex items-center gap-3">
                {modalType === 'appointment'
                  ? <Stethoscope className="w-5 h-5 text-primary-600" />
                  : modalType === 'reschedule' 
                  ? <Calendar className="w-5 h-5 text-primary-600" />
                  : <AlarmClock className="w-5 h-5 text-slate-600" />}
                <h2 className="text-lg font-bold text-slate-900">
                  {modalType === 'appointment' ? 'Book Doctor Appointment' : modalType === 'reschedule' ? 'Reschedule' : 'Add Health Reminder'}
                </h2>
              </div>
              <button onClick={() => { resetForm(); setReschedulingId(null); }} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {modalType === 'reschedule' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">New Date</label>
                    <input
                      required
                      type="date"
                      value={date}
                      onChange={e => setDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary-100 focus:border-primary-500 outline-none"
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => { resetForm(); setReschedulingId(null); }} className="flex-1 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition-colors border border-slate-200">Cancel</button>
                    <button type="submit" disabled={formLoading} className="flex-1 py-2.5 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60 bg-primary-600 hover:bg-primary-700">
                      {formLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                      Save Date
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Member Select */}
                  {!activeMember && members.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">For whom?</label>
                  <select
                    value={selectedMemberId}
                    onChange={e => setSelectedMemberId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary-100 focus:border-primary-500 outline-none"
                  >
                    {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  {modalType === 'appointment' ? 'Appointment Title' : 'Reminder Title'}
                </label>
                <input
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder={modalType === 'appointment' ? 'e.g. Annual Physical Exam' : 'e.g. Take Vitamin D supplement'}
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary-100 focus:border-primary-500 outline-none"
                />
              </div>

              {/* Appointment-specific fields */}
              {modalType === 'appointment' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Doctor / Specialist</label>
                    <input
                      value={doctorName}
                      onChange={e => setDoctorName(e.target.value)}
                      placeholder="e.g. Dr. Sharma, Cardiologist"
                      className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary-100 focus:border-primary-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Clinic / Hospital</label>
                    <input
                      value={location}
                      onChange={e => setLocation(e.target.value)}
                      placeholder="e.g. Apollo Hospital, Room 302"
                      className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary-100 focus:border-primary-500 outline-none"
                    />
                  </div>
                </>
              )}

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes (optional)</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={3}
                  placeholder={modalType === 'appointment' ? 'Bring previous reports, fasting required...' : 'Additional details...'}
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary-100 focus:border-primary-500 outline-none resize-none"
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  {modalType === 'appointment' ? 'Appointment Date' : 'Reminder Date'}
                </label>
                <input
                  required
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary-100 focus:border-primary-500 outline-none"
                />
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Priority</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Normal', 'Borderline', 'Critical'] as const).map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSeverity(s)}
                      className={`py-2 rounded-xl text-sm font-medium border-2 transition-all ${
                        severity === s
                          ? s === 'Critical' ? 'border-red-500 bg-red-50 text-red-700'
                            : s === 'Borderline' ? 'border-amber-500 bg-amber-50 text-amber-700'
                            : 'border-green-500 bg-green-50 text-green-700'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {s === 'Normal' ? 'Low' : s === 'Borderline' ? 'Medium' : 'High'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { resetForm(); setReschedulingId(null); }}
                  className="flex-1 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition-colors border border-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className={`flex-1 py-2.5 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60 ${
                    modalType === 'appointment' ? 'bg-primary-600 hover:bg-primary-700' : 'bg-slate-800 hover:bg-slate-900'
                  }`}
                >
                  {formLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {modalType === 'appointment' ? 'Book Appointment' : 'Save Reminder'}
                </button>
              </div>
            </>
          )}
        </form>
          </div>
        </div>
      )}
    </div>
  );
}