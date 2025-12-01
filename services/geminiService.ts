
import { GoogleGenAI, Type } from "@google/genai";
import { ShotPerformanceData, AnalysisSummary, DetailedReport, FunnelStageReport, FunnelStageContext, MarketingRoadmap } from '../types'; // Updated import

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Schema for the structured summary
const summarySchema = {
  type: Type.OBJECT,
  properties: {
    executiveSummary: { type: Type.STRING, description: "A high-level overview of performance across all shots, focusing on 3-day averages across all funnel stages." },
    keyWins: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of top performing aspects over the analyzed period (across shots)." },
    areasForImprovement: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of underperforming aspects over the analyzed period (across shots)." },
    recommendations: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Actionable strategic advice based on shot-to-shot analysis across all funnel stages." },
    anomalies: {
      type: Type.ARRAY,
      description: "Detected data outliers or anomalies based on statistical deviation or industry benchmarks across shots (3-day averages) across all funnel stages.",
      items: {
        type: Type.OBJECT,
        properties: {
          metric: { type: Type.STRING, description: "The metric where the anomaly was found (e.g. CPA, Ad spent)" },
          shotId: { type: Type.STRING, description: "The specific Shot ID (e.g., 'Shot 5') when the anomaly occurred." },
          funnelStage: { type: Type.STRING, description: "The funnel stage for the anomaly." }, // Added funnel stage to anomaly
          observation: { type: Type.STRING, description: "What makes this an anomaly (e.g. 'CPA on Shot 5 was 5x higher than average', 'Near-zero CTR for an entire TOF week')." },
          impact: { type: Type.STRING, description: "Potential business impact of this anomaly." },
          severity: { type: Type.STRING, enum: ["Critical", "Warning", "Info"] }
        }
      }
    },
    overallScore: { type: Type.NUMBER, description: "A performance score from 0-100 based on the metrics across all shots and funnel stages." },
  },
  required: ["executiveSummary", "keyWins", "areasForImprovement", "recommendations", "anomalies", "overallScore"],
};

const funnelStageReportSchema = {
  type: Type.OBJECT,
  properties: {
    stageName: { type: Type.STRING, enum: ["TOF", "MOF", "BOF"], description: "The funnel stage this analysis applies to." },
    keyTakeaways: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3-4 concise but explanatory bullet points of critical findings for this stage based on shot-to-shot performance. Provide clear logical reasoning." },
    expertAdvice: { type: Type.ARRAY, items: { type: Type.STRING }, description: "2-3 high-level strategic insights for this stage, considering shot-based trends and specific metrics. Explain *why* these trends are important, offering deeper logical reasoning and context." },
    troubleshootingActions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "2-3 immediate, tactical actions for this stage to address specific performance issues identified in shots (e.g., high CPA in a particular shot, conversion ratio drop). Explain *the reasoning* behind each action." },
    recommendations: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3 actionable, strategic next steps for this stage for the coming weeks/months, based on identified shot-to-shot trends and overall performance for this stage. If ROAS is good for this stage, provide soft recommendations, otherwise stronger, more direct strategic advice." }
  },
  required: ["stageName", "keyTakeaways", "expertAdvice", "troubleshootingActions", "recommendations"]
};


const reportSchema = {
  type: Type.OBJECT,
  properties: {
      shotExplanation: { type: Type.STRING, description: "A clear, concise explanation of what a 'Shot' means in this report (a 3-day average period for metrics) and why it's used for analysis. (Max 50 words)" },
      headline: { type: Type.STRING, description: "A single, powerful headline summarizing the key performance insight from the 3-day average shot data across all funnel stages. (Max 15 words)" },
      funnelStageAnalysis: { 
        type: Type.ARRAY, 
        items: funnelStageReportSchema, 
        description: "An array of structured reports, one for each AVAILABLE funnel stage (TOF, MOF, BOF) found in the input data. Do NOT include analysis for missing stages here." 
      },
      missingStageInsights: { 
        type: Type.ARRAY, 
        items: { type: Type.STRING }, 
        description: "Specific points of advice/importance for each funnel stage that was MISSING from the client's data. Each point should explain the strategic value of creating campaigns for that missing stage. Prepend each point with [Missing Stage - {STAGE_NAME}]:." 
      },
      overallRecommendations: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "General strategic recommendations that apply across all funnel stages or the overall strategy, not specific to one stage."
      }
  },
  required: ["shotExplanation", "headline", "funnelStageAnalysis", "missingStageInsights", "overallRecommendations"]
};

