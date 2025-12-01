import React, { useState } from 'react';
import { DailyPerformanceEntry, ShotAnalysisEntry, FunnelStageContext } from '../types'; // Updated import for ShotAnalysisEntry
import { Upload, FileText, ExternalLink, AlertCircle, FileSpreadsheet } from 'lucide-react';

interface FileUploadProps {
  onDataLoaded: (data: ShotAnalysisEntry[]) => void; // Now expects ShotAnalysisEntry[]
}

export const FileUpload: React.FC<FileUploadProps> = ({ onDataLoaded }) => {
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const parseCSV = (text: string) => {
    try {
      const lines = text.trim().split('\n').filter(line => line.trim() !== ''); // Filter out empty lines
      if (lines.length < 2) throw new Error("File appears empty or invalid. Expected at least a header row and one data row.");

      const rawHeaders = lines[0].split(',').map(h => h.trim());
      
      if (rawHeaders.length === 0 || rawHeaders[0].toUpperCase() !== 'DATE') {
        throw new Error("Invalid CSV header. Expected 'DATE' as the first column header.");
      }

      const metricAndFunnelNames = rawHeaders.slice(1); 
      if (metricAndFunnelNames.length === 0) throw new Error("No metric or funnel stage columns found in the header row.");

      const dailyData: DailyPerformanceEntry[] = [];
      const validationErrors: string[] = [];
      
      const requiredMetricNames = new Set([
        'cpm', 'ctr', 'reach', 'link clicks', 'landing page views', 'add to carts',
        'initiate checkout', 'conversions', 'cpa', 'roas', 'ad spent', 'ad frequency', 'funnel stage'
      ]);
      const presentHeadersLowerCase = new Set(metricAndFunnelNames.map(name => name.toLowerCase()));

      const missingRequired = Array.from(requiredMetricNames).filter(req => !presentHeadersLowerCase.has(req));
      if (missingRequired.length > 0) {
        validationErrors.push(`Missing required columns in header: ${missingRequired.map(m => m.charAt(0).toUpperCase() + m.slice(1)).join(', ')}. Please ensure they are present.`);
      }

      lines.slice(1).forEach((line, rowIndex) => {
        const parts = line.split(',').map(p => p.trim());
        if (parts.length === 0 || parts.every(p => p === '')) return; 

        if (parts.length !== rawHeaders.length) {
          validationErrors.push(`Row ${rowIndex + 2}: Mismatched number of columns. Expected ${rawHeaders.length}, got ${parts.length}.`);
          return;
        }

        const dailyEntry: DailyPerformanceEntry = {} as DailyPerformanceEntry;
        const dateStr = parts[0];
        dailyEntry.date = dateStr;
        let rowHasValidMetricData = false;

        metricAndFunnelNames.forEach((headerName, colIndex) => {
          const valueStr = parts[colIndex + 1];
          if (headerName.toUpperCase() === 'FUNNEL STAGE') {
            const stage = valueStr.toUpperCase();
            if (stage === 'TOF' || stage === 'MOF' || stage === 'BOF') {
              dailyEntry["FUNNEL STAGE"] = stage;
            } else {
              validationErrors.push(`Date ${dateStr}, Column '${headerName}': Invalid funnel stage '${valueStr}'. Expected TOF, MOF, or BOF.`);
              dailyEntry["FUNNEL STAGE"] = 'UNKNOWN'; // Assign a default/error value
            }
          } else {
            const parsedValue = parseFloat(valueStr);
            if (!isNaN(parsedValue)) {
              (dailyEntry as any)[headerName] = parsedValue;
              rowHasValidMetricData = true;
            } else if (valueStr && valueStr !== '') {
              validationErrors.push(`Date ${dateStr}, Column '${headerName}': Expected a number, but received '${valueStr}'.`);
              (dailyEntry as any)[headerName] = 0; // Default to 0 for calculations even if invalid
            } else {
              (dailyEntry as any)[headerName] = 0; // Default empty to 0
            }
          }
        });

        if (rowHasValidMetricData || dailyEntry["FUNNEL STAGE"]) { // Only add if at least one numeric metric or funnel stage was found
          dailyData.push(dailyEntry);
        }
      });
      
      // Additional Cross-Metric Logical & Range Checks (Business Logic) - now per day
      dailyData.forEach((day, idx) => {
        const date = day.date;
        const adSpent = day['Ad spent'] ?? 0;
        const conversions = day.Conversions ?? 0;
        const linkClicks = day["LINK CLICKS"] ?? 0;
        const reach = day.REACH ?? 0;
        const ctr = day.CTR ?? 0; // CTR is typically a decimal, e.g., 0.02
        const roas = day.ROAS ?? 0;
        const adFrequency = day["AD FREQUENCY"] ?? 0;
        const funnelStage = day["FUNNEL STAGE"];

        if (!funnelStage || !['TOF', 'MOF', 'BOF'].includes(funnelStage as FunnelStageContext)) {
          validationErrors.push(`Date ${date}: 'FUNNEL STAGE' is missing or invalid. Expected TOF, MOF, or BOF.`);
        }

        if (adSpent < 0) validationErrors.push(`Date ${date}: 'Ad spent' cannot be negative.`);
        if (conversions < 0) validationErrors.push(`Date ${date}: 'Conversions' cannot be negative.`);
        if (linkClicks < 0) validationErrors.push(`Date ${date}: 'LINK CLICKS' cannot be negative.`);
        if (reach < 0) validationErrors.push(`Date ${date}: 'REACH' cannot be negative.`);
        if (adFrequency < 0) validationErrors.push(`Date ${date}: 'AD FREQUENCY' cannot be negative.`);

        // Basic sanity check: Link Clicks cannot exceed Reach 
        if (linkClicks > 0 && reach > 0 && linkClicks > reach) {
            validationErrors.push(`Date ${date}: Logical error - 'LINK CLICKS' (${linkClicks}) exceed 'REACH' (${reach}).`);
        }

        // CTR sanity check (0-1, or 0-100 if input as percentage)
        // Assuming input CTR is already a decimal (e.g., 0.02)
        if (ctr < 0 || ctr > 1) { 
            validationErrors.push(`Date ${date}: 'CTR' (${ctr}) is outside a plausible decimal range (0-1). Please check if it's a percentage (e.g., 2% should be 0.02).`);
        }
        
        // ROAS sanity check
        if (roas < 0) { // ROAS cannot be negative
            validationErrors.push(`Date ${date}: 'ROAS' (${roas}) cannot be negative.`);
        }
      });

      if (validationErrors.length > 0) {
        const limit = 5;
        const remaining = validationErrors.length - limit;
        const errorMsg = validationErrors.slice(0, limit).join('\n') + 
          (remaining > 0 ? `\n...and ${remaining} more errors.` : '');
        throw new Error(errorMsg);
      }

      if (dailyData.length === 0) {
        throw new Error("No valid daily performance data rows could be parsed.");
      }

      // --- Aggregation into 3-day Shots ---
      const shotData: ShotAnalysisEntry[] = [];
      const numDays = dailyData.length;
      const metricsToAverage = metricAndFunnelNames.filter(name => name.toUpperCase() !== 'FUNNEL STAGE'); // Only average numeric metrics

      for (let i = 0; i < numDays; i += 3) {
        const shotNumber = Math.floor(i / 3) + 1;
        const shotId = `Shot ${shotNumber}`;
        const daysInShot = dailyData.slice(i, i + 3);

        if (daysInShot.length === 0) continue;

        const shotEntry: ShotAnalysisEntry = {} as ShotAnalysisEntry;
        shotEntry.shotId = shotId;
        shotEntry.startDate = daysInShot[0].date;
        shotEntry.endDate = daysInShot[daysInShot.length - 1].date;
        shotEntry.numDaysInShot = daysInShot.length; 
        
        // Determine predominant funnel stage for the shot
        const stageCounts: { [key in FunnelStageContext]?: number } = { TOF: 0, MOF: 0, BOF: 0 };
        daysInShot.forEach(day => {
          const stage = day["FUNNEL STAGE"] as FunnelStageContext;
          if (stage === 'TOF' || stage === 'MOF' || stage === 'BOF') {
            stageCounts[stage] = (stageCounts[stage] || 0) + 1;
          }
        });

        let predominantStage: FunnelStageContext = 'TOF'; // Default to TOF
        let maxCount = 0;
        // Fix: Iterate over Object.keys to correctly access stageCounts
        for (const stage of Object.keys(stageCounts) as FunnelStageContext[]) {
          if (stageCounts[stage]! > maxCount) { // Use ! for non-null assertion as we've initialized valid stages
            maxCount = stageCounts[stage]!;
            predominantStage = stage;
          }
        }
        shotEntry.funnelStage = predominantStage;

        // Calculate averages for numeric metrics
        metricsToAverage.forEach(metricName => {
          const sum = daysInShot.reduce((acc, day) => acc + ((day as any)[metricName] ?? 0), 0);
          (shotEntry as any)[metricName] = sum / daysInShot.length;
        });

        shotData.push(shotEntry);
      }

      if (shotData.length === 0) {
        throw new Error("No valid 3-day performance shots could be aggregated.");
      }

      onDataLoaded(shotData); // Pass aggregated shot data
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to parse CSV.");
    }
  };

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      setError("Please upload a CSV file exported from your spreadsheet.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      parseCSV(text);
    };
    reader.readAsText(file);
  };

  // Updated template headers and data for new format (no FUNNEL STAGE column)
  const templateHeaders = "DATE,CPM,CTR,REACH,LINK CLICKS,Landing page views,Add to carts,initiate checkout,Conversions,CPA,ROAS,Ad spent,AD FREQUENCY,FUNNEL STAGE";
  const templateData1 = "1 Mar,10.50,0.02,50000,1000,500,50,30,10,15.00,3.50,150.00,1.8,TOF";
  const templateData2 = "2 Mar,11.20,0.025,55000,1375,600,65,40,12,12.50,4.00,150.00,2.1,TOF";
  const templateData3 = "3 Mar,9.80,0.018,48000,864,450,40,25,8,18.75,3.20,150.00,1.9,MOF";
  const templateData4 = "4 Mar,12.00,0.03,60000,1800,900,100,60,20,10.00,5.00,200.00,2.5,MOF";
  const templateData5 = "5 Mar,11.50,0.028,58000,1624,800,90,55,18,11.11,4.50,200.00,2.4,BOF";
  const templateData6 = "6 Mar,13.00,0.022,65000,1430,700,80,50,15,13.33,3.80,200.00,2.6,BOF";

  const downloadCSVTemplate = () => {
    const content = `${templateHeaders}\n${templateData1}\n${templateData2}\n${templateData3}\n${templateData4}\n${templateData5}\n${templateData6}`;
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "7figures_daily_performance_template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const openGoogleSheetTemplate = () => {
    const tsvContent = [
      templateHeaders.replace(/,/g, '\t'),
      templateData1.replace(/,/g, '\t'),
      templateData2.replace(/,/g, '\t'),
      templateData3.replace(/,/g, '\t'),
      templateData4.replace(/,/g, '\t'),
      templateData5.replace(/,/g, '\t'),
      templateData6.replace(/,/g, '\t')
    ].join('\n');

    navigator.clipboard.writeText(tsvContent).then(() => {
        alert("📋 Template copied to clipboard!\n\n1. A new Google Sheet will open.\n2. In cell A1, paste (Ctrl+V) the data.\n3. Add your daily metrics (e.g., CPM, CTR, Conversions, etc.) AND the 'FUNNEL STAGE' for each day (TOF, MOF, or BOF).\n4. File > Download > CSV to upload here.");
        window.open("https://sheets.new", "_blank");
    }).catch(() => {
        window.open("https://sheets.new", "_blank");
    });
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <div 
        className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors duration-200 ease-in-out ${
          dragActive ? "border-brand-500 bg-brand-50" : "border-slate-300 bg-white hover:border-brand-400"
        }`}
        onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(true); }}
        onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); }}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragActive(false);
          handleFiles(e.dataTransfer.files);
        }}
      >
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="p-4 bg-brand-100 rounded-full text-brand-600">
            <Upload size={32} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Upload Performance Data</h3>
            <p className="text-slate-500 text-sm mt-1">Export your spreadsheet as CSV and drop it here</p>
            <p className="text-xs text-slate-500 mt-2">
              <span className="font-semibold">Note:</span> Please ensure to input data separately for each funnel stage (TOF, MOF, BOF) in the 'FUNNEL STAGE' column.
            </p>
          </div>
          <input
            type="file"
            accept=".csv"
            className="hidden"
            id="file-upload"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <label 
            htmlFor="file-upload"
            className="cursor-pointer py-2 px-6 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-lg shadow-sm transition-colors"
            style={{ backgroundColor: 'white', color: 'black' }} // Styling for button
          >
            Select File
          </label>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <button 
          onClick={openGoogleSheetTemplate}
          className="flex-1 flex items-center justify-center space-x-2 p-3 bg-green-50 text-green-700 rounded-lg border border-green-200 hover:bg-green-100 transition-colors cursor-pointer"
          style={{ backgroundColor: 'white', color: 'black' }} // Styling for button
        >
          <FileSpreadsheet size={18} />
          <span className="text-sm font-medium">Use Google Sheets</span>
          <ExternalLink size={14} className="ml-1 opacity-50" />
        </button>
        
        <button 
          onClick={downloadCSVTemplate}
          className="flex-1 flex items-center justify-center space-x-2 p-3 bg-slate-50 text-slate-700 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors"
          style={{ backgroundColor: 'white', color: 'black' }} // Styling for button
        >
          <FileText size={18} />
          <span className="text-sm font-medium">Download CSV Template</span>
        </button>
      </div>

      {error && (
        <div className="flex items-start space-x-3 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200 animate-fade-in">
          <AlertCircle className="flex-shrink-0 mt-0.5" size={18} />
          <div className="flex flex-col">
            <span className="text-sm font-bold">Data Validation Failed</span>
            <span className="text-sm whitespace-pre-line mt-1">{error}</span>
          </div>
        </div>
      )}
    </div>
  );
};