import React, { useMemo, useState } from 'react';
import { useFamily } from '../lib/FamilyContext';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine
} from 'recharts';
import { Activity, Calendar, TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react';
import { AbnormalityBadge } from '../components/AbnormalityBadge';
import { Link } from 'react-router-dom';

// Known reference ranges for common parameters
const REFERENCE_RANGES: Record<string, { min: number; max: number; unit: string }> = {
  'Glucose': { min: 70, max: 99, unit: 'mg/dL' },
  'Fasting Glucose': { min: 70, max: 99, unit: 'mg/dL' },
  'HbA1c': { min: 4.0, max: 5.6, unit: '%' },
  'Total Cholesterol': { min: 0, max: 199, unit: 'mg/dL' },
  'LDL': { min: 0, max: 99, unit: 'mg/dL' },
  'HDL': { min: 40, max: 999, unit: 'mg/dL' },
  'Hemoglobin': { min: 12.1, max: 17.2, unit: 'g/dL' },
  'Systolic BP': { min: 90, max: 120, unit: 'mmHg' },
  'Calcium': { min: 8.6, max: 10.2, unit: 'mg/dL' },
  'Sodium': { min: 135, max: 145, unit: 'mEq/L' },
  'Iron': { min: 65, max: 176, unit: 'mcg/dL' },
  'Vitamin D': { min: 20, max: 50, unit: 'ng/mL' },
  'Vitamin B12': { min: 200, max: 900, unit: 'pg/mL' },
};

function getStatusForValue(value: number, param: string): 'Normal' | 'Borderline' | 'Critical' {
  const range = REFERENCE_RANGES[param];
  if (!range) return 'Normal';
  if (value < range.min || value > range.max) {
    const deviation = value > range.max
      ? (value - range.max) / range.max
      : (range.min - value) / range.min;
    return deviation > 0.2 ? 'Critical' : 'Borderline';
  }
  return 'Normal';
}

export function Trends() {
  const { activeMember, reports } = useFamily();

  // Extract all unique parameters from real reports
  const memberReports = useMemo(() => {
    if (!activeMember) return reports;
    return reports.filter(r => r.memberId === activeMember.id);
  }, [reports, activeMember]);

  // Build a map of parameter -> [{date, value, unit, reportId, reportTitle}]
  const parameterData = useMemo(() => {
    const map: Record<string, { date: string; value: number; unit: string; reportId: string; reportTitle: string; status: string }[]> = {};

    const sorted = [...memberReports].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    sorted.forEach(report => {
      if (!report.labValues) return;
      report.labValues.forEach((lv: any) => {
        const param = lv.parameter;
        const val = Number(lv.value);
        if (isNaN(val)) return;
        if (!map[param]) map[param] = [];
        map[param].push({
          date: report.date,
          value: val,
          unit: lv.unit || '',
          reportId: report.id,
          reportTitle: report.title || 'Report',
          status: lv.status || getStatusForValue(val, param)
        });
      });
    });

    return map;
  }, [memberReports]);

  const parameters = Object.keys(parameterData);
  const [selectedParam, setSelectedParam] = useState<string>('');

  // Auto-select first parameter when data loads
  const effectiveParam = selectedParam && parameterData[selectedParam] ? selectedParam : (parameters[0] || '');

  const chartData = effectiveParam ? parameterData[effectiveParam] : [];
  const range = REFERENCE_RANGES[effectiveParam];
  const unit = chartData[0]?.unit || range?.unit || '';

  const latestValue = chartData[chartData.length - 1]?.value;
  const prevValue = chartData[chartData.length - 2]?.value;
  const trend = latestValue !== undefined && prevValue !== undefined
    ? latestValue > prevValue ? 'up' : latestValue < prevValue ? 'down' : 'flat'
    : null;

  const latestStatus = latestValue !== undefined
    ? (chartData[chartData.length - 1]?.status as any) || getStatusForValue(latestValue, effectiveParam)
    : 'Normal';

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-sm">
          <p className="font-semibold text-slate-900">{new Date(d.date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          <p className="text-primary-600 font-bold mt-1">{d.value} {unit}</p>
          <p className="text-slate-500 text-xs">{d.reportTitle}</p>
        </div>
      );
    }
    return null;
  };

  if (memberReports.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Health Trends</h1>
          <p className="text-slate-500">Track vital parameters over time.</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-16 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <TrendingUp className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">No Data Yet</h3>
          <p className="text-slate-500 max-w-md mx-auto mb-6">
            Upload medical reports to start seeing your health trends. Each report's lab values will automatically appear here.
          </p>
          <Link to="/reports/upload" className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors">
            Upload Your First Report
          </Link>
        </div>
      </div>
    );
  }

  if (parameters.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Health Trends</h1>
          <p className="text-slate-500">Track vital parameters over time.</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
          <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-900 mb-2">No Lab Values Found</h3>
          <p className="text-slate-500">Your reports don't contain structured lab values yet. Upload a report with lab results to see trends.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Health Trends</h1>
          <p className="text-slate-500">
            {activeMember ? `${activeMember.name}'s` : 'Family'} lab values from {memberReports.length} report{memberReports.length !== 1 ? 's' : ''}.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6">
        {/* Parameter Selector */}
        <div className="mb-6">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Select Parameter</p>
          <div className="flex flex-wrap gap-2">
            {parameters.map(p => (
              <button
                key={p}
                onClick={() => setSelectedParam(p)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${effectiveParam === p ? 'bg-primary-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {p}
                <span className={`ml-1.5 text-xs ${effectiveParam === p ? 'text-primary-200' : 'text-slate-400'}`}>
                  ({parameterData[p].length})
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Stats Row */}
        {latestValue !== undefined && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">Latest Value</p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-slate-900">{latestValue}</span>
                <span className="text-sm text-slate-500">{unit}</span>
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">Status</p>
              <AbnormalityBadge level={latestStatus} />
            </div>
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">Trend</p>
              {trend === 'up' && <div className="flex items-center gap-1 text-red-600 font-semibold"><TrendingUp className="w-4 h-4" /> Increasing</div>}
              {trend === 'down' && <div className="flex items-center gap-1 text-green-600 font-semibold"><TrendingDown className="w-4 h-4" /> Decreasing</div>}
              {trend === 'flat' && <div className="flex items-center gap-1 text-slate-600 font-semibold"><Minus className="w-4 h-4" /> Stable</div>}
              {!trend && <span className="text-slate-400 text-sm">Only 1 reading</span>}
            </div>
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">Normal Range</p>
              <p className="text-sm font-semibold text-slate-900">
                {range ? `${range.min}–${range.max} ${range.unit}` : 'Unknown'}
              </p>
            </div>
          </div>
        )}

        {/* Chart */}
        {chartData.length >= 2 ? (
          <div className="h-[300px] sm:h-[380px] w-full mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 20, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  dy={10}
                  tickFormatter={d => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  domain={['dataMin - 5', 'dataMax + 5']}
                />
                <Tooltip content={<CustomTooltip />} />
                {range && <ReferenceArea y1={range.min} y2={range.max} fill="#10b981" fillOpacity={0.06} />}
                {range && <ReferenceLine y={range.max} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: 'Max', position: 'right', fill: '#f59e0b', fontSize: 11 }} />}
                {range && <ReferenceLine y={range.min} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: 'Min', position: 'right', fill: '#f59e0b', fontSize: 11 }} />}
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#0ea5e9"
                  strokeWidth={3}
                  dot={{ r: 5, fill: '#0ea5e9', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 7, fill: '#0ea5e9', strokeWidth: 2, stroke: '#fff' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-32 flex items-center justify-center bg-slate-50 rounded-xl mb-6 text-slate-500 text-sm">
            Need at least 2 readings to show a trend chart. Upload more reports!
          </div>
        )}

        {/* Reading History Table */}
        <div>
          <h3 className="text-base font-bold text-slate-900 mb-3">Reading History</h3>
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Value</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Source Report</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...chartData].reverse().map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-900">
                      <span className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        {new Date(row.date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {row.value} <span className="text-slate-400 font-normal">{unit}</span>
                    </td>
                    <td className="px-4 py-3">
                      <AbnormalityBadge level={row.status as any} />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/reports/${row.reportId}`}
                        className="text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1.5"
                      >
                        <Activity className="w-4 h-4" />
                        {row.reportTitle}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}