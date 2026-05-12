import React from 'react';
import { useFamily } from '../lib/FamilyContext';
import { StatCard } from '../components/StatCard';
import { AbnormalityBadge } from '../components/AbnormalityBadge';
import {
  Calendar,
  Bell,
  FileText,
  Activity,
  ArrowRight,
  BrainCircuit,
  ChevronRight } from
'lucide-react';
import { Link } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
export function Dashboard() {
  const { activeMember, members, reports, alerts } = useFamily();
  // Filter data based on active member or show all if null
  const displayReports = activeMember ?
  reports.filter((r) => r.memberId === activeMember.id) :
  reports;
  const displayAlerts = activeMember ?
  alerts.filter((a) => a.memberId === activeMember.id) :
  alerts;
  const activeAlertsCount = displayAlerts.filter(
    (a) => a.status === 'Active'
  ).length;
  const recentReports = [...displayReports].
  sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).
  slice(0, 3);
  const upcomingReminders = displayAlerts.
  filter((a) => a.status === 'Upcoming').
  slice(0, 3);
  // Determine overall risk for stat card
  let riskScore = 'Normal';
  let riskColor = 'text-success-600 bg-success-50';
  if (activeMember) {
    riskScore = activeMember.overallRisk;
    if (riskScore === 'Borderline') riskColor = 'text-warning-600 bg-warning-50';
    if (riskScore === 'Critical') riskColor = 'text-critical-600 bg-critical-50';
  } else {
    const hasCritical = members.some((m) => m.overallRisk === 'Critical');
    const hasBorderline = members.some((m) => m.overallRisk === 'Borderline');
    if (hasCritical) {
      riskScore = 'Critical';
      riskColor = 'text-critical-600 bg-critical-50';
    } else if (hasBorderline) {
      riskScore = 'Borderline';
      riskColor = 'text-warning-600 bg-warning-50';
    }
  }
  // Dynamic trend data for mini charts
  const chronologicalReports = [...displayReports].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Extract all markers to find the most frequently tracked ones
  const markerCounts: Record<string, number> = {};
  chronologicalReports.forEach(r => {
    if (r.labValues && Array.isArray(r.labValues)) {
      r.labValues.forEach(l => {
        if (l && l.marker) {
          markerCounts[l.marker] = (markerCounts[l.marker] || 0) + 1;
        }
      });
    }
  });

  const topMarkers = Object.keys(markerCounts).sort((a, b) => markerCounts[b] - markerCounts[a]);
  const metric1Name = topMarkers[0] || 'Fasting Glucose';
  const metric2Name = topMarkers[1] || 'Systolic BP';

  const getMetricData = (markerName: string) => {
    const data: { value: number }[] = [];
    let latestUnit = '';
    let latestStatus = 'Normal';
    
    chronologicalReports.forEach(report => {
      if (report.labValues && Array.isArray(report.labValues)) {
        const match = report.labValues.find(l => l && l.marker && l.marker.toLowerCase().includes(markerName.toLowerCase()));
        if (match && !isNaN(parseFloat(match.value))) {
          data.push({ value: parseFloat(match.value) });
          latestUnit = match.unit;
          latestStatus = match.status;
        }
      }
    });
    
    return { data, latestUnit, latestStatus, latestValue: data.length > 0 ? data[data.length - 1].value : null };
  };

  const metric1 = getMetricData(metric1Name);
  const metric2 = getMetricData(metric2Name);

  const chart1Data = metric1.data.length > 0 ? metric1.data : [{ value: 95 }, { value: 92 }, { value: 85 }];
  const chart2Data = metric2.data.length > 0 ? metric2.data : [{ value: 125 }, { value: 120 }, { value: 118 }];

  const isValidDate = (d?: string) => d && new Date(d).getFullYear() > 2000;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {activeMember ?
            `Hello, ${activeMember.name.split(' ')[0]}` :
            'Family Overview'}
          </h1>
          <p className="text-slate-500">
            Here's what's happening with your health today.
          </p>
        </div>
        <Link
          to="/reports/upload"
          className="inline-flex items-center justify-center px-4 py-2 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors shadow-sm">
          
          Upload Report
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Last Checkup"
          value={
          activeMember && isValidDate(activeMember.lastReportDate) ?
          new Date(activeMember.lastReportDate).toLocaleDateString(
            undefined,
            {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            }
          ) :
          (activeMember ? 'No reports' : 'Multiple')
          }
          icon={Calendar}
          colorClass="text-primary-600 bg-primary-50" />
        
        <StatCard
          title="Active Alerts"
          value={activeAlertsCount}
          subtitle={activeAlertsCount > 0 ? 'Requires attention' : 'All clear'}
          icon={Bell}
          colorClass={
          activeAlertsCount > 0 ?
          'text-critical-600 bg-critical-50' :
          'text-success-600 bg-success-50'
          } />
        
        <StatCard
          title="Reports Stored"
          value={displayReports.length}
          icon={FileText}
          colorClass="text-indigo-600 bg-indigo-50" />
        
        <StatCard
          title="Overall Status"
          value={riskScore}
          icon={Activity}
          colorClass={riskColor} />
        
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* AI Insights */}
          <div className="bg-gradient-to-br from-primary-50 to-white rounded-2xl p-6 border border-primary-100 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <BrainCircuit className="w-24 h-24 text-primary-600" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center space-x-2 mb-4">
                <BrainCircuit className="w-5 h-5 text-primary-600" />
                <h2 className="text-lg font-bold text-slate-900">
                  AI Health Insights
                </h2>
              </div>
              <div className="space-y-4">
                {activeMember?.id === 'm4' ||
                !activeMember && members.some((m) => m.id === 'm4') ?
                <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-primary-50">
                    <p className="text-slate-700">
                      <strong>Robert's recent HbA1c is 8.2%</strong>, which is
                      above the target range. The AI recommends scheduling an
                      endocrinologist appointment to review medication.
                    </p>
                  </div> :
                null}
                <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-primary-50">
                  <p className="text-slate-700">
                    <strong>Fasting glucose trends are improving.</strong> Over
                    the last 3 reports, levels have decreased by an average of
                    5%.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Reports */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">
                Recent Reports
              </h2>
              <Link
                to="/reports"
                className="text-sm font-medium text-primary-600 hover:text-primary-700 flex items-center">
                
                View all <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </div>
            <div className="divide-y divide-slate-100">
              {recentReports.length > 0 ?
              recentReports.map((report) => {
                const member = members.find((m) => m.id === report.memberId);
                return (
                  <Link
                    key={report.id}
                    to={`/reports/${report.id}`}
                    className="flex items-center p-4 hover:bg-slate-50 transition-colors">
                    
                      <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center text-primary-600 shrink-0 mr-4">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-slate-900 truncate">
                          {report.title}
                        </h4>
                        <div className="flex items-center text-xs text-slate-500 mt-1">
                          {!activeMember && member &&
                        <>
                              <span className="truncate max-w-[100px]">
                                {member.name}
                              </span>
                              <span className="mx-1.5">•</span>
                            </>
                        }
                          <span>
                            {new Date(report.date).toLocaleDateString()}
                          </span>
                          <span className="mx-1.5">•</span>
                          <span>{report.type}</span>
                        </div>
                      </div>
                      <div className="ml-4 shrink-0">
                        <AbnormalityBadge level={report.abnormality} />
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-400 ml-4 shrink-0" />
                    </Link>);

              }) :

              <div className="p-8 text-center text-slate-500">
                  No reports found.
                </div>
              }
            </div>
          </div>

          {/* Key Vitals Mini Trends */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-sm font-medium text-slate-500">
                    {metric1Name}
                  </h3>
                  <div className="text-2xl font-bold text-slate-900 mt-1">
                    {metric1.latestValue ?? 85}{' '}
                    <span className="text-sm font-normal text-slate-500">
                      {metric1.latestUnit || 'mg/dL'}
                    </span>
                  </div>
                </div>
                <AbnormalityBadge level={metric1.latestStatus} />
              </div>
              <div className="h-16 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chart1Data}>
                    <YAxis domain={['dataMin - 10', 'dataMax + 10']} hide />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={metric1.latestStatus === 'Critical' ? '#ef4444' : metric1.latestStatus === 'Borderline' ? '#f59e0b' : '#10b981'}
                      strokeWidth={2}
                      dot={false} />
                    
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-sm font-medium text-slate-500">
                    {metric2Name}
                  </h3>
                  <div className="text-2xl font-bold text-slate-900 mt-1">
                    {metric2.latestValue ?? 118}{' '}
                    <span className="text-sm font-normal text-slate-500">
                      {metric2.latestUnit || 'mmHg'}
                    </span>
                  </div>
                </div>
                <AbnormalityBadge level={metric2.latestStatus} />
              </div>
              <div className="h-16 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chart2Data}>
                    <YAxis domain={['dataMin - 10', 'dataMax + 10']} hide />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={metric2.latestStatus === 'Critical' ? '#ef4444' : metric2.latestStatus === 'Borderline' ? '#f59e0b' : '#10b981'}
                      strokeWidth={2}
                      dot={false} />
                    
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* Side Column */}
        <div className="space-y-6">
          {/* Upcoming Reminders */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Upcoming</h2>
              <Link
                to="/alerts"
                className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                
                View all
              </Link>
            </div>
            <div className="p-2">
              {upcomingReminders.length > 0 ?
              upcomingReminders.map((reminder) => {
                const member = members.find((m) => m.id === reminder.memberId);
                return (
                  <div
                    key={reminder.id}
                    className="flex items-start p-3 hover:bg-slate-50 rounded-xl transition-colors">
                    
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0 mr-3">
                        <Calendar className="w-5 h-5 text-slate-500" />
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-slate-900">
                          {reminder.title}
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                          {reminder.description}
                        </p>
                        <div className="flex items-center mt-2 space-x-2">
                          <span className="text-xs font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                            {new Date(reminder.date).toLocaleDateString(
                            undefined,
                            {
                              month: 'short',
                              day: 'numeric'
                            }
                          )}
                          </span>
                          {!activeMember && member &&
                        <span className="text-xs text-slate-500 flex items-center">
                              <Avatar
                            name={member.name}
                            src={member.avatarUrl}
                            size="sm"
                            className="w-4 h-4 mr-1" />
                          
                              {member.name.split(' ')[0]}
                            </span>
                        }
                        </div>
                      </div>
                    </div>);

              }) :

              <div className="p-4 text-center text-sm text-slate-500">
                  No upcoming reminders.
                </div>
              }
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-base font-bold text-slate-900 mb-4">
              Quick Actions
            </h2>
            <div className="space-y-2">
              <Link
                to="/assistant"
                className="w-full flex items-center p-3 rounded-xl hover:bg-slate-50 border border-slate-100 transition-colors group">
                
                <div className="w-8 h-8 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center mr-3 group-hover:bg-primary-100 transition-colors">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium text-slate-700">
                  Ask AI Assistant
                </span>
              </Link>
              <Link
                to="/family"
                className="w-full flex items-center p-3 rounded-xl hover:bg-slate-50 border border-slate-100 transition-colors group">
                
                <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center mr-3 group-hover:bg-slate-200 transition-colors">
                  <Users className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium text-slate-700">
                  Manage Family
                </span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>);

}
// Need to import missing icons
import { MessageSquare, Users } from 'lucide-react';