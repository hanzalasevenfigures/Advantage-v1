
import React, { useState } from 'react';
import { DailyPerformanceEntry, ShotAnalysisEntry, FunnelStageContext } from '../types';
import { Upload, FileText, ExternalLink, AlertCircle, FileSpreadsheet, CheckCircle, Plus } from 'lucide-react';

interface FileUploadProps {
  onDataLoaded: (data: ShotAnalysisEntry[]) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onDataLoaded }) => {
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [uploadedStages, setUploadedStages] = useState<{[key in FunnelStageContext]?: boolean}>({});
  // We'll accumulate shots from all stages here before sending up
  const [accumulatedShots, setAccumulatedShots] = useState<ShotAnalysisEntry[]>([]);

  const parseCSV = (text: string, stage: FunnelStageContext) => {
    try {
      const lines = text.trim().split('\n').filter(line => line.trim() !== '');
      if (lines.length < 2) throw new Error("File appears empty or invalid. Expected at least a header row and one data row.");

      const rawHeaders = lines[0].split(',').map(h => h.trim());
      
      if (rawHeaders.length === 0 || rawHeaders[0].toUpperCase() !== 'DATE') {
        throw new Error("Invalid CSV header. Expected 'DATE' as the first column header.");
      }

      const metricNames = rawHeaders.slice(1); 
      if (metricNames.length === 0) throw new Error("No metric columns found in the header row.");

      const dailyData: DailyPerformanceEntry[] = [];
      const validationErrors: string[] = [];
      
      // Removed 'funnel stage' from required metrics as it's implied by the upload section
      const requiredMetricNames = new Set([
        'cpm', 'ctr', 'reach', 'link clicks', 'landing page views', 'add to carts',
        'initiate checkout', 'conversions', 'cpa', 'roas', 'ad spent', 'ad frequency'
      ]);
      const presentHeadersLowerCase = new Set(metricNames.map(name => name.toLowerCase()));

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

        metricNames.forEach((headerName, colIndex) => {
          const valueStr = parts[colIndex + 1];
          const parsedValue = parseFloat(valueStr);
          if (!isNaN(parsedValue)) {
            (dailyEntry as any)[headerName] = parsedValue;
            rowHasValidMetricData = true;
          } else if (valueStr && valueStr !== '') {
            validationErrors.push(`Date ${dateStr}, Column '${headerName}': Expected a number, but received '${valueStr}'.`);
            (dailyEntry as any)[headerName] = 0;
          } else {
            (dailyEntry as any)[headerName] = 0;
          }
        });

        if (rowHasValidMetricData) {
          dailyData.push(dailyEntry);
        }
      });
      
      // Additional Cross-Metric Logical & Range Checks
      dailyData.forEach((day, idx) => {
        const date = day.date;
        const adSpent = day['Ad spent'] ?? 0;
        const conversions = day.Conversions ?? 0;
        const linkClicks = day["LINK CLICKS"] ?? 0;
        const reach = day.REACH ?? 0;
        const ctr = day.CTR ?? 0;
        const roas = day.ROAS ?? 0;
        const adFrequency = day["AD FREQUENCY"] ?? 0;

        if (adSpent < 0) validationErrors.push(`Date ${date}: 'Ad spent' cannot be negative.`);
        if (conversions < 0) validationErrors.push(`Date ${date}: 'Conversions' cannot be negative.`);
        if (linkClicks < 0) validationErrors.push(`Date ${date}: 'LINK CLICKS' cannot be negative.`);
        if (reach < 0) validationErrors.push(`Date ${date}: 'REACH' cannot be negative.`);
        if (adFrequency < 0) validationErrors.push(`Date ${date}: 'AD FREQUENCY' cannot be negative.`);

        if (linkClicks > 0 && reach > 0 && linkClicks > reach) {
            validationErrors.push(`Date ${date}: Logical error - 'LINK CLICKS' (${linkClicks}) exceed 'REACH' (${reach}).`);
        }

        if (ctr < 0 || ctr > 1) { 
            validationErrors.push(`Date ${date}: 'CTR' (${ctr}) is outside a plausible decimal range (0-1).`);
        }
        
        if (roas < 0) {
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
      
      for (let i = 0; i < numDays; i += 3) {
        const shotNumber = Math.floor(i / 3) + 1;
        const shotId = `${stage}-Shot ${shotNumber}`; // Prefix with stage name
        const daysInShot = dailyData.slice(i, i + 3);

        if (daysInShot.length === 0) continue;

        const shotEntry: ShotAnalysisEntry = {} as ShotAnalysisEntry;
        shotEntry.shotId = shotId;
        shotEntry.startDate = daysInShot[0].date;
        shotEntry.endDate = daysInShot[daysInShot.length - 1].date;
        shotEntry.numDaysInShot = daysInShot.length; 
        shotEntry.funnelStage = stage; // Explicitly assign the stage from the upload section

        // Calculate averages for numeric metrics
        metricNames.forEach(metricName => {
          const sum = daysInShot.reduce((acc, day) => acc + ((day as any)[metricName] ?? 0), 0);
          (shotEntry as any)[metricName] = sum / daysInShot.length;
        });

        shotData.push(shotEntry);
      }

      if (shotData.length === 0) {
        throw new Error("No valid 3-day performance shots could be aggregated.");
      }

      // Merge new shots with existing shots from other stages
      const newAccumulatedShots = [
        ...accumulatedShots.filter(s => s.funnelStage !== stage), // Remove old shots for this stage if re-uploading
        ...shotData
      ];
      
      setAccumulatedShots(newAccumulatedShots);
      setUploadedStages(prev => ({ ...prev, [stage]: true }));
      setErrors(prev => ({ ...prev, [stage]: "" })); // Clear error for this stage
      
      onDataLoaded(newAccumulatedShots); // Pass all aggregated shot data up

    } catch (err: any) {
      setErrors(prev => ({ ...prev, [stage]: err.message || "Failed to parse CSV." }));
    }
  };

  const handleFiles = (files: FileList | null, stage: FunnelStageContext) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      setErrors(prev => ({ ...prev, [stage]: "Please upload a CSV file." }));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      parseCSV(text, stage);
    };
    reader.readAsText(file);
  };

  // Updated template headers and data for new format (no FUNNEL STAGE column)
  const templateHeaders = "DATE,CPM,CTR,REACH,LINK CLICKS,Landing page views,Add to carts,initiate checkout,Conversions,CPA,ROAS,Ad spent,AD FREQUENCY";
  const templateData1 = "1 Mar,10.50,0.02,50000,1000,500,50,30,10,15.00,3.50,150.00,1.8";
  const templateData2 = "2 Mar,11.20,0.025,55000,1375,600,65,40,12,12.50,4.00,150.00,2.1";
  const templateData3 = "3 Mar,9.80,0.018,48000,864,450,40,25,8,18.75,3.20,150.00,1.9";

  const downloadCSVTemplate = () => {
    const content = `${templateHeaders}\n${templateData1}\n${templateData2}\n${templateData3}`;
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "7figures_performance_template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const openGoogleSheetTemplate = () => {
    const tsvContent = [
      templateHeaders.replace(/,/g, '\t'),
      templateData1.replace(/,/g, '\t'),
      templateData2.replace(/,/g, '\t'),
      templateData3.replace(/,/g, '\t')
    ].join('\n');

    navigator.clipboard.writeText(tsvContent).then(() => {
        alert("📋 Template copied to clipboard!\n\n1. A new Google Sheet will open.\n2. In cell A1, paste (Ctrl+V) the data.\n3. Add your daily metrics.\n4. File > Download > CSV to upload here.");
        window.open("https://sheets.new", "_blank");
    }).catch(() => {
        window.open("https://sheets.new", "_blank");
    });
  };

  const UploadZone = ({ stage, label }: { stage: FunnelStageContext, label: string }) => {
    const [dragActive, setDragActive] = useState(false);
    const isUploaded = uploadedStages[stage];
    const errorMessage = errors[stage];

    return (
      <div 
        className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-colors duration-200 ease-in-out ${
          isUploaded ? "border-green-500 bg-green-50" :
          errorMessage ? "border-red-300 bg-red-50" :
          dragActive ? "border-brand-500 bg-brand-50" : "border-slate-300 bg-white hover:border-brand-400"
        }`}
        onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(true); }}
        onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); }}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragActive(false);
          handleFiles(e.dataTransfer.files, stage);
        }}
      >
        <div className="flex flex-col items-center justify-center space-y-3">
          {isUploaded ? (
             <div className="p-3 bg-green-100 rounded-full text-green-600">
                <CheckCircle size={24} />
             </div>
          ) : (
            <div className={`p-3 rounded-full ${errorMessage ? "bg-red-100 text-red-500" : "bg-brand-100 text-brand-600"}`}>
                <Upload size={24} />
            </div>
          )}
          
          <div>
            <h4 className="font-semibold text-slate-800">{label}</h4>
            <p className="text-xs text-slate-500 mt-1">
              {isUploaded ? "Data Loaded Successfully" : "Drop CSV or Click"}
            </p>
          </div>

          {!isUploaded && (
            <>
              <input
                type="file"
                accept=".csv"
                className="hidden"
                id={`file-upload-${stage}`}
                onChange={(e) => handleFiles(e.target.files, stage)}
              />
              <label 
                htmlFor={`file-upload-${stage}`}
                className="cursor-pointer text-xs py-1.5 px-4 bg-white border border-slate-300 text-slate-700 font-medium rounded-md hover:bg-slate-50 transition-colors shadow-sm"
              >
                Select File
              </label>
            </>
          )}
          
          {isUploaded && (
             <button
               onClick={() => {
                 // Clear this stage's data
                 const newAccumulated = accumulatedShots.filter(s => s.funnelStage !== stage);
                 setAccumulatedShots(newAccumulated);
                 setUploadedStages(prev => ({...prev, [stage]: false}));
                 onDataLoaded(newAccumulated);
               }}
               className="text-xs text-red-500 hover:text-red-700 underline mt-2"
             >
               Remove / Re-upload
             </button>
          )}
        </div>
        
        {errorMessage && (
          <div className="absolute -bottom-12 left-0 w-full text-center">
             <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded border border-red-100">{errorMessage}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8">
      
      <div className="text-center mb-6">
         <p className="text-slate-600">Please upload your campaign data for each funnel stage separately.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <UploadZone stage="TOF" label="Top of Funnel (TOF)" />
        <UploadZone stage="MOF" label="Middle of Funnel (MOF)" />
        <UploadZone stage="BOF" label="Bottom of Funnel (BOF)" />
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <button 
          onClick={openGoogleSheetTemplate}
          className="flex items-center justify-center space-x-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg border border-green-200 hover:bg-green-100 transition-colors cursor-pointer"
          style={{ backgroundColor: 'white', color: 'black' }}
        >
          <FileSpreadsheet size={18} />
          <span className="text-sm font-medium">Use Google Sheets</span>
          <ExternalLink size={14} className="ml-1 opacity-50" />
        </button>
        
        <button 
          onClick={downloadCSVTemplate}
          className="flex items-center justify-center space-x-2 px-4 py-2 bg-slate-50 text-slate-700 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors"
          style={{ backgroundColor: 'white', color: 'black' }}
        >
          <FileText size={18} />
          <span className="text-sm font-medium">Download CSV Template</span>
        </button>
      </div>
    </div>
  );
};
