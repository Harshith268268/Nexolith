import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useFamily, API_BASE } from '../lib/FamilyContext';
import {
  ArrowLeft,
  Download,
  Share2,
  FileText,
  BrainCircuit,
  Activity,
  Stethoscope,
  Info } from
'lucide-react';
import { AbnormalityBadge } from '../components/AbnormalityBadge';
import { Avatar } from '../components/Avatar';
export function ReportDetail() {
  const { id } = useParams();
  const { reports, members } = useFamily();
  const report = reports.find((r) => r.id === id);
  const member = report ? members.find((m) => m.id === report.memberId) : undefined;
  const [activeTab, setActiveTab] = useState<
    'summary' | 'values' | 'original' | 'notes'>(
    'summary');
  const [simplifying, setSimplifying] = useState<string | null>(null);
  const [simplifiedText, setSimplifiedText] = useState<{term: string, text: string} | null>(null);

  const handleSimplify = async (term: string) => {
    setSimplifying(term);
    try {
      const res = await fetch(`${API_BASE}/api/simplify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: term })
      });
      const data = await res.json();
      setSimplifiedText({ term, text: data.simplified });
    } catch (err) {
      console.error(err);
    } finally {
      setSimplifying(null);
    }
  };

  if (!report) return <div>Report not found</div>;
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link
            to="/reports"
            className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-slate-500">
            
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center space-x-3 mb-1">
              <h1 className="text-2xl font-bold text-slate-900">
                {report.title}
              </h1>
              <AbnormalityBadge level={report.abnormality} />
            </div>
            <div className="flex items-center text-sm text-slate-500 space-x-4">
              <span className="flex items-center">
                <Calendar className="w-4 h-4 mr-1.5" />
                {new Date(report.date).toLocaleDateString(undefined, {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </span>
              {member &&
              <span className="flex items-center">
                  <Avatar
                  name={member.name}
                  src={member.avatarUrl}
                  size="sm"
                  className="w-5 h-5 mr-1.5" />
                
                  {member.name}
                </span>
              }
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-slate-600"
            title="Share">
            
            <Share2 className="w-5 h-5" />
          </button>
          <button
            className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-slate-600"
            title="Download PDF">
            
            <Download className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tabs */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex border-b border-slate-200 overflow-x-auto scrollbar-hide">
              {[
              {
                id: 'summary',
                label: 'AI Summary',
                icon: BrainCircuit
              },
              {
                id: 'values',
                label: 'Extracted Values',
                icon: Activity
              },
              {
                id: 'original',
                label: 'Original Document',
                icon: FileText
              },
              {
                id: 'notes',
                label: "Doctor's Notes",
                icon: Stethoscope
              }].
              map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${isActive ? 'border-primary-500 text-primary-600 bg-primary-50/50' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
                    
                    <Icon className="w-4 h-4 mr-2" />
                    {tab.label}
                  </button>);

              })}
            </div>

            <div className="p-6 min-h-[400px]">
              {activeTab === 'summary' &&
              <div className="space-y-6">
                  <div className="bg-primary-50 border border-primary-100 rounded-xl p-5">
                    <div className="flex items-start">
                      <BrainCircuit className="w-5 h-5 text-primary-600 mt-0.5 mr-3 shrink-0" />
                      <div>
                        <h3 className="font-semibold text-primary-900 mb-2">
                          Plain English Summary
                        </h3>
                        <p className="text-primary-800 leading-relaxed">
                          {report.summary ||
                        'No AI summary available for this report yet.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {report.abnormality !== 'Normal' &&
                <div
                  className={`rounded-xl p-5 border ${report.abnormality === 'Critical' ? 'bg-critical-50 border-critical-100' : 'bg-warning-50 border-warning-100'}`}>
                  
                      <h3
                    className={`font-semibold mb-2 ${report.abnormality === 'Critical' ? 'text-critical-900' : 'text-warning-900'}`}>
                    
                        Key Areas of Concern
                      </h3>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        {report.labValues?.
                    filter((v) => v.status !== 'Normal').
                    map((v) =>
                    <li
                      key={v.id}
                      className={
                      report.abnormality === 'Critical' ?
                      'text-critical-800' :
                      'text-warning-800'
                      }>
                      
                              <button
                        onClick={() => handleSimplify(v.parameter)}
                        className="font-medium border-b border-dashed border-current cursor-help hover:text-primary-700 focus:outline-none transition-colors"
                        title="Click to ask AI to simplify this term">
                        
                                {v.parameter}
                              </button>{' '}
                              is {v.status.toLowerCase()} ({v.value} {v.unit})
                            </li>
                    )}
                      </ul>
                    </div>
                }
                </div>
              }

              {activeTab === 'values' &&
              <div>
                  {report.labValues && report.labValues.length > 0 ?
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                          <tr>
                            <th className="px-4 py-3 font-medium">Parameter</th>
                            <th className="px-4 py-3 font-medium">Result</th>
                            <th className="px-4 py-3 font-medium">
                              Reference Range
                            </th>
                            <th className="px-4 py-3 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {report.labValues.map((val) =>
                      <tr key={val.id} className="hover:bg-slate-50">
                              <td className="px-4 py-3 font-medium text-slate-900 flex items-center">
                                {val.parameter}
                                <button onClick={() => handleSimplify(val.parameter)} className="focus:outline-none ml-1.5 hover:text-primary-600 transition-colors" title="Simplify this parameter">
                                  <Info className="w-3.5 h-3.5 text-slate-400 hover:text-primary-600" />
                                </button>
                              </td>
                              <td className="px-4 py-3">
                                <span
                            className={`font-semibold ${val.status === 'Critical' ? 'text-critical-600' : val.status === 'Borderline' ? 'text-warning-600' : 'text-slate-900'}`}>
                            
                                  {val.value}
                                </span>
                                <span className="text-slate-500 ml-1">
                                  {val.unit}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-slate-500">
                                {val.referenceRange}
                              </td>
                              <td className="px-4 py-3">
                                <AbnormalityBadge level={val.status} />
                              </td>
                            </tr>
                      )}
                        </tbody>
                      </table>
                    </div> :

                <div className="text-center text-slate-500 py-12">
                      No structured lab values extracted for this report.
                    </div>
                }
                </div>
              }

              {activeTab === 'original' &&
              <div className="bg-slate-100 rounded-xl h-[500px] flex items-center justify-center border border-slate-200">
                  <div className="text-center">
                    <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">
                      PDF Viewer Placeholder
                    </p>
                    <p className="text-sm text-slate-400 mt-1">
                      Document.pdf (2.4 MB)
                    </p>
                  </div>
                </div>
              }

              {activeTab === 'notes' &&
              <div className="prose prose-slate max-w-none">
                  {report.doctorNotes ?
                <div className="bg-amber-50/50 rounded-xl p-6 border border-amber-100 font-serif text-slate-800 leading-relaxed relative group">
                      "{report.doctorNotes}"
                      <button onClick={() => handleSimplify(report.doctorNotes!)} className="absolute top-2 right-2 px-3 py-1.5 bg-white rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center text-xs text-primary-600 font-sans font-medium hover:bg-primary-50 border border-primary-100">
                        <BrainCircuit className="w-3 h-3 mr-1.5" /> Simplify Notes
                      </button>
                    </div> :

                <div className="text-center text-slate-500 py-12">
                      No doctor's notes attached to this report.
                    </div>
                }
                </div>
              }
            </div>
          </div>
        </div>

        {/* Side Panel */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center">
              <TrendingUp className="w-4 h-4 mr-2 text-primary-500" />
              Compare to Previous
            </h3>

            {report.labValues && report.labValues.length > 0 ?
            <div className="space-y-4">
                <p className="text-xs text-slate-500 mb-2">
                  Compared to report from Oct 10, 2022
                </p>
                {report.labValues.slice(0, 3).map((val) => {
                // Mock comparison logic
                const isBetter = val.status === 'Normal';
                const delta = isBetter ? '-3.2%' : '+5.4%';
                return (
                  <div
                    key={val.id}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                    
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {val.parameter}
                        </p>
                        <p className="text-xs text-slate-500">
                          {val.value} {val.unit}
                        </p>
                      </div>
                      <div
                      className={`flex items-center text-sm font-medium ${isBetter ? 'text-success-600' : 'text-warning-600'}`}>
                      
                        {isBetter ? '↓' : '↑'} {delta}
                      </div>
                    </div>);

              })}
                <Link
                to="/trends"
                className="block w-full text-center py-2 text-sm text-primary-600 font-medium hover:bg-primary-50 rounded-lg transition-colors mt-2">
                
                  View Full Trends
                </Link>
              </div> :

            <p className="text-sm text-slate-500">
                Not enough data to compare.
              </p>
            }
          </div>

          <div className="bg-gradient-to-br from-primary-600 to-primary-800 rounded-2xl shadow-sm p-6 text-white">
            <h3 className="font-bold mb-2 flex items-center">
              <MessageSquare className="w-4 h-4 mr-2" />
              Have questions?
            </h3>
            <p className="text-primary-100 text-sm mb-4">
              Ask the AI assistant to explain any part of this report in detail.
            </p>
            <Link
              to="/assistant"
              className="inline-block w-full text-center bg-white text-primary-700 font-medium py-2 rounded-xl hover:bg-primary-50 transition-colors text-sm shadow-sm">
              
              Ask AI Assistant
            </Link>
          </div>
        </div>
      </div>

      {/* Simplification Modal */}
      {simplifiedText && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-primary-50/50">
              <h3 className="font-bold text-slate-900 flex items-center truncate pr-4">
                <BrainCircuit className="w-5 h-5 text-primary-600 mr-2 shrink-0" />
                <span className="truncate">AI Simplified: {simplifiedText.term}</span>
              </h3>
              <button onClick={() => setSimplifiedText(null)} className="text-slate-400 hover:text-slate-600 shrink-0">✕</button>
            </div>
            <div className="p-5">
              <p className="text-slate-700 leading-relaxed">{simplifiedText.text}</p>
              <div className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
                <span>Translated to 5th-grade reading level</span>
                <button onClick={() => setSimplifiedText(null)} className="font-medium text-primary-600 hover:text-primary-700">Got it</button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {simplifying && (
        <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <div className="bg-white px-6 py-4 rounded-xl shadow-lg font-medium text-slate-700 flex items-center max-w-md w-full sm:w-auto">
             <BrainCircuit className="w-5 h-5 text-primary-600 mr-3 animate-pulse shrink-0" />
             <span className="truncate">Simplifying "{simplifying}"...</span>
           </div>
        </div>
      )}

    </div>);

}
import { Calendar, TrendingUp, MessageSquare } from 'lucide-react';