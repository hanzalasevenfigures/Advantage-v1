
export interface DailyPerformanceEntry {
  date: string; // e.g., "1 Mar", "2 Mar", etc.
  CPM: number;
  CTR: number;
  REACH: number;
  "LINK CLICKS": number;
  "Landing page views": number;
  "Add to carts": number;
  "initiate checkout": number;
  Conversions: number;
  CPA: number;
  ROAS: number;
  "Ad spent": number;
  "AD FREQUENCY": number; // New metric
  [key: string]: string | number; // For dynamic access
}

export type FunnelStageContext = 'TOF' | 'MOF' | 'BOF';

export interface ShotAnalysisEntry {
  shotId: string; // e.g., "TOF-Shot 1"
  startDate: string; // "1 Mar"
  endDate: string; // "3 Mar"
  numDaysInShot: number; // Number of days aggregated in this shot
  funnelStage: FunnelStageContext; // Assigned based on upload section
  
  // 3-day average values for all metrics
  CPM: number;
  CTR: number;
  REACH: number;
  "LINK CLICKS": number;
  "Landing page views": number;
  "Add to carts": number;
  "initiate checkout": number;
  Conversions: number;
  CPA: number;
  ROAS: number;
  "Ad spent": number;
  "AD FREQUENCY": number;
  [key: string]: string | number; // For dynamic access
}

export type ShotPerformanceData = ShotAnalysisEntry[]; // Renamed from PerformanceData

export interface Anomaly {
  metric: string;
  shotId: string; // The specific shot (e.g., "Shot 5") where the anomaly was found
  funnelStage: string; // Added funnel stage to anomaly
  observation: string;
  impact: string;
  severity: 'Critical' | 'Warning' | 'Info';
}

export interface AnalysisSummary {
  executiveSummary: string;
  keyWins: string[];
  areasForImprovement: string[];
  recommendations: string[];
  anomalies: Anomaly[];
  overallScore: number; // 0-100
}

export interface FunnelStageReport {
  stageName: FunnelStageContext; // Now reflects the selected/treated funnel stage
  keyTakeaways: string[];
  expertAdvice: string[];
  troubleshootingActions: string[];
  recommendations: string[];
}

export interface DetailedReport {
  shotExplanation: string; // New: Explanation of what a 'Shot' is
  headline: string;
  funnelStageAnalysis: FunnelStageReport[]; // Now contains reports for all AVAILABLE funnel stages
  missingStageInsights: string[]; // New: Advice specifically for funnel stages NOT present in the data
  overallRecommendations: string[]; // New: General recommendations not tied to a specific stage
}

export interface RoadmapPhase {
  phaseName: string; // e.g., "Phase 1: Stabilization & Fixes"
  duration: string; // e.g., "Weeks 1-2"
  focusArea: string; // e.g., "Creative Testing & TOF Optimization"
  objectives: string[];
  actionItems: string[];
}

export interface MarketingRoadmap {
  strategySummary: string; // High level summary of the roadmap approach
  phases: RoadmapPhase[];
  budgetAllocation: string[]; // Advice on how to split budget across phases/funnels
}

export enum AppState {
  LANDING = 'LANDING',
  UPLOAD = 'UPLOAD',
  ANALYZING = 'ANALYZING',
  DASHBOARD = 'DASHBOARD',
}

export interface AggregatedMetrics {
  totalAdSpent: number; // From "Ad spent"
  totalConversions: number; // From "Conversions"
  totalLinkClicks: number; // From "LINK CLICKS"
  totalReach: number; // From "REACH"
  totalLPViews: number; // From "Landing page views"
  totalATCs: number; // From "Add to carts"
  totalICs: number; // From "initiate checkout"

  // Averages for rate/ratio metrics (averaged across all shots)
  avgCPM: number; // From "CPM"
  avgCTR: number; // From "CTR"
  avgROAS: number; // From "ROAS"
  avgCPA: number; // From "CPA"
  avgAdFrequency: number; // From "AD FREQUENCY"

  // Derived metrics (if needed, otherwise 0 or direct average)
  cpc: number; // Cost Per Click (Derived from Ad Spent / Link Clicks)
  totalImpressions: number; // Can be derived if CPM and Ad Spent are known (Ad Spent / CPM * 1000)
}