const roadmapSchema = {
  type: Type.OBJECT,
  properties: {
    strategySummary: { type: Type.STRING, description: "A concise executive summary of the proposed marketing roadmap strategy (max 50 words)." },
    phases: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          phaseName: { type: Type.STRING, description: "Name of the phase (e.g., 'Phase 1: Stabilization & Fixes')" },
          duration: { type: Type.STRING, description: "Suggested duration (e.g., 'Weeks 1-2')" },
          focusArea: { type: Type.STRING, description: "Primary focus (e.g., 'Creative Testing & TOF Optimization')" },
          objectives: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Key objectives to achieve in this phase." },
          actionItems: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Specific, actionable steps to take." }
        },
        required: ["phaseName", "duration", "focusArea", "objectives", "actionItems"]
      }
    },
    budgetAllocation: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Strategic advice on how to allocate budget across funnel stages based on the roadmap." }
  },
  required: ["strategySummary", "phases", "budgetAllocation"]
};


export const analyzeCampaigns = async (
  data: ShotPerformanceData, 
  fundamentals: string
): Promise<AnalysisSummary> => {
  try {
    if (data.length === 0) throw new Error("No shot data provided for analysis.");

    // Identify available and missing funnel stages from the actual data
    const uniqueFunnelStages = Array.from(new Set(data.map(d => d.funnelStage))).filter(stage => ['TOF', 'MOF', 'BOF'].includes(stage));
    const allPossibleStages: FunnelStageContext[] = ['TOF', 'MOF', 'BOF'];
    const missingFunnelStages = allPossibleStages.filter(stage => !uniqueFunnelStages.includes(stage));
    const availableFunnelStagesStr = uniqueFunnelStages.join(', ');

    // Extract all unique metric names from the first entry, excluding non-metric properties
    const allMetricNames = Object.keys(data[0]).filter(key => 
      key !== 'shotId' && key !== 'startDate' && key !== 'endDate' && key !== 'funnelStage' && key !== 'numDaysInShot'
    );
    if (allMetricNames.length === 0) throw new Error("No metrics found in the provided shot data for analysis.");

    // --- Prepare separate CSV data blocks for each available funnel stage ---
    const csvHeader = ["SHOT_ID", "START_DATE", "END_DATE", "FUNNEL_STAGE", "NUM_DAYS_IN_SHOT", ...allMetricNames].join(",");
    
    const segregatedCsvBlocks: { [stage: string]: string } = {};
    uniqueFunnelStages.forEach(stage => {
      const stageData = data.filter(shot => shot.funnelStage === stage);
      const stageCsvRows = stageData.map(shot => {
        const values = allMetricNames.map(metricName => (shot[metricName] ?? 0).toString());
        return [shot.shotId, shot.startDate, shot.endDate, shot.funnelStage as string, shot.numDaysInShot, ...values].join(",");
      });
      segregatedCsvBlocks[stage] = [csvHeader, ...stageCsvRows].join("\n");
    });

    const prompt = `
      **ABSOLUTE MANDATE: FUNNEL STAGE SEGREGATION AND ISOLATED ANALYSIS**
      **INTERNAL DATA PROCESSING GUIDELINE (STRICTLY ADHERE TO THIS):**
      **CRITICAL FIRST STEP: YOU HAVE BEEN PROVIDED WITH SEGREGATED CSV DATA BLOCKS BELOW, ONE FOR EACH 'FUNNEL_STAGE' PRESENT IN THE CLIENT'S UPLOAD.**
      **ALL SUBSEQUENT CALCULATIONS, COMPARISONS, AND ANALYSES MUST BE PERFORMED ENTIRELY WITHIN EACH FUNNEL_STAGE'S SPECIFIC CSV DATA BLOCK.**
      **ABSOLUTELY NEVER AVERAGE, SUM, OR COMPARE METRICS ACROSS DIFFERENT FUNNEL_STAGEs (TOF, MOF, BOF). Treat data from each stage's CSV block as entirely distinct and separate entities throughout the analysis.**
      **IF A FUNNEL STAGE IS LISTED AS 'MISSING FUNNEL STAGES', DO NOT ANALYZE IT IN THE CONTEXT OF DATA. ONLY ADDRESS IT IN THE 'missingStageInsights' ARRAY.**
      
      You are a World-Class Performance Marketing Analyst at **7figures.pk** (Usama Khan's Analysis Style).
      Your analysis must *always* be based on 3-day averages, referred to as "Shots". Compare performance from "Shot" to "Shot", not day-to-day.
      
      Available Funnel Stages in Data: ${availableFunnelStagesStr || 'None'}
      Missing Funnel Stages: ${missingFunnelStages.join(', ') || 'None'}

      **CRITICAL AND ABSOLUTELY MANDATORY OUTPUT FORMATTING**: 
      For EVERY single item in the response (executiveSummary, keyWins, areasForImprovement, recommendations, anomalies), you MUST prepend the specific funnel stage to which it applies: [TOF]:, [MOF]:, [BOF]:. If a point applies universally across all stages or is aggregated, use [Overall]:. If no relevant analysis exists for a particular funnel stage for a given section, omit that stage's specific prefix for that section.
      
      Analyze the following time-series performance data based on these user-defined fundamentals: "${fundamentals}".
      
      ${uniqueFunnelStages.map(stage => `--- DATA FOR FUNNEL STAGE: ${stage} ---\n${segregatedCsvBlocks[stage]}`).join('\n\n')}

      Tasks:
      1. Provide a structured summary of the performance over the entire period, comparing shots. Be critical and strategic.
      2. **Anomaly Detection**: Rigorously analyze the metrics to identify statistically significant outliers or unusual patterns across shots.
         - Compare each shot's values against the metric's average or standard deviation over the entire period, *within its respective FUNNEL_STAGE context*.
         - Flag issues like: sudden spikes or drops in "Ad spent" between shots, unusually high "CPA" in a specific shot, near-zero "CTR"s for extended periods within a funnel stage.
         - For each anomaly, explain the observation (including the specific metric, shot ID, AND FUNNEL STAGE) and its potential impact on the business. Assign a severity level (Critical, Warning, Info).
      3. **Strategic Analysis based on 7figures.pk Fundamentals & Usama Khan's Analysis Style (for each available funnel stage individually)**:
         - **Priority: ROAS**: First, analyze the overall and shot-to-shot ROAS *for each funnel stage individually*. If ROAS for a *specific stage* is low (determine "low" based on data history and implied client goals from fundamentals), then deeply prioritize all other findings and stronger recommendations for *that specific stage*. If ROAS is good for a *specific stage*, then provide softer recommendations for other findings *for that stage*.
         - **TOF CTR Issue (ONLY for TOF stage)**: If 'CTR' is continuously dropping in 'TOF' shots, identify it as a creative/video issue.
         - **TOF Ad Frequency Issue (ONLY for TOF stage)**: If 'AD FREQUENCY' is increasing or its 3-day average is above 2 in 'TOF' shots, recommend adding more creatives in TOF. (Ad Frequency doesn't matter in MOF and BOF contexts).
         - **Clicks to Landing Page Views Issue**: If the ratio of 'LINK CLICKS' to 'Landing page views' is low or dropping across shots, highlight a potential website performance issue (hosting, loading speed, indicating high bounce rate) *for the respective funnel stage*.
         - **Landing Page Views to Add to Cart Ratio Issue**: If the average ratio of 'Landing page views' to 'Add to carts' for a shot *within a specific stage* is below 20%, raise a 'Critical' issue, indicating strong landing page problems for *that stage*. If this ratio is zero (i.e., 'Add to carts' are 0 despite 'Landing page views' > 0), it becomes a 'Top Priority Critical' issue, demanding immediate investigation into pricing, product images, reviews, descriptions, or authenticity on the landing page *for that stage*.
         - **Add to Cart to Initiate Checkout Ratio Issue**: If the ratio of 'Add to carts' to 'initiate checkout' is low or dropping *within a specific stage*, suggest a problem with a separate cart page or other checkout friction points *for that stage*.
         - **Add to Cart to Conversions Priority Issue**: If 'Conversions' are zero (0) while 'Add to carts' are greater than zero (>0) for any shot *within a specific stage*, this must be flagged as a 'Top Priority Critical' issue. Immediately focus on the cart page experience and payment options as the primary suspects *for that stage*.
         - **Initiate Checkout to Conversions Ratio Issue**: If the ratio of 'initiate checkout' to 'Conversions' is low *within a specific stage*, pinpoint potential payment options issues *for that stage*.
      
      Structure your analysis to directly address these points, ensuring all findings are strictly within their respective funnel stage contexts.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: summarySchema,
        thinkingConfig: { thinkingBudget: 32768 },
      },
    });

    console.log("Usama Khan's Analysis Raw Summary Response Text (Initial):", response.text, "Type:", typeof response.text);

    if (response.text === undefined || response.text === null) {
      console.error("Usama Khan's Analysis returned an explicitly undefined or null text response for summary.");
      throw new Error("Usama Khan's Analysis returned no readable text content for summary. Expected JSON. It might be an internal error or rate limit. Please try again.");
    }

    const trimmedText: string = (response.text as string).trim(); // Explicit cast after null check
    console.log("Usama Khan's Analysis Raw Summary Response Text (Trimmed & Stringified):", trimmedText, "Length:", trimmedText.length);


    if (trimmedText.length === 0) {
      console.error("Usama Khan's Analysis returned an empty string for summary after trimming.");
      throw new Error(`Usama Khan's Analysis returned an empty response for summary. Expected JSON. Raw text: "${response.text}".`);
    }

    const lowerCaseTrimmedText = trimmedText.toLowerCase();
    if (
        lowerCaseTrimmedText === 'undefined' ||
        lowerCaseTrimmedText === 'null' ||
        lowerCaseTrimmedText === 'error' ||
        lowerCaseTrimmedText.includes('"error"') || // Catch JSON error objects as strings
        lowerCaseTrimmedText === 'failure' ||
        lowerCaseTrimmedText.includes('invalid') || // Catch more generic error messages
        lowerCaseTrimmedText.includes('malformed') ||
        lowerCaseTrimmedText.includes('rate limit') || // Specific API error messages
        lowerCaseTrimmedText.includes('quota exceeded') ||
        lowerCaseTrimmedText.includes('bad request') || // More error types
        lowerCaseTrimmedText.includes('unauthorized') ||
        lowerCaseTrimmedText.includes('forbidden') ||
        lowerCaseTrimmedText.includes('not found') ||
        lowerCaseTrimmedText.includes('server error')
    ) {
      console.error("Usama Khan's Analysis returned a known invalid literal string or error message for summary:", response.text);
      throw new Error(`Usama Khan's Analysis returned an invalid literal string or error message "${response.text}" for summary. Expected JSON. Please check console for raw API output.`);
    }
    
    // Check for common non-JSON responses (e.g., HTML error pages or API errors formatted as plain text)
    if (trimmedText.startsWith('<html') || trimmedText.startsWith('<!DOCTYPE') || trimmedText.startsWith('<html>') || trimmedText.startsWith('<body')) {
      console.error("Usama Khan's Analysis returned HTML content for summary instead of JSON:", trimmedText);
      throw new Error(`Usama Khan's Analysis returned HTML content for summary. Expected JSON. Please check console for raw API output.`);
    }

    // Crucial check: ensure it starts and ends with valid JSON characters for robustness
    if (!(trimmedText.startsWith('{') && trimmedText.endsWith('}')) && !(trimmedText.startsWith('[') && trimmedText.endsWith(']'))) {
      console.error("Usama Khan's Analysis returned text for summary that is not wrapped in valid JSON object/array characters:", trimmedText);
      throw new Error(`Usama Khan's Analysis returned non-JSON text for summary: "${trimmedText}". Expected a JSON object or array (enclosed in {} or []). Please check console for raw API output.`);
    }

    // Minimum length for an empty JSON object "{}" or array "[]"
    if (trimmedText.length < 2) { 
      console.error("Usama Khan's Analysis returned very short, likely malformed JSON text for summary:", trimmedText);
      throw new Error(`Usama Khan's Analysis returned malformed JSON: "${trimmedText}". Expected a valid JSON structure (minimum 2 characters for {} or []). Please check console for raw API output.`);
    }

    try {
      return JSON.parse(trimmedText) as AnalysisSummary;
    } catch (parseError: any) {
      console.error("JSON parsing failed for Usama Khan's Analysis summary response:", parseError, "Raw text that failed parsing:", trimmedText);
      throw new Error(`Usama Khan's Analysis summary response was not valid JSON. Error: ${parseError.message}. Raw text: "${trimmedText}".`);
    }
  } catch (error) {
    console.error("Analysis Error:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to analyze data: ${error.message}. Please check your network connection or API key.`);
    }
    throw new Error("Failed to analyze data. Please check your network connection or API key.");
  }
};

export const generateDetailedReport = async (
  data: ShotPerformanceData, // Changed to ShotPerformanceData
  fundamentals: string,
  summary: AnalysisSummary
): Promise<DetailedReport> => {
  try {
    if (data.length === 0) throw new Error("No shot data provided for report generation.");

    // Identify available and missing funnel stages from actual data
    const uniqueFunnelStages = Array.from(new Set(data.map(d => d.funnelStage)))
      .filter(stage => ['TOF', 'MOF', 'BOF'].includes(stage));
    const allPossibleStages: FunnelStageContext[] = ['TOF', 'MOF', 'BOF'];
    const missingFunnelStages = allPossibleStages.filter(stage => !uniqueFunnelStages.includes(stage));
    const availableFunnelStagesStr = uniqueFunnelStages.join(', ');

    // Extract all unique metric names from the first entry, excluding non-metric properties
    const allMetricNames = Object.keys(data[0]).filter(key => 
      key !== 'shotId' && key !== 'startDate' && key !== 'endDate' && key !== 'funnelStage' && key !== 'numDaysInShot'
    );
    if (allMetricNames.length === 0) throw new Error("No metrics found in the provided shot data for report generation.");

    // Create the header row for CSV with shot context
    const csvHeader = ["SHOT_ID", "START_DATE", "END_DATE", "FUNNEL_STAGE", "NUM_DAYS_IN_SHOT", ...allMetricNames].join(",");

    // --- Prepare separate CSV data blocks for each available funnel stage ---
    const segregatedCsvBlocks: { [stage: string]: string } = {};
    uniqueFunnelStages.forEach(stage => {
      const stageData = data.filter(shot => shot.funnelStage === stage);
      const stageCsvRows = stageData.map(shot => {
        const values = allMetricNames.map(metricName => (shot[metricName] ?? 0).toString());
        return [shot.shotId, shot.startDate, shot.endDate, shot.funnelStage as string, shot.numDaysInShot, ...values].join(",");
      });
      segregatedCsvBlocks[stage] = [csvHeader, ...stageCsvRows].join("\n");
    });
    
    // Sort uniqueFunnelStages to ensure consistent processing order (TOF, MOF, BOF)
    const sortedUniqueFunnelStages = allPossibleStages.filter(stage => uniqueFunnelStages.includes(stage));


    const prompt = `
      **ABSOLUTE MANDATE: FUNNEL STAGE SEGREGATION AND ISOLATED ANALYSIS**
      **INTERNAL DATA PROCESSING GUIDELINE (STRICTLY ADHERE TO THIS):**
      **CRITICAL FIRST STEP: YOU HAVE BEEN PROVIDED WITH SEGREGATED CSV DATA BLOCKS BELOW, ONE FOR EACH 'FUNNEL_STAGE' PRESENT IN THE CLIENT'S UPLOAD.**
      **ALL SUBSEQUENT CALCULATIONS, COMPARISONS, AND ANALYSES MUST BE PERFORMED ENTIRELY WITHIN EACH FUNNEL_STAGE'S SPECIFIC CSV DATA BLOCK.**
      **ABSOLUTELY NEVER AVERAGE, SUM, OR COMPARE METRICS ACROSS DIFFERENT FUNNEL_STAGEs (TOF, MOF, BOF). Treat data from each stage's CSV block as entirely distinct and separate entities throughout the analysis.**
      **IF A FUNNEL STAGE IS LISTED AS 'MISSING FUNNEL STAGES', DO NOT ANALYZE IT IN THE CONTEXT OF DATA. ONLY ADDRESS IT IN 'missingStageInsights' ARRAY.**
      
      You are a Principal Marketing Strategist at **7figures.pk** (Usama Khan's Analysis Style).
      
      Objective: Generate the textual components for a premium, text-based **Executive Briefing** for a client.
      Your output must be insightful, authoritative, and extremely concise.
      
      **CRITICAL**: Do NOT write long paragraphs. Your output must be in the requested JSON format. Be direct and data-driven.
      
      **Analysis Context**:
      Your analysis must *always* be based on 3-day averages, referred to as "Shots". Compare performance from "Shot" to "Shot".
      
      Available Funnel Stages in Data: ${availableFunnelStagesStr || 'None'}
      Missing Funnel Stages: ${missingFunnelStages.join(', ') || 'None'}

      **CRITICAL AND ABSOLUTELY MANDATORY OUTPUT GUARANTEES**: 
      1. **funnelStageAnalysis Array**: For EACH stage listed in 'Available Funnel Stages in Data' (e.g., TOF, MOF, BOF), you MUST create ONE \`FunnelStageReport\` object in the 'funnelStageAnalysis' array. This is NON-NEGOTIABLE. Its \`stageName\` MUST be the specific stage. Its analysis points (keyTakeaways, expertAdvice, troubleshootingActions, recommendations) MUST solely and exclusively relate to that specific stage's data. Even if data for an AVAILABLE stage is limited, you MUST provide an analysis, ensuring all relevant sections (keyTakeaways, expertAdvice, troubleshootingActions, recommendations) are present for that stage. If no specific finding can be made for a bullet point, explicitly state 'No specific finding for this period in [STAGE] for this metric/area.' Do NOT omit a FunnelStageReport for any available stage.
      2. **missingStageInsights Array**: For EACH stage listed in 'Missing Funnel Stages', you MUST generate ONE specific point in this array. This is also NON-NEGOTIABLE. This point MUST explain the strategic importance of creating or reviewing campaigns for that missing stage. This point MUST be prefixed with [Missing Stage - {STAGE_NAME}]:.
      3. **overallRecommendations Array**: Populate this with general strategic advice not specific to any single funnel stage.
      
      Client Strategy: "${fundamentals}"
      Initial Summary from Analysis: ${JSON.stringify(summary)}
      
      ${sortedUniqueFunnelStages.map(stage => `--- RAW SHOT DATA FOR FUNNEL STAGE: ${stage} ---\n${segregatedCsvBlocks[stage]}`).join('\n\n')}
      
      **Instructions for Content Generation, Applying 7figures.pk Business Rules (PROCESS STAGES IN ORDER: TOF, then MOF, then BOF)**:
      
      1.  **shotExplanation**: Start by defining what a 'Shot' means in this report (a 3-day average period for metrics, e.g., 'Shot 1' covers March 1-3). Explain why this aggregation is used for analysis (e.g., to smooth out daily fluctuations and identify trends). Keep it clear and concise (Max 50 words).
      2.  **headline**: A single, powerful headline summarizing the *key performance insight* from the shot-based data across all funnel stages. Max 15 words.
      
      **For each AVAILABLE funnel stage (TOF, MOF, BOF) - populate a separate FunnelStageReport object in 'funnelStageAnalysis' array (as guaranteed above), USING ONLY THE DATA PROVIDED FOR THAT SPECIFIC STAGE**:
          - **stageName**: Set to 'TOF', 'MOF', or 'BOF'.
          - **keyTakeaways**: 3-4 concise but explanatory bullet points of the most critical findings for THIS STAGE based on shot-to-shot performance analysis from its dedicated CSV data block. Provide clear logical reasoning.
          - **expertAdvice**: 2-3 high-level strategic insights for THIS STAGE, considering shot-based trends and specific metrics from its dedicated CSV data block. Explain *why* these trends are important, offering deeper logical reasoning and context for the shot-based data and overall ROAS situation for THIS STAGE.
          - **troubleshootingActions**: 2-3 immediate, tactical actions for THIS STAGE to address *specific, critical issues identified in shots* from its dedicated CSV data block. Explicitly mention the relevant shot ID, metric, and funnel stage. Explain *the reasoning* behind each action based on the identified issues in shots. Apply the following rules *within this stage, using ONLY its data*:
              - If overall ROAS for THIS STAGE is low (as detected in the summary or your own assessment), *prioritize* troubleshooting actions for issues leading to low ROAS within THIS STAGE.
              - If 'CTR' is continuously dropping in 'TOF' shots (AND this is the TOF stage), identify it as a creative/video issue and suggest immediate creative review.
              - If 'AD FREQUENCY' is increasing or its 3-day average is above 2 in 'TOF' shots (AND this is the TOF stage), recommend immediate addition of more TOF creatives.
              - If the ratio of 'LINK CLICKS' to 'Landing page views' is low or dropping for any shots within THIS STAGE, recommend checking website performance (hosting, loading speed).
              - If the average ratio of 'Landing page views' to 'Add to carts' for a shot within THIS STAGE is below 20%, raise a 'Critical' issue, indicating strong landing page problems. If this ratio is zero (i.e., 'Add to carts' are 0 despite 'Landing page views' > 0), it becomes a 'Top Priority Critical' issue, demanding immediate investigation into pricing, product images, reviews, descriptions, or authenticity on the landing page.
              - If the ratio of 'Add to carts' to 'initiate checkout' is low or dropping within THIS STAGE, suggest checking for checkout friction (e.g., separate cart page).
              - If 'Conversions' are zero (0) while 'Add to carts' are greater than zero (>0) for any shot within THIS STAGE, this must be flagged as a 'Top Priority Critical' issue. Immediately focus on the cart page experience and payment options as the primary suspects.
              - If the ratio of 'initiate checkout' to 'Conversions' is low within THIS STAGE, pinpoint potential payment options issues.
          - **recommendations**: 3 actionable, strategic next steps for THIS STAGE for the coming weeks/months, based on identified shot-to-shot trends, overall performance, and client fundamentals. If ROAS is good for THIS STAGE, provide soft recommendations, otherwise stronger, more direct strategic advice.

      **For overall strategy - generate points in 'overallRecommendations' array:**
          - Provide 2-3 general strategic recommendations that apply to the entire marketing effort, not specific to any one funnel stage.

      Speak as "We" (The 7figures.pk team). Focus on what the data *means* for the client's strategy and business goals, always framing within the "Shot" context, and always exclusively within the context of the specific funnel stage being analyzed for that FunnelStageReport.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: reportSchema,
        thinkingConfig: { thinkingBudget: 32768 }, 
      },
    });
    
    console.log("Usama Khan's Analysis Raw Report Response Text (Initial):", response.text, "Type:", typeof response.text);

    if (response.text === undefined || response.text === null) {
      console.error("Usama Khan's Analysis returned an explicitly undefined or null text response for report generation.");
      throw new Error("Usama Khan's Analysis returned no readable text content for report generation. Expected JSON. It might be an internal error or rate limit. Please try again.");
    }

    const trimmedText: string = (response.text as string).trim(); // Explicit cast after null check
    console.log("Usama Khan's Analysis Raw Report Response Text (Trimmed & Stringified):", trimmedText, "Length:", trimmedText.length);


    if (trimmedText.length === 0) {
      console.error("Usama Khan's Analysis returned an empty string for report generation after trimming.");
      throw new Error(`Usama Khan's Analysis returned an empty response for report generation. Expected JSON. Raw text: "${response.text}".`);
    }

    const lowerCaseTrimmedText = trimmedText.toLowerCase();
    if (
        lowerCaseTrimmedText === 'undefined' ||
        lowerCaseTrimmedText === 'null' ||
        lowerCaseTrimmedText === 'error' ||
        lowerCaseTrimmedText.includes('"error"') || // Catch JSON error objects as strings
        lowerCaseTrimmedText === 'failure' ||
        lowerCaseTrimmedText.includes('invalid') || 
        lowerCaseTrimmedText.includes('malformed') ||
        lowerCaseTrimmedText.includes('rate limit') || // Specific API error messages
        lowerCaseTrimmedText.includes('quota exceeded') ||
        lowerCaseTrimmedText.includes('bad request') || // More error types
        lowerCaseTrimmedText.includes('unauthorized') ||
        lowerCaseTrimmedText.includes('forbidden') ||
        lowerCaseTrimmedText.includes('not found') ||
        lowerCaseTrimmedText.includes('server error')
    ) {
      console.error("Usama Khan's Analysis returned a known invalid literal string or error message for report generation:", response.text);
      throw new Error(`Usama Khan's Analysis returned an invalid literal string or error message "${response.text}" for report generation. Expected JSON. Please check console for raw API output.`);
    }

    // Check for common non-JSON responses (e.g., HTML error pages or API errors formatted as plain text)
    if (trimmedText.startsWith('<html') || trimmedText.startsWith('<!DOCTYPE') || trimmedText.startsWith('<html>') || trimmedText.startsWith('<body')) {
      console.error("Usama Khan's Analysis returned HTML content for report generation instead of JSON:", trimmedText);
      throw new Error(`Usama Khan's Analysis returned HTML content for report generation. Expected JSON. Please check console for raw API output.`);
    }

    if (!(trimmedText.startsWith('{') && trimmedText.endsWith('}')) && !(trimmedText.startsWith('[') && trimmedText.endsWith(']'))) {
      console.error("Usama Khan's Analysis returned text for report generation that is not wrapped in valid JSON object/array characters:", trimmedText);
      throw new Error(`Usama Khan's Analysis returned non-JSON text for report generation: "${trimmedText}". Expected a JSON object or array (enclosed in {} or []). Please check console for raw API output.`);
    }

    // Additional check: to prevent issues with very short, malformed strings
    if (trimmedText.length < 2) { 
      console.error("Usama Khan's Analysis returned very short, likely malformed JSON text for report generation:", trimmedText);
      throw new Error(`Usama Khan's Analysis returned malformed JSON: "${trimmedText}". Expected a valid JSON structure (minimum 2 characters for {} or []). Please check console for raw API output.`);
    }

    try {
      return JSON.parse(trimmedText) as DetailedReport;
    } catch (parseError: any) {
      console.error("JSON parsing failed for Usama Khan's Analysis report response:", parseError, "Raw text that failed parsing:", trimmedText);
      throw new Error(`Usama Khan's Analysis report response was not valid JSON. Error: ${parseError.message}. Raw text: "${trimmedText}".`);
    }
  } catch (error) {
    console.error("Report Generation Error:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to generate report: ${error.message}. Please check your network connection or API key.`);
    }
    throw new Error("Failed to generate report. Please check your network connection or API key.");
  }
};

export const generateMarketingRoadmap = async (
  detailedReport: DetailedReport,
  summary: AnalysisSummary,
  fundamentals: string
): Promise<MarketingRoadmap> => {
  try {
    const prompt = `
      You are a Principal Strategist at **7figures.pk** (Usama Khan's Analysis Style).

      Objective: Create a high-impact, visual **Marketing Roadmap** based on the deep analysis previously performed.
      This roadmap should be a logical, 3-phase strategic plan (e.g., Phase 1: Stabilization/Fix, Phase 2: Optimization/Testing, Phase 3: Scaling/Expansion) tailored specifically to the client's current performance and issues.

      **Inputs:**
      - Client Fundamentals: "${fundamentals}"
      - Executive Summary: "${summary.executiveSummary}"
      - Identified Anomalies: ${JSON.stringify(summary.anomalies)}
      - Deep Funnel Analysis: ${JSON.stringify(detailedReport.funnelStageAnalysis)}

      **Tasks:**
      1. **Strategy Summary**: Write a concise (max 50 words) executive summary of this roadmap's approach.
      2. **Phases**: Create exactly 3 distinct phases.
         - **Phase 1** must address the "Critical" or "Top Priority" issues identified in the analysis (e.g., if TOF CTR is low, Phase 1 is Creative Testing; if Conversion rate is 0, Phase 1 is Website/Checkout Fixes).
         - **Phase 2** should focus on optimizing the healthy parts of the funnel and testing new angles.
         - **Phase 3** should focus on scaling winning creatives/audiences and budget expansion.
      3. **Budget Allocation**: Provide strategic advice on how to split the budget across TOF, MOF, and BOF for the next period based on this roadmap.

      Output strictly in JSON.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: roadmapSchema,
        thinkingConfig: { thinkingBudget: 16384 },
      },
    });

    const trimmedText = (response.text as string).trim();
    if (!trimmedText.startsWith('{')) throw new Error("Invalid JSON response");
    
    return JSON.parse(trimmedText) as MarketingRoadmap;

  } catch (error) {
    console.error("Roadmap Generation Error:", error);
    throw new Error("Failed to generate marketing roadmap.");
  }
};
