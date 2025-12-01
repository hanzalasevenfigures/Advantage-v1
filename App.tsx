import React, { useState, useEffect } from 'react';
import { AppState, ShotAnalysisEntry, AnalysisSummary, AggregatedMetrics, FunnelStageContext } from './types'; // Updated import
import { FileUpload } from './components/FileUpload';
import { Dashboard } from './components/Dashboard';
import { analyzeCampaigns } from './services/geminiService'; // Import generateDetailedReport as well
import { BarChart2, Sparkles, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';

// Fix: Changed to a named export to resolve "Module has no default export" error.
export const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.LANDING);
  const [shotPerformanceData, setShotPerformanceData] = useState<ShotAnalysisEntry[]>([]); // Renamed
  const [userFundamentals, setUserFundamentals] = useState<string>('');
  // const [selectedFunnelStage, setSelectedFunnelStage] = useState<FunnelStageContext | null>(null); // Removed state for funnel selection
  const [analysis, setAnalysis] = useState<AnalysisSummary | null>(null);
  const [metrics, setMetrics] = useState<AggregatedMetrics | null>(null);
  const [loadingStep, setLoadingStep] = useState<string>('');

  const calculateMetrics = (data: ShotAnalysisEntry[]): AggregatedMetrics => { // Operates on ShotAnalysisEntry[]
    let totalAdSpent = 0;
    let totalConversions = 0;
    let totalLinkClicks = 0;
    let totalReach = 0;
    let totalLPViews = 0;
    let totalATCs = 0;
    let totalICs = 0;

    let sumCPM = 0;
    let sumCTR = 0;
    let sumROAS = 0;
    let sumCPA = 0;
    let sumAdFrequency = 0;

    let totalDaysAnalyzed = 0; 
    let totalShotsCount = data.length;

    data.forEach(shot => {
      const daysInShot = shot.numDaysInShot ?? 3; // Default to 3, but use actual if available from parsing
      totalDaysAnalyzed += daysInShot;

      // For totals, multiply the average by the number of days in the shot to infer actual total
      totalAdSpent += (shot["Ad spent"] ?? 0) * daysInShot;
      totalConversions += (shot.Conversions ?? 0) * daysInShot;
      totalLinkClicks += (shot["LINK CLICKS"] ?? 0) * daysInShot;
      totalReach += (shot.REACH ?? 0) * daysInShot; 
      totalLPViews += (shot["Landing page views"] ?? 0) * daysInShot;
      totalATCs += (shot["Add to carts"] ?? 0) * daysInShot;
      totalICs += (shot["initiate checkout"] ?? 0) * daysInShot;

      // For averages, sum the shot averages directly to average them later across all shots
      sumCPM += (shot.CPM ?? 0);
      sumCTR += (shot.CTR ?? 0);
      sumROAS += (shot.ROAS ?? 0);
      sumCPA += (shot.CPA ?? 0);
      sumAdFrequency += (shot["AD FREQUENCY"] ?? 0);
    });

    // Calculate overall averages by dividing sum of shot averages by number of shots
    const avgCPM = totalShotsCount > 0 ? sumCPM / totalShotsCount : 0;
    const avgCTR = totalShotsCount > 0 ? sumCTR / totalShotsCount : 0;
    const avgROAS = totalShotsCount > 0 ? sumROAS / totalShotsCount : 0;
    const avgCPA = totalShotsCount > 0 ? sumCPA / totalShotsCount : 0;
    const avgAdFrequency = totalShotsCount > 0 ? sumAdFrequency / totalShotsCount : 0;

    // Derived metrics
    const cpc = totalLinkClicks > 0 ? totalAdSpent / totalLinkClicks : 0;
    const totalImpressions = (avgCPM > 0 && totalAdSpent > 0) ? (totalAdSpent / avgCPM) * 1000 : 0; // Derived

    return {
      totalAdSpent: totalAdSpent,
      totalConversions: totalConversions,
      totalLinkClicks: totalLinkClicks,
      totalReach: totalReach,
      totalLPViews: totalLPViews,
      totalATCs: totalATCs,
      totalICs: totalICs,
      
      avgCPM: avgCPM,
      avgCTR: avgCTR,
      avgROAS: avgROAS,
      avgCPA: avgCPA,
      avgAdFrequency: avgAdFrequency,

      cpc: cpc,
      totalImpressions: totalImpressions, // Ensure this is always a number
    };
  };

  const handleDataLoaded = (data: ShotAnalysisEntry[]) => { // Now expects ShotAnalysisEntry[]
    setShotPerformanceData(data);
  };

  const handleStartAnalysis = async () => {
    if (shotPerformanceData.length === 0) return; // Removed selectedFunnelStage check
    
    setAppState(AppState.ANALYZING);
    setLoadingStep("Processing data and calculating key metrics..."); // Updated loading step
    
    // Processed shot data is now directly the parsed data, as funnel stages are read from CSV
    const processedShotData = shotPerformanceData; 

    // Artificial delay for UX
    await new Promise(r => setTimeout(r, 800));
    const calculatedMetrics = calculateMetrics(processedShotData); 
    setMetrics(calculatedMetrics);

    setLoadingStep("Sending data for Usama Khan's Analysis Style...");
    try {
      const result = await analyzeCampaigns(processedShotData, userFundamentals); // Removed selectedFunnelStageContext
      setAnalysis(result);
      setAppState(AppState.DASHBOARD);
    } catch (error) {
      console.error(error);
      alert(`Analysis failed: ${error instanceof Error ? error.message : String(error)}`); // Changed 'e' to 'error'
      setAppState(AppState.UPLOAD);
    }
  };

  const resetApp = () => {
    setAppState(AppState.LANDING);
    setShotPerformanceData([]); // Reset shotPerformanceData
    setUserFundamentals('');
    // setSelectedFunnelStage(null); // Removed funnel stage selection reset
    setAnalysis(null);
    setMetrics(null);
  };

  // -- Views --

  if (appState === AppState.DASHBOARD && analysis && metrics) { // Removed selectedFunnelStage check
    return (
      <Dashboard 
        data={shotPerformanceData} // Pass original data for table view, context handled by prop
        analysis={analysis} 
        metrics={metrics} 
        userFundamentals={userFundamentals}
        onReset={resetApp}
        // selectedFunnelStageContext={contextStage} // Removed
      />
    );
  }

  if (appState === AppState.ANALYZING) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center space-y-6">
          <div className="relative mx-auto w-24 h-24">
             <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
             <div className="absolute inset-0 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
             <div className="absolute inset-0 flex items-center justify-center text-brand-600">
               <Sparkles size={32} className="animate-pulse" />
             </div>
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Analyzing Performance Data</h2>
            <p className="text-slate-500 mt-2">{loadingStep}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Navbar */}
      <nav className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-2">
              <div className="bg-gradient-to-tr from-brand-600 to-brand-400 p-2 rounded-lg">
                <BarChart2 className="text-white" size={24} />
              </div>
              <span className="font-bold text-xl tracking-tight text-slate-900">7figures<span className="text-brand-600">.pk</span></span>
            </div>
            <div className="flex items-center">
              <span className="text-sm font-medium text-slate-500">Usama Khan's Analysis Style</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {appState === AppState.LANDING ? (
          <div className="text-center space-y-8 max-w-3xl mx-auto py-12">
            <h1 className="text-4xl md:text-6xl font-extrabold text-slate-900 tracking-tight">
              Master Your Marketing <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-purple-600">
                With Usama Khan's Analysis
              </span>
            </h1>
            <p className="text-lg md:text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto">
              Upload your daily performance metrics, define your strategy, and let Usama Khan's Analysis Style discover hidden trends, calculate ROI, and generate professional reports in seconds.
            </p>
            <div className="flex justify-center pt-4">
              <button 
                onClick={() => setAppState(AppState.UPLOAD)}
                className="group relative inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-white transition-all duration-200 bg-brand-600 rounded-full hover:bg-brand-700 hover:shadow-lg hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-600"
              >
                Start Analysis
                <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" size={20} />
              </button>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto">
            {/* Stepper */}
            <div className="flex items-center justify-center mb-12 space-x-4">
               <div className="flex items-center space-x-2 text-brand-600">
                 <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center font-bold">1</div>
                 <span className="font-medium">Upload Data</span>
               </div>
               <div className="w-16 h-0.5 bg-slate-200"></div>
               <div className={`flex items-center space-x-2 ${shotPerformanceData.length > 0 ? 'text-brand-600' : 'text-slate-400'}`}>
                 <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${shotPerformanceData.length > 0 ? 'bg-brand-100' : 'bg-slate-100'}`}>2</div>
                 <span className="font-medium">Define Strategy</span>
               </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-8">
                {shotPerformanceData.length === 0 ? ( // Check shotPerformanceData
                  <div className="space-y-6">
                    <div className="text-center mb-8">
                      <h2 className="text-2xl font-bold text-slate-900">Upload Metrics</h2>
                      <p className="text-slate-500">Import your CSV performance data to get started.</p>
                    </div>
                    <FileUpload onDataLoaded={handleDataLoaded} />
                  </div>
                ) : (
                  <div className="space-y-6 animate-fade-in">
                    <div className="flex items-center justify-between bg-green-50 p-4 rounded-lg border border-green-100">
                      <div className="flex items-center space-x-3">
                        <CheckCircle2 className="text-green-600" />
                        <span className="font-medium text-green-900">{shotPerformanceData.length} Shots of data loaded successfully</span>
                      </div>
                      <button 
                        onClick={() => setShotPerformanceData([])} // Reset shotPerformanceData
                        className="text-sm text-green-700 hover:text-green-900 underline"
                      >
                        Change File
                      </button>
                    </div>

                    {/* Removed: Funnel Stage Selection UI */}
                    {/* The `FUNNEL STAGE` column in CSV will now drive the analysis */}

                    {/* Client Strategy & Business Fundamentals */}
                    <div className="space-y-2">
                      <label htmlFor="user-fundamentals" className="block text-sm font-medium text-slate-700">
                        Client Strategy & Business Fundamentals
                      </label>
                      <p className="text-xs text-slate-500">
                        Describe the client's business, target audience, core KPIs, and any specific goals (e.g., "e-commerce D2C brand selling sustainable fashion, targeting Gen Z, primary KPI is ROAS &gt; 3x, goal is market expansion").
                      </p>
                      <textarea
                        id="user-fundamentals"
                        className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all min-h-[120px]"
                        placeholder="e.g., e-commerce D2C brand selling sustainable fashion..."
                        value={userFundamentals}
                        onChange={(e) => setUserFundamentals(e.target.value)}
                        style={{ backgroundColor: 'white', color: 'black' }} // Styling for textarea
                      />
                    </div>

                    <button 
                      onClick={handleStartAnalysis}
                      disabled={!userFundamentals.trim() || shotPerformanceData.length === 0} // No selectedFunnelStage check
                      className="group relative inline-flex items-center justify-center px-8 py-3 text-lg font-semibold text-white transition-all duration-200 bg-brand-600 rounded-full hover:bg-brand-700 hover:shadow-lg hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Analyze with Usama Khan
                      <Sparkles className="ml-2 group-enabled:group-hover:translate-x-1 transition-transform" size={20} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};