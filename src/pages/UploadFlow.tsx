import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFamily, API_BASE } from '../lib/FamilyContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  BrainCircuit } from 'lucide-react';
import { Avatar } from '../components/Avatar';
import { AbnormalityBadge } from '../components/AbnormalityBadge';
import { toast } from 'sonner';

type Step = 'upload' | 'processing' | 'review';

interface ExtractedRow {
  id: string;
  parameter: string;
  value: number | string;
  unit: string;
  referenceRange: string;
  status: string;
  date: string;
}

export function UploadFlow() {
  const { members, activeMember, addReport } = useFamily();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('upload');
  const [selectedMemberId, setSelectedMemberId] = useState<string>(
    activeMember?.id || members[0]?.id || ''
  );
  const [file, setFile] = useState<File | null>(null);
  const [processingStatus, setProcessingStatus] = useState('Uploading document...');
  const [progress, setProgress] = useState(0);
  const [extractedData, setExtractedData] = useState<ExtractedRow[]>([]);
  const [aiSummary, setAiSummary] = useState('');
  const [aiType, setAiType] = useState('Blood');
  const [aiAbnormality, setAiAbnormality] = useState('Normal');
  const [saving, setSaving] = useState(false);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setFile(e.target.files[0]);
  };

  const startProcessing = async () => {
    if (!file) return;
    setStep('processing');
    setProgress(10);
    setProcessingStatus('Uploading document...');

    try {
      const formData = new FormData();
      formData.append('report', file);

      setProgress(30);
      setProcessingStatus('Extracting text via OCR...');

          const res = await fetch(`${API_BASE}/api/analyze-report`, {
        method: 'POST',
        body: formData
      });

      setProgress(70);
      setProcessingStatus('Analyzing values with AI...');

      if (!res.ok) throw new Error('Analysis failed');

      const data = await res.json();

      setProgress(100);
      setProcessingStatus('Complete!');
      setExtractedData(data.labValues || []);
      setAiSummary(data.summary || '');
      setAiType(data.type || 'Blood');
      setAiAbnormality(data.abnormality || 'Normal');

      setTimeout(() => setStep('review'), 500);
    } catch (err) {
      console.error(err);
      toast.error('Failed to analyze report. Please try again.');
      setStep('upload');
    }
  };

  const handleSave = async () => {
    if (!selectedMemberId) return;
    setSaving(true);
    try {
      await addReport({
        memberId: selectedMemberId,
        title: file?.name?.replace(/\.[^.]+$/, '') || 'Medical Report',
        date: new Date().toISOString().split('T')[0],
        type: aiType as any,
        abnormality: aiAbnormality as any,
        summary: aiSummary,
        doctorNotes: '',
        labValues: extractedData.map(r => ({
          id: r.id || String(Math.random()),
          parameter: r.parameter,
          value: Number(r.value) || 0,
          unit: r.unit,
          referenceRange: r.referenceRange,
          status: r.status as any,
          date: r.date || new Date().toISOString().split('T')[0]
        }))
      });
      toast.success('Report saved successfully!');
      navigate('/reports');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save report');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8">
      {/* Stepper Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Upload Medical Report</h1>
        <div className="flex items-center justify-between relative">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-200 -z-10 rounded-full"></div>
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-primary-500 -z-10 rounded-full transition-all duration-500"
            style={{ width: step === 'upload' ? '0%' : step === 'processing' ? '50%' : '100%' }}
          ></div>

          {[
            { id: 'upload', label: 'Upload', icon: UploadCloud },
            { id: 'processing', label: 'AI Processing', icon: BrainCircuit },
            { id: 'review', label: 'Review', icon: CheckCircle2 }
          ].map((s, i) => {
            const isActive = step === s.id;
            const isPast = (step === 'processing' && i === 0) || (step === 'review' && i < 2);
            const Icon = s.icon;
            return (
              <div key={s.id} className="flex flex-col items-center bg-slate-50 px-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${isActive ? 'border-primary-500 bg-primary-50 text-primary-600' : isPast ? 'border-primary-500 bg-primary-500 text-white' : 'border-slate-300 bg-white text-slate-400'}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className={`text-xs font-medium mt-2 ${isActive || isPast ? 'text-slate-900' : 'text-slate-500'}`}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px] relative">
        <AnimatePresence mode="wait">
          {step === 'upload' && (
            <motion.div key="upload" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="p-6 sm:p-8">
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-3">Who is this report for?</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {members.map(member => (
                    <button
                      key={member.id}
                      onClick={() => setSelectedMemberId(member.id)}
                      className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all ${selectedMemberId === member.id ? 'border-primary-500 bg-primary-50' : 'border-slate-100 hover:border-slate-200 bg-white'}`}
                    >
                      <Avatar name={member.name} src={member.avatarUrl} size="md" className="mb-2" />
                      <span className="text-xs font-medium text-center text-slate-700">{member.name.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
                {members.length === 0 && (
                  <p className="text-sm text-slate-500 mt-2">No family members yet. <a href="/family" className="text-primary-600 underline">Add one first.</a></p>
                )}
              </div>

              <div
                onDragOver={e => e.preventDefault()}
                onDrop={handleFileDrop}
                className={`border-2 border-dashed rounded-2xl p-10 text-center transition-colors ${file ? 'border-primary-500 bg-primary-50' : 'border-slate-300 hover:border-primary-400 hover:bg-slate-50'}`}
              >
                {file ? (
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 bg-white rounded-xl shadow-sm flex items-center justify-center mb-4 text-primary-600">
                      <FileText className="w-8 h-8" />
                    </div>
                    <p className="text-sm font-medium text-slate-900">{file.name}</p>
                    <p className="text-xs text-slate-500 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    <button onClick={() => setFile(null)} className="mt-4 text-sm text-red-600 hover:text-red-700 font-medium">Remove file</button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-500">
                      <UploadCloud className="w-8 h-8" />
                    </div>
                    <p className="text-base font-medium text-slate-900 mb-1">Drag and drop your report here</p>
                    <p className="text-sm text-slate-500 mb-6">Supports PDF, JPG, PNG (Max 10MB)</p>
                    <label className="cursor-pointer inline-flex items-center justify-center px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors shadow-sm">
                      Browse Files
                      <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileSelect} />
                    </label>
                  </div>
                )}
              </div>

              <div className="mt-8 flex justify-end">
                <button
                  onClick={startProcessing}
                  disabled={!file || !selectedMemberId}
                  className="inline-flex items-center justify-center px-6 py-2.5 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Process with AI <ArrowRight className="w-4 h-4 ml-2" />
                </button>
              </div>
            </motion.div>
          )}

          {step === 'processing' && (
            <motion.div key="processing" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }} className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-white">
              <div className="relative w-24 h-24 mb-8">
                <svg className="w-full h-full text-slate-100" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8" />
                </svg>
                <svg className="w-full h-full absolute top-0 left-0 text-primary-500 transition-all duration-500 ease-out" viewBox="0 0 100 100"
                  style={{ strokeDasharray: 283, strokeDashoffset: 283 - (283 * progress / 100) }}>
                  <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" className="origin-center -rotate-90" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <BrainCircuit className="w-8 h-8 text-primary-600 animate-pulse" />
                </div>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Analyzing Report</h3>
              <p className="text-slate-500 animate-pulse">{processingStatus}</p>
            </motion.div>
          )}

          {step === 'review' && (
            <motion.div key="review" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="p-6 sm:p-8 flex flex-col h-full">
              <div className="mb-4 flex items-start justify-between bg-green-50 p-4 rounded-xl border border-green-100">
                <div className="flex items-start">
                  <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 mr-3 shrink-0" />
                  <div>
                    <h4 className="text-sm font-bold text-green-900">Extraction Complete</h4>
                    <p className="text-sm text-green-700 mt-1">{aiSummary || 'AI successfully analyzed the report.'}</p>
                  </div>
                </div>
                <AbnormalityBadge level={aiAbnormality as any} />
              </div>

              <div className="flex-1 overflow-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Parameter</th>
                      <th className="px-4 py-3 font-medium">Value</th>
                      <th className="px-4 py-3 font-medium">Unit</th>
                      <th className="px-4 py-3 font-medium">Range</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {extractedData.map((row, idx) => (
                      <tr key={row.id || idx} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <input type="text" value={row.parameter}
                            onChange={e => { const d = [...extractedData]; d[idx].parameter = e.target.value; setExtractedData(d); }}
                            className="w-full bg-transparent border-none focus:ring-0 p-0 font-medium text-slate-900" />
                        </td>
                        <td className="px-4 py-3">
                          <input type="text" value={String(row.value)}
                            onChange={e => { const d = [...extractedData]; d[idx].value = e.target.value; setExtractedData(d); }}
                            className="w-16 bg-transparent border-b border-dashed border-slate-300 focus:border-primary-500 focus:ring-0 p-0 text-slate-900" />
                        </td>
                        <td className="px-4 py-3 text-slate-500">{row.unit}</td>
                        <td className="px-4 py-3 text-slate-500">{row.referenceRange}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${row.status === 'Normal' ? 'bg-green-50 text-green-700' : row.status === 'Critical' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {extractedData.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No lab values extracted.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-8 flex justify-between items-center pt-4 border-t border-slate-100">
                <button onClick={() => setStep('upload')} className="text-slate-500 hover:text-slate-700 font-medium text-sm flex items-center">
                  <ArrowLeft className="w-4 h-4 mr-1" /> Start Over
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center justify-center px-6 py-2.5 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors shadow-sm disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Save to Records'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
