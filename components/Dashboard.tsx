
import React, { useState } from 'react';
import { ShotAnalysisEntry, AnalysisSummary, AggregatedMetrics, DetailedReport, FunnelStageReport, FunnelStageContext, MarketingRoadmap } from '../types'; // Updated import
import { generateDetailedReport, generateMarketingRoadmap } from '../services/geminiService';
import { 
  TrendingUp, TrendingDown, DollarSign, MousePointer, 
  Target, BarChart2, FileText, Loader2, RefreshCw, AlertOctagon, Download,
  Coins, BrainCircuit, Wrench, CheckCircle, ListChecks, Copy, LineChart, Gauge, Clock, Funnel, Map, Flag, CheckSquare, ArrowRightCircle
} from 'lucide-react';

interface DashboardProps {
  data: ShotAnalysisEntry[]; // Now expects ShotAnalysisEntry[]
  analysis: AnalysisSummary;
  metrics: AggregatedMetrics;
  userFundamentals: string;
  onReset: () => void;
  // selectedFunnelStageContext: FunnelStageContext; // Removed as user selection is no longer used
}

export const Dashboard: React.FC<DashboardProps> = ({ data, analysis, metrics, userFundamentals, onReset }) => { // Removed selectedFunnelStageContext
  const [report, setReport] = useState<DetailedReport | null>(null);
  const [roadmap, setRoadmap] = useState<MarketingRoadmap | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [loadingRoadmap, setLoadingRoadmap] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false); // Retaining for direct download
  const [activeTab, setActiveTab] = useState<'overview' | 'shotPerformance' | 'report' | 'roadmap'>('overview'); // Renamed tab

  // Debugging: Log metrics at every render to trace undefined
  console.log("Dashboard rendering - metrics prop:", metrics);
  console.log("Dashboard rendering - analysis prop:", analysis);

  const handleGenerateReport = async () => {
    setLoadingReport(true);
    try {
      const result = await generateDetailedReport(data, userFundamentals, analysis); // Removed selectedFunnelStageContext
      setReport(result);
      setActiveTab('report');
    } catch (e) {
      alert(`Failed to generate report: ${e instanceof Error ? e.message : String(e)}`);
      console.error(e);
    } finally {
      setLoadingReport(false);
    }
  };

  const handleGenerateRoadmap = async () => {
    if (!report) {
      alert("Please generate the Deep Report first.");
      return;
    }
    setLoadingRoadmap(true);
    try {
      const result = await generateMarketingRoadmap(report, analysis, userFundamentals);
      setRoadmap(result);
      setActiveTab('roadmap');
    } catch (e) {
      alert(`Failed to generate roadmap: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoadingRoadmap(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!report) {
      alert("No report generated yet to download.");
      return;
    }

    setDownloadingPdf(true);
    try {
      if (typeof (window as any).html2pdf !== 'function') {
        console.error("PDF Error: html2pdf library not found on window object. Type:", typeof (window as any).html2pdf);
        alert("PDF generation library not loaded correctly. Please try again or check console for errors.");
        return;
      }

      const reportElement = document.getElementById('printable-report');
      if (!reportElement) {
        console.error("PDF Error: Report element with ID 'printable-report' not found.");
        alert("Report content not found for PDF generation. Please try again.");
        return;
      }

      // Hide all non-report elements (header, tabs, buttons) for the PDF render
      const noPrintElements = document.querySelectorAll('.no-print');
      noPrintElements.forEach(el => (el as HTMLElement).style.display = 'none');
      
      // Ensure current styles are applied before capture
      await new Promise(resolve => setTimeout(resolve, 100)); 

      await (window as any).html2pdf(reportElement, {
        margin: [20, 10, 20, 10], // top, left, bottom, right
        filename: `7figures.pk_Report_${new Date().toISOString().slice(0, 10)}.pdf`, // Removed funnel stage from filename
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2, // Higher scale for better resolution
          logging: true, 
          useCORS: true, // Allow cross-origin images (if any)
          scrollY: 0,
          scrollX: 0,
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      });

      // Restore hidden elements after PDF generation
      // Cast 'el' to HTMLElement to correctly access the 'style' property.
      noPrintElements.forEach(el => ((el as HTMLElement).style.display = '')); 
      

    } catch (error) {
      console.error("PDF generation failed:", error);
      alert(`Failed to generate PDF. Details: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleCopyReport = async () => {
    if (!report) {
      alert("No report generated yet to copy.");
      return;
    }

    let reportText = `7figures.pk Performance Marketing Executive Briefing\n\n`;
    reportText += `Prepared For: [Client Name]\n`;
    reportText += `Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}\n\n`;
    reportText += `Confidential © ${new Date().getFullYear()} 7figures.pk\n\n`;
    reportText += `--------------------------------------------------\n\n`;
    reportText += `What is a Shot?\n${report.shotExplanation ?? 'Explanation not available.'}\n\n`;
    reportText += `Headline: ${report.headline ?? 'No headline provided.'}\n\n`;
    
    // Display analysis for all available funnel stages
    (report.funnelStageAnalysis ?? []).forEach((stageReport: FunnelStageReport) => {
      reportText += `--- ${stageReport.stageName} Funnel Stage Analysis ---\n\n`;
      reportText += `Key Takeaways:\n${(stageReport.keyTakeaways ?? []).map(item => `- ${item}`).join('\n')}\n\n`;
      reportText += `Expert Advice:\n${(stageReport.expertAdvice ?? []).map(item => `- ${item}`).join('\n')}\n\n`;
      reportText += `Immediate Troubleshooting:\n${(stageReport.troubleshootingActions ?? []).map(item => `- ${item}`).join('\n')}\n\n`;
      reportText += `Strategic Recommendations:\n${(stageReport.recommendations ?? []).map(item => `- ${item}`).join('\n')}\n\n`;
    });

    if (report.missingStageInsights && report.missingStageInsights.length > 0) {
      reportText += `--- Strategic Importance of Funnel Stages NOT Present in Data ---\n\n`;
      reportText += `${(report.missingStageInsights ?? []).map(item => `- ${item}`).join('\n')}\n\n`;
    }

    if (report.overallRecommendations && report.overallRecommendations.length > 0) {
      reportText += `--- Overall Strategic Recommendations ---\n\n`;
      reportText += `${(report.overallRecommendations ?? []).map(item => `- ${item}`).join('\n')}\n\n`;
    }


    reportText += `KPI Highlights:\n`;
    reportText += `  Total Ad Spent: $${(metrics.totalAdSpent ?? 0).toLocaleString(undefined, {minimumFractionDigits: 2})}\n`;
    reportText += `  Total Conversions: ${(metrics.totalConversions ?? 0).toLocaleString()}\n`;
    reportText += `  Average ROAS: ${(metrics.avgROAS ?? 0).toFixed(2)}x\n`;
    reportText += `  Average CPA: $${(metrics.avgCPA ?? 0).toFixed(2)}\n`;
    reportText += `  Average CPM: $${(metrics.avgCPM ?? 0).toFixed(2)}\n`;
    reportText += `  Average CTR: ${((metrics.avgCTR ?? 0) * 100).toFixed(2)}%\n`;
    reportText += `  Total Reach: ${(metrics.totalReach ?? 0).toLocaleString()}\n`;
    reportText += `  Average Ad Frequency: ${(metrics.avgAdFrequency ?? 0).toFixed(2)}\n\n`;
    
    if (analysis.anomalies && analysis.anomalies.length > 0) {
      reportText += `Detected Anomalies:\n`;
      (analysis.anomalies ?? []).forEach(anomaly => {
        reportText += `  - [${anomaly.severity ?? 'Info'}] ${anomaly.shotId ?? 'N/A'} (${anomaly.funnelStage ?? 'N/A'} - ${anomaly.metric ?? 'N/A'}): ${anomaly.observation ?? 'No observation'}. Impact: ${anomaly.impact ?? 'No impact specified.'}\n`;
      });
      reportText += `\n`;
    }

    try {
      await navigator.clipboard.writeText(reportText);
      alert("Report text copied to clipboard!");
    } catch (err) {
      console.error("Failed to copy report text:", err);
      alert("Failed to copy report text. Please try again or copy manually.");
    }
  };


  const StatCard = ({ title, value, subtext, icon: Icon, colorClass }: any) => {
    return (
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-between h-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-slate-500 text-sm font-medium uppercase tracking-wider">{title}</h3>
          <div className={`p-2 rounded-lg ${colorClass} bg-opacity-10`}>
            <Icon className={colorClass} size={20} />
          </div>
        </div>
        <div>
          <div className="text-2xl font-bold text-slate-900">{value}</div>
          <div className="text-xs text-slate-400 mt-1">{subtext}</div>
        </div>
      </div>
    );
  };

  const ReportKPIHighlight = ({ title, value, icon: Icon, color }: any) => {
    return (
      <div className="bg-white p-6 rounded-xl border border-slate-200 print-no-break print-bg-exact">
        <div className="flex items-center space-x-4">
          <div className={`p-3 rounded-full bg-${color}-100 text-${color}-600`}>
            <Icon size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500">{title}</p>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
          </div>
        </div>
      </div>
    );
  };
  
  const ReportSection = ({ title, icon: Icon, iconColor, children }: any) => {
    return (
      <div className="print-no-break">
          <div className="flex items-center space-x-3 pb-2 mb-4 border-b-2 border-slate-100">
              <Icon size={24} className={iconColor} />
              <h3 className="text-xl font-bold text-slate-800 tracking-tight">{title}</h3>
          </div>
          <div className="prose prose-slate max-w-none prose-p:text-slate-600 prose-li:text-slate-600">
              {children}
          </div>
      </div>
    );
  };


  return (
    <div className="min-h-screen bg-slate-50 pb-20 print:bg-white print:pb-0">
      {/* Header - Hidden on Print */}
      <header className="bg-white shadow-sm sticky top-0 z-20 print:hidden no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <div className="bg-brand-600 p-1.5 rounded-lg">
              <BarChart2 className="text-white" size={20} />
            </div>
            <h1 className="text-xl font-bold text-slate-900">7figures<span className="text-brand-600">.pk</span></h1>
          </div>
          <button 
            onClick={onReset}
            className="flex items-center space-x-2 text-slate-500 hover:text-slate-700 text-sm font-medium"
          >
            <RefreshCw size={16} />
            <span>New Analysis</span>
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 print:p-0 print:max-w-none">
        
        {/* Navigation Tabs - Hidden on Print */}
        <div className="flex space-x-1 bg-slate-200 p-1 rounded-lg w-fit print:hidden no-print overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'overview' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('shotPerformance')} // Renamed tab
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'shotPerformance' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Shot Performance
          </button>
          <button
            onClick={() => setActiveTab('report')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'report' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Deep Report
          </button>
          {/* Only show if roadmap exists or if report exists (so they know it's an option) */}
          {(report || roadmap) && (
            <button
              onClick={() => setActiveTab('roadmap')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap flex items-center space-x-1 ${
                activeTab === 'roadmap' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Map size={14} />
              <span>Strategic Roadmap</span>
            </button>
          )}
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-8 animate-fade-in print:hidden">
            {/* KPI Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard 
                title="Total Ad Spent" 
                value={`$${(metrics.totalAdSpent ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`} 
                subtext={`${data.length} Shots analyzed`} // Removed funnel stage context
                icon={DollarSign}
                colorClass="text-blue-600"
              />
              <StatCard 
                title="Total Conversions" 
                value={`${(metrics.totalConversions ?? 0).toLocaleString()}`} 
                subtext={`Overall conversions`} // Removed funnel stage context
                icon={CheckCircle}
                colorClass="text-green-600"
              />
              <StatCard 
                title="Average ROAS" 
                value={`${(metrics.avgROAS ?? 0).toFixed(2)}x`} 
                subtext={`Return on Ad Spent (Avg. across shots)`} // Removed funnel stage context
                icon={Coins}
                colorClass="text-purple-600"
              />
              <StatCard 
                title="Average CPA" 
                value={`$${(metrics.avgCPA ?? 0).toFixed(2)}`} 
                subtext={`Cost Per Acquisition (Avg. across shots)`} // Removed funnel stage context
                icon={Target}
                colorClass={((metrics.avgCPA ?? 0) > 50) ? "text-red-600" : "text-brand-600"}
              />
              <StatCard 
                title="Average CPM" 
                value={`$${(metrics.avgCPM ?? 0).toFixed(2)}`} 
                subtext={`Cost Per Mille (Avg. across shots)`} // Removed funnel stage context
                icon={BarChart2}
                colorClass="text-orange-600"
              />
              <StatCard 
                title="Average CTR" 
                value={`${((metrics.avgCTR ?? 0) * 100).toFixed(2)}%`} 
                subtext={`Click Through Rate (Avg. across shots)`} // Removed funnel stage context
                icon={MousePointer}
                colorClass="text-teal-600"
              />
               <StatCard 
                title="Total Reach" 
                value={`${(metrics.totalReach ?? 0).toLocaleString()}`} 
                subtext={`Total unique users reached`} // Removed funnel stage context
                icon={LineChart}
                colorClass="text-indigo-600"
              />
              <StatCard 
                title="Average Ad Frequency" 
                value={`${(metrics.avgAdFrequency ?? 0).toFixed(2)}`} 
                subtext={`Avg. per user (across shots)`} // Removed funnel stage context
                icon={Clock}
                colorClass="text-pink-600"
              />
              <StatCard 
                title="Overall Score" 
                value={`${(analysis.overallScore ?? 0)}/100`} 
                subtext="Usama Khan's Analysis Style rating"
                icon={Gauge}
                colorClass={((analysis.overallScore ?? 0) < 50) ? "text-red-600" : ((analysis.overallScore ?? 0) < 80) ? "text-amber-600" : "text-green-600"}
              />
            </div>

            {/* Anomaly Detection Banner */}
            {analysis.anomalies && analysis.anomalies.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
                <div className="flex items-center space-x-2 mb-4">
                  <AlertOctagon className="text-amber-600" size={24} />
                  <h2 className="text-lg font-bold text-amber-900">Anomaly Detection</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(analysis.anomalies ?? []).map((anomaly, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-lg shadow-sm border border-amber-100">
                      <div className="flex justify-between items-start mb-2">
                        <span className={`px-2 py-0.5 text-xs font-bold rounded-full uppercase ${
                          (anomaly.severity ?? 'Info') === 'Critical' ? 'bg-red-100 text-red-700' :
                          (anomaly.severity ?? 'Info') === 'Warning' ? 'bg-amber-100 text-amber-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {anomaly.severity ?? 'Info'}
                        </span>
                        <span className="text-xs font-medium text-slate-400">{anomaly.metric ?? 'N/A'}</span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-800 mb-1">Shot ID: {anomaly.shotId ?? 'N/A'} (Stage: {anomaly.funnelStage ?? 'N/A'})</h4> {/* Added funnelStage to anomaly display */}
                      <p className="text-sm text-slate-600 mb-2">{anomaly.observation ?? 'No observation provided.'}</p>
                      <div className="text-xs text-slate-500 italic border-t border-slate-100 pt-2">
                        Impact: {anomaly.impact ?? 'No impact specified.'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Usama Khan's Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-bold text-slate-900">Usama Khan's Executive Summary</h2>
                  <div className="px-3 py-1 bg-brand-100 text-brand-700 text-xs font-bold rounded-full">
                    Score: {(analysis.overallScore ?? 0)}/100
                  </div>
                </div>
                <p className="text-slate-600 leading-relaxed mb-6">
                  {analysis.executiveSummary ?? 'No summary available.'}
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-semibold text-green-700 mb-3 flex items-center">
                      <TrendingUp size={16} className="mr-2" /> Key Wins
                    </h3>
                    <ul className="space-y-2">
                      {(analysis.keyWins ?? []).map((win, i) => (
                        <li key={i} className="text-sm text-slate-600 pl-3 border-l-2 border-green-200">{win}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-red-700 mb-3 flex items-center">
                      <TrendingDown size={16} className="mr-2" /> Areas for Improvement
                    </h3>
                    <ul className="space-y-2">
                      {(analysis.areasForImprovement ?? []).map((item, i) => (
                        <li key={i} className="text-sm text-slate-600 pl-3 border-l-2 border-red-200">{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Recommendations */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl shadow-sm p-6 text-white">
                <h2 className="text-lg font-bold mb-6 flex items-center">
                   Strategic Advice
                </h2>
                <div className="space-y-4">
                  {(analysis.recommendations ?? []).map((rec, i) => (
                    <div key={i} className="bg-white bg-opacity-10 p-4 rounded-lg backdrop-blur-sm border border-white border-opacity-10">
                      <p className="text-sm font-light leading-relaxed">{rec}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-8 pt-6 border-t border-white border-opacity-10">
                  <button 
                    onClick={handleGenerateReport}
                    className="w-full py-3 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-lg shadow-lg transition-all flex items-center justify-center space-x-2"
                  >
                    {loadingReport ? <Loader2 className="animate-spin" size={20} /> : <FileText size={20} />}
                    <span>{loadingReport ? "Generating..." : "Generate Executive Briefing"}</span>
                  </button>
                  <p className="text-xs text-slate-400 text-center mt-3">Generates a text-based client report</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'shotPerformance' && ( // Renamed tab
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden print:hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Shot ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date Range</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Funnel Stage</th> {/* Added Funnel Stage header */}
                    {/* Dynamically render metric headers */}
                    {Object.keys(data[0] || {}).filter(key => 
                      key !== 'shotId' && key !== 'startDate' && key !== 'endDate' && key !== 'funnelStage' && key !== 'numDaysInShot'
                    ).map(metricName => (
                      <th key={metricName} className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                        {metricName}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {data.map((shot, index) => (
                    <tr key={shot.shotId + index} className="hover:bg-slate-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{shot.shotId ?? 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{shot.startDate ?? 'N/A'} - {shot.endDate ?? 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{shot.funnelStage ?? 'N/A'}</td> {/* Display Funnel Stage */}
                      {Object.keys(shot).filter(key => 
                        key !== 'shotId' && key !== 'startDate' && key !== 'endDate' && key !== 'funnelStage' && key !== 'numDaysInShot'
                      ).map(metricName => (
                        <td key={metricName} className="px-6 py-4 whitespace-nowrap text-sm text-right text-slate-500">
                          {typeof (shot as any)[metricName] === 'number' ? ((shot as any)[metricName] ?? 0).toFixed(2) : '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'report' && (
          <div className="flex flex-col items-center">
            
             {/* Report Actions - Hidden on Print */}
             {report && (
                <div className="w-full max-w-6xl flex justify-end gap-2 mb-4 print:hidden no-print">
                   {/* Create Marketing Roadmap Button */}
                   <button 
                    onClick={handleGenerateRoadmap}
                    className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-brand-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all"
                  >
                    {loadingRoadmap ? <Loader2 className="animate-spin" size={16} /> : <Map size={16} />}
                    <span>{loadingRoadmap ? "Planning..." : "Create Strategic Roadmap"}</span>
                  </button>

                  <button 
                    onClick={handleCopyReport}
                    className="flex items-center space-x-2 px-4 py-2 bg-slate-200 text-slate-800 rounded-lg hover:bg-slate-300 transition-colors shadow-sm"
                  >
                    <Copy size={16} />
                    <span>Copy Report Text</span>
                  </button>
                  <button 
                    onClick={handleDownloadPdf} 
                    disabled={downloadingPdf}
                    className="flex items-center space-x-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {downloadingPdf ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
                    <span>{downloadingPdf ? "Generating PDF..." : "Download PDF"}</span>
                  </button>
                </div>
              )}

            <div 
              id="printable-report"
              className="bg-slate-100 rounded-xl shadow-lg p-4 sm:p-8 w-full max-w-4xl mx-auto print:shadow-none print:border-0 print:w-full print:max-w-none print:p-0 print:bg-white"
            >
              {!report ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-20 print:hidden">
                  <div className="p-4 bg-slate-100 rounded-full">
                    <FileText className="text-slate-400" size={40} />
                  </div>
                  <h3 className="text-xl font-medium text-slate-900">No Report Generated Yet</h3>
                  <p className="text-slate-500 max-w-md">
                    Click the "Generate Executive Briefing" button in the overview tab to have Usama Khan's Analysis Style create a professional, text-based summary of your data.
                  </p>
                   <button 
                    onClick={handleGenerateReport}
                    className="w-auto px-6 py-3 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-lg shadow-lg transition-all flex items-center justify-center space-x-2"
                  >
                    {loadingReport ? <Loader2 className="animate-spin" size={20} /> : <FileText size={20} />}
                    <span>{loadingReport ? "Generating..." : "Generate Briefing Now"}</span>
                  </button>
                </div>
              ) : (
                <div className="animate-fade-in text-slate-800 bg-white p-4 sm:p-12 rounded-lg">
                  {/* Print-Only Cover Page */}
                  <div className="print-cover-page hidden print:flex">
                      <h1 className="text-5xl font-extrabold text-slate-900 tracking-tight mb-4">7figures<span className="text-brand-600">.pk</span></h1>
                      <p className="text-2xl font-bold text-slate-700 mb-8">Performance Marketing Executive Briefing</p>
                      <p className="text-xl text-slate-500 mb-2">Prepared For: [Client Name]</p>
                      <p className="text-lg text-slate-500">{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                      <div className="absolute bottom-10 text-slate-400 text-sm">
                        Confidential &copy; {new Date().getFullYear()} 7figures.pk
                      </div>
                  </div>

                   {/* Report Header */}
                   <div className="report-page-header mb-12">
                      <div>
                        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">7figures<span className="text-brand-600">.pk</span></h1>
                        <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-semibold">Usama Khan's Analysis Style</p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-slate-900">Confidential</div>
                        <div className="text-xs text-slate-500">{new Date().toLocaleDateString()}</div>
                      </div>
                   </div>

                   {/* Report Content */}
                   <div className="space-y-12">
                     <div className="bg-brand-50 border-l-4 border-brand-500 rounded-r-lg p-6 text-center print-no-break print-bg-exact">
                       <h2 className="text-2xl font-bold text-brand-900">{report.headline ?? 'Executive Briefing'}</h2>
                     </div>

                     {report.shotExplanation && (
                        <ReportSection title="Understanding 'Shots'" icon={Clock} iconColor="text-brand-600">
                          <p>{report.shotExplanation}</p>
                        </ReportSection>
                     )}

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 print-no-break">
                        <ReportKPIHighlight title="Total Ad Spent" value={`$${(metrics.totalAdSpent ?? 0).toLocaleString(undefined, {minimumFractionDigits: 2})}`} icon={DollarSign} color="blue" />
                        <ReportKPIHighlight title="Total Conversions" value={`${(metrics.totalConversions ?? 0).toLocaleString()}`} icon={CheckCircle} color="green" />
                        <ReportKPIHighlight title="Average ROAS" value={`${(metrics.avgROAS ?? 0).toFixed(2)}x`} icon={Coins} color="purple" />
                        <ReportKPIHighlight title="Average CPA" value={`$${(metrics.avgCPA ?? 0).toFixed(2)}`} icon={Target} color="red" />
                      </div>
                      
                      {/* Funnel Stage Specific Analysis - now only ONE entry based on user selection */}
                      {(report.funnelStageAnalysis ?? []).map((stageReport: FunnelStageReport, index: number) => (
                        <div key={stageReport.stageName} className="space-y-8">
                          <ReportSection title={`${stageReport.stageName} Funnel Stage Analysis`} icon={Funnel} iconColor="text-brand-600">
                            <h4 className="text-lg font-semibold text-slate-800 mt-4 mb-2">Key Takeaways</h4>
                            <ul>
                            {(stageReport.keyTakeaways ?? []).map((item, i) => (
                                <li key={i}>{item}</li>
                            ))}
                            </ul>
                            <h4 className="text-lg font-semibold text-slate-800 mt-4 mb-2">Expert Advice</h4>
                            <ul>
                            {(stageReport.expertAdvice ?? []).map((item, i) => (
                                <li key={i}>{item}</li>
                            ))}
                            </ul>
                            <h4 className="text-lg font-semibold text-slate-800 mt-4 mb-2">Immediate Troubleshooting</h4>
                            <ul>
                            {(stageReport.troubleshootingActions ?? []).map((item, i) => (
                                <li key={i}>{item}</li>
                            ))}
                            </ul>
                            <h4 className="text-lg font-semibold text-slate-800 mt-4 mb-2">Strategic Recommendations</h4>
                            <ul>
                            {(stageReport.recommendations ?? []).map((item, i) => (
                                <li key={i}>{item}</li>
                            ))}
                            </ul>
                          </ReportSection>
                        </div>
                      ))}

                      {/* Missing Funnel Stage Insights */}
                      {report.missingStageInsights && report.missingStageInsights.length > 0 && (
                        <ReportSection title="Strategic Importance of Funnel Stages NOT Present in Data" icon={AlertOctagon} iconColor="text-amber-600">
                           <ul>
                            {(report.missingStageInsights ?? []).map((item, i) => (
                                <li key={i}>{item}</li>
                            ))}
                            </ul>
                        </ReportSection>
                      )}

                      {/* Overall Strategic Recommendations */}
                      {report.overallRecommendations && report.overallRecommendations.length > 0 && (
                        <ReportSection title="Overall Strategic Recommendations" icon={ListChecks} iconColor="text-brand-600">
                           <ul>
                            {(report.overallRecommendations ?? []).map((item, i) => (
                                <li key={i}>{item}</li>
                            ))}
                            </ul>
                        </ReportSection>
                      )}

                       {analysis.anomalies && analysis.anomalies.length > 0 && (
                            <div className="print-no-break bg-amber-50 border border-amber-200 rounded-xl p-6 print-bg-exact" style={{pageBreakBefore: 'always'}}>
                                <div className="flex items-center space-x-3 mb-4">
                                <AlertOctagon className="text-amber-600" size={24} />
                                <h3 className="text-lg font-bold text-amber-900">Detected Anomalies</h3>
                                </div>
                                <ul className="space-y-4">
                                    {(analysis.anomalies ?? []).map((anomaly, idx) => (
                                    <li key={idx} className="flex items-start">
                                        <span className={`px-2.5 py-1 text-xs font-bold rounded-full uppercase mr-3 mt-0.5 flex-shrink-0 ${
                                          (anomaly.severity ?? 'Info') === 'Critical' ? 'bg-red-100 text-red-700' :
                                          (anomaly.severity ?? 'Info') === 'Warning' ? 'bg-amber-100 text-amber-700' :
                                          'bg-blue-100 text-blue-700'
                                        }`}>
                                          {anomaly.severity ?? 'Info'}
                                        </span>
                                        <div>
                                            <p className="text-sm text-slate-800">
                                                <span className="font-semibold">{anomaly.shotId ?? 'N/A'} (Stage: {anomaly.funnelStage ?? 'N/A'} - {anomaly.metric ?? 'N/A'}):</span> {anomaly.observation ?? 'No observation'}
                                            </p>
                                        </div>
                                    </li>
                                ))}
                                </ul>
                            </div>
                        )}

                   </div>

                   {/* Report Footer */}
                   <div className="report-page-footer mt-12 pt-6">
                      <span>Generated by 7figures.pk (Usama Khan's Analysis Style)</span>
                      <span>&copy; {new Date().getFullYear()} 7figures.pk</span>
                   </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'roadmap' && (
          <div className="max-w-5xl mx-auto">
             {!roadmap ? (
               <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-20 bg-white rounded-xl shadow-sm">
                 <div className="p-4 bg-purple-50 rounded-full">
                   <Map className="text-purple-400" size={40} />
                 </div>
                 <h3 className="text-xl font-medium text-slate-900">Roadmap Not Generated</h3>
                 <p className="text-slate-500 max-w-md">
                   Go to the "Deep Report" tab and click "Create Strategic Roadmap" to build your marketing plan.
                 </p>
               </div>
             ) : (
                <div className="bg-white rounded-xl shadow-lg overflow-hidden animate-fade-in">
                   <div className="bg-gradient-to-r from-brand-600 to-purple-600 p-8 text-white">
                      <h2 className="text-3xl font-bold mb-2">Strategic Marketing Roadmap</h2>
                      <p className="opacity-90 max-w-2xl">{roadmap.strategySummary}</p>
                   </div>
                   
                   <div className="p-8">
                      {/* Timeline Visualization */}
                      <div className="relative border-l-2 border-brand-200 ml-4 md:ml-6 space-y-12">
                        {(roadmap.phases || []).map((phase, index) => (
                          <div key={index} className="relative pl-8 md:pl-12">
                            {/* Timeline Node */}
                            <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white border-4 border-brand-500"></div>
                            
                            <div className="bg-slate-50 rounded-xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 border-b border-slate-200 pb-4">
                                  <div>
                                    <h3 className="text-xl font-bold text-slate-800">{phase.phaseName}</h3>
                                    <p className="text-brand-600 font-medium text-sm flex items-center mt-1">
                                      <Clock size={14} className="mr-1" /> {phase.duration}
                                    </p>
                                  </div>
                                  <div className="mt-2 md:mt-0 px-3 py-1 bg-white border border-slate-200 rounded-full text-xs font-semibold text-slate-600 uppercase tracking-wide">
                                    Focus: {phase.focusArea}
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                  <div>
                                     <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center uppercase tracking-wider">
                                       <Target size={16} className="mr-2 text-blue-500" /> Objectives
                                     </h4>
                                     <ul className="space-y-2">
                                       {(phase.objectives || []).map((obj, i) => (
                                         <li key={i} className="text-sm text-slate-600 flex items-start">
                                           <ArrowRightCircle size={14} className="mr-2 mt-0.5 text-blue-300 flex-shrink-0" />
                                           <span>{obj}</span>
                                         </li>
                                       ))}
                                     </ul>
                                  </div>
                                  <div>
                                     <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center uppercase tracking-wider">
                                       <CheckSquare size={16} className="mr-2 text-green-500" /> Action Plan
                                     </h4>
                                     <ul className="space-y-2">
                                       {(phase.actionItems || []).map((item, i) => (
                                         <li key={i} className="text-sm text-slate-600 flex items-start">
                                            <div className="mt-1.5 mr-2 w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0"></div>
                                           <span>{item}</span>
                                         </li>
                                       ))}
                                     </ul>
                                  </div>
                                </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Budget Allocation Section */}
                      <div className="mt-12 bg-slate-50 rounded-xl p-8 border border-slate-100">
                        <div className="flex items-center space-x-3 mb-6">
                           <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                             <Coins size={24} />
                           </div>
                           <h3 className="text-xl font-bold text-slate-800">Resource & Budget Allocation</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                           {(roadmap.budgetAllocation || []).map((item, i) => (
                             <div key={i} className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                               <p className="text-slate-700 text-sm font-medium">{item}</p>
                             </div>
                           ))}
                        </div>
                      </div>

                   </div>
                </div>
             )}
          </div>
        )}
      </main>
    </div>
  );
};
