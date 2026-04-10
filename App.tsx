/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { 
  ShieldAlert, ShieldCheck, Activity, AlertTriangle, 
  FileText, Database, Server, Lock
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

export default function App() {
  const [findings, setFindings] = useState<any>(null);
  const [decision, setDecision] = useState<any>(null);
  const [evidence, setEvidence] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [findingsRes, decisionRes, evidenceRes] = await Promise.all([
          fetch('/sample-data/findings.json').then(res => res.json()),
          fetch('/sample-data/opa_decision.json').then(res => res.json()),
          fetch('/sample-data/evidence_log.json').then(res => res.json())
        ]);
        
        setFindings(findingsRes);
        setDecision(decisionRes);
        setEvidence(evidenceRes);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500">Loading AG-SDLC Dashboard...</div>;
  }

  const isAllowed = decision?.decision === 'ALLOW';
  
  const riskData = [
    { name: 'SAST (CodeQL)', score: decision?.metrics?.sast_score || 0 },
    { name: 'SCA (npm audit)', score: decision?.metrics?.sca_score || 0 },
    { name: 'DAST (ZAP)', score: decision?.metrics?.dast_score || 0 },
  ];

  const severityColors: Record<string, string> = {
    CRITICAL: '#ef4444',
    HIGH: '#f97316',
    MEDIUM: '#eab308',
    LOW: '#3b82f6',
    INFO: '#94a3b8'
  };

  const getSeverityCount = () => {
    const counts: Record<string, number> = { HIGH: 0, MEDIUM: 0, LOW: 0 };
    const allFindings = [
      ...(findings?.sast || []),
      ...(findings?.sca || []),
      ...(findings?.dast || [])
    ];
    
    allFindings.forEach(f => {
      const sev = f.severity?.toUpperCase() || 'INFO';
      if (counts[sev] !== undefined) counts[sev]++;
      else counts[sev] = 1;
    });
    
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans text-slate-900">
      <div className="mx-auto max-w-7xl space-y-8">
        
        {/* Header */}
        <header className="flex items-center justify-between border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">AG-SDLC Governance Dashboard</h1>
            <p className="mt-2 text-sm text-slate-500">AI-Governed DevSecOps Pipeline Prototype</p>
          </div>
          <div className={`flex items-center gap-3 rounded-full px-6 py-3 shadow-sm ${isAllowed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {isAllowed ? <ShieldCheck className="h-8 w-8" /> : <ShieldAlert className="h-8 w-8" />}
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider opacity-80">Gate Decision</div>
              <div className="text-2xl font-black">{decision?.decision || 'UNKNOWN'}</div>
            </div>
          </div>
        </header>

        {/* Top Metrics Row */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-blue-100 p-3 text-blue-600">
                <Activity className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Total Risk Score</p>
                <p className="text-3xl font-bold text-slate-900">{decision?.risk_score || 0}</p>
              </div>
            </div>
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div 
                className={`h-full ${decision?.risk_score > (decision?.threshold || 60) ? 'bg-red-500' : 'bg-green-500'}`} 
                style={{ width: `${Math.min(decision?.risk_score || 0, 100)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">Threshold: {decision?.threshold || 60}</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-orange-100 p-3 text-orange-600">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Total Findings</p>
                <p className="text-3xl font-bold text-slate-900">
                  {(findings?.sast?.length || 0) + (findings?.sca?.length || 0) + (findings?.dast?.length || 0)}
                </p>
              </div>
            </div>
            <div className="mt-4 flex gap-4 text-sm text-slate-600">
              <span>SAST: {findings?.sast?.length || 0}</span>
              <span>SCA: {findings?.sca?.length || 0}</span>
              <span>DAST: {findings?.dast?.length || 0}</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-purple-100 p-3 text-purple-600">
                <Lock className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Policy Violations</p>
                <p className="text-3xl font-bold text-slate-900">{decision?.violations?.length || 0}</p>
              </div>
            </div>
            <div className="mt-4 text-xs text-slate-500">
              Evaluated by Open Policy Agent (OPA)
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-6 text-lg font-semibold text-slate-800">Risk Score Breakdown</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={riskData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" domain={[0, 100]} stroke="#64748b" />
                  <YAxis dataKey="name" type="category" stroke="#64748b" width={120} />
                  <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                  <Bar dataKey="score" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-6 text-lg font-semibold text-slate-800">Findings by Severity</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={getSeverityCount()}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {getSeverityCount().map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={severityColors[entry.name] || severityColors.INFO} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Policy Violations */}
        {decision?.violations && decision.violations.length > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-red-800">
              <ShieldAlert className="h-5 w-5" />
              OPA Policy Violations
            </h3>
            <ul className="space-y-2">
              {decision.violations.map((v: string, i: number) => (
                <li key={i} className="flex items-start gap-3 text-sm text-red-700">
                  <span className="mt-1 flex h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                  {v}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Detailed Findings */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
            <h3 className="text-lg font-semibold text-slate-800">Security Findings Detail</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {/* SAST */}
            {findings?.sast?.map((f: any, i: number) => (
              <div key={`sast-${i}`} className="flex items-start gap-4 p-6 hover:bg-slate-50">
                <div className="rounded-md bg-blue-100 p-2 text-blue-600">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-slate-900">SAST: {f.id}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      f.severity === 'HIGH' ? 'bg-orange-100 text-orange-800' : 
                      f.severity === 'CRITICAL' ? 'bg-red-100 text-red-800' : 
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {f.severity}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{f.message}</p>
                  <p className="mt-2 text-xs font-mono text-slate-400">{f.file}:{f.line}</p>
                </div>
              </div>
            ))}

            {/* SCA */}
            {findings?.sca?.map((f: any, i: number) => (
              <div key={`sca-${i}`} className="flex items-start gap-4 p-6 hover:bg-slate-50">
                <div className="rounded-md bg-emerald-100 p-2 text-emerald-600">
                  <Database className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-slate-900">SCA: {f.id}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      f.severity === 'HIGH' ? 'bg-orange-100 text-orange-800' : 
                      f.severity === 'LOW' ? 'bg-blue-100 text-blue-800' : 
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {f.severity}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{f.message}</p>
                  <p className="mt-2 text-xs font-mono text-slate-400">Package: {f.package} @ {f.version}</p>
                </div>
              </div>
            ))}

            {/* DAST */}
            {findings?.dast?.map((f: any, i: number) => (
              <div key={`dast-${i}`} className="flex items-start gap-4 p-6 hover:bg-slate-50">
                <div className="rounded-md bg-purple-100 p-2 text-purple-600">
                  <Server className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-slate-900">DAST: {f.id}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      f.severity === 'HIGH' ? 'bg-orange-100 text-orange-800' : 
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {f.severity}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{f.message}</p>
                  <p className="mt-2 text-xs font-mono text-slate-400">{f.method} {f.url}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Evidence Log */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
            <h3 className="text-lg font-semibold text-slate-800">Compliance Evidence Log</h3>
            <p className="text-xs text-slate-500">Tamper-evident hash chain</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-6 py-3">Run ID</th>
                  <th className="px-6 py-3">Timestamp</th>
                  <th className="px-6 py-3">Decision</th>
                  <th className="px-6 py-3">Hash (SHA-256)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {evidence?.map((entry: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-900">{entry.run_id}</td>
                    <td className="px-6 py-4">{new Date(entry.timestamp).toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        entry.decision === 'ALLOW' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {entry.decision}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-400 truncate max-w-[200px]" title={entry.hash}>
                      {entry.hash}
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

