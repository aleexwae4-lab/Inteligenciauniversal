import { analyzeAttachments, analyticsInstruction, publicAnalyticsContract, ANALYTICS_ENGINE_VERSION } from '../native-analytics-v1.js';
import { buildDataIntelligenceWorkspace, dataIntelligenceInstruction, publicDataIntelligenceContract, DATA_INTELLIGENCE_WORKSPACE_VERSION } from '../data-intelligence-workspace-v1.js';
import { buildVisualizationSpecs, visualizationInstruction, publicVisualizationContract, NATIVE_VISUALIZATION_VERSION } from '../native-visualization-v1.js';
import { buildDecisionWorkspace, decisionWorkspaceInstruction, publicDecisionWorkspaceContract, DECISION_WORKSPACE_VERSION } from '../decision-workspace-v1.js';
import { buildMultimodalIntelligence, multimodalIntelligenceInstruction, publicMultimodalIntelligence } from '../multimodal-intelligence-v1.js';
import { buildMultimodalEvidenceGraph, evidenceGraphInstruction, publicEvidenceGraph } from '../multimodal-evidence-graph-v1.js';
import { buildCrossMediaReasoning, crossMediaInstruction, publicCrossMediaReasoning } from '../cross-media-reasoning-v1.js';
import { buildEvidenceLocations, evidenceLocationsInstruction, publicEvidenceLocations } from '../multimodal-evidence-locations-v1.js';
import { buildMultimodalFindings, findingsInstruction, publicFindings } from '../multimodal-findings-v1.js';
import { buildMultimodalInvestigation, investigationInstruction, publicInvestigation } from '../multimodal-investigation-v1.js';
import { buildTruthConflictEngine, truthConflictInstruction, publicTruthConflict, MULTIMODAL_TRUTH_CONFLICT_VERSION } from '../multimodal-truth-conflict-v1.js';
import { buildTemporalCausalEngine, temporalCausalInstruction, publicTemporalCausal, MULTIMODAL_TEMPORAL_CAUSAL_VERSION } from '../multimodal-temporal-causal-v1.js';
import { buildMultimodalEvidenceSynthesis, evidenceSynthesisInstruction, publicEvidenceSynthesis, MULTIMODAL_EVIDENCE_SYNTHESIS_VERSION } from '../multimodal-evidence-synthesis-v1.js';
import { buildMultimodalAnswerComposer, answerComposerInstruction, publicAnswerComposer, MULTIMODAL_ANSWER_COMPOSER_VERSION } from '../multimodal-answer-composer-v1.js';
import { buildMultimodalVerificationLoop, runMultimodalVerificationPass, evaluateVerificationEvidence, verificationLoopInstruction, publicVerificationLoop, MULTIMODAL_VERIFICATION_LOOP_VERSION } from '../multimodal-verification-loop-v1.js';
import { buildEvidenceDecision, evidenceDecisionInstruction, publicEvidenceDecision, MULTIMODAL_EVIDENCE_DECISION_VERSION } from '../multimodal-evidence-decision-v1.js';
import { buildEvidenceQuality, evidenceQualityInstruction, publicEvidenceQuality, MULTIMODAL_EVIDENCE_QUALITY_VERSION } from '../multimodal-evidence-quality-v1.js';
import { buildEvidenceCalibration, evidenceCalibrationInstruction, publicEvidenceCalibration, MULTIMODAL_EVIDENCE_CALIBRATION_VERSION } from '../multimodal-evidence-calibration-v1.js';

export {
  analyzeAttachments, analyticsInstruction, publicAnalyticsContract, ANALYTICS_ENGINE_VERSION,
  buildDataIntelligenceWorkspace, dataIntelligenceInstruction, publicDataIntelligenceContract, DATA_INTELLIGENCE_WORKSPACE_VERSION,
  buildVisualizationSpecs, visualizationInstruction, publicVisualizationContract, NATIVE_VISUALIZATION_VERSION,
  buildDecisionWorkspace, decisionWorkspaceInstruction, publicDecisionWorkspaceContract, DECISION_WORKSPACE_VERSION,
  buildMultimodalIntelligence, multimodalIntelligenceInstruction, publicMultimodalIntelligence,
  buildMultimodalEvidenceGraph, evidenceGraphInstruction, publicEvidenceGraph,
  buildCrossMediaReasoning, crossMediaInstruction, publicCrossMediaReasoning,
  buildEvidenceLocations, evidenceLocationsInstruction, publicEvidenceLocations,
  buildMultimodalFindings, findingsInstruction, publicFindings,
  buildMultimodalInvestigation, investigationInstruction, publicInvestigation,
  buildTruthConflictEngine, truthConflictInstruction, publicTruthConflict, MULTIMODAL_TRUTH_CONFLICT_VERSION,
  buildTemporalCausalEngine, temporalCausalInstruction, publicTemporalCausal, MULTIMODAL_TEMPORAL_CAUSAL_VERSION,
  buildMultimodalEvidenceSynthesis, evidenceSynthesisInstruction, publicEvidenceSynthesis, MULTIMODAL_EVIDENCE_SYNTHESIS_VERSION,
  buildMultimodalAnswerComposer, answerComposerInstruction, publicAnswerComposer, MULTIMODAL_ANSWER_COMPOSER_VERSION,
  buildMultimodalVerificationLoop, runMultimodalVerificationPass, evaluateVerificationEvidence, verificationLoopInstruction, publicVerificationLoop, MULTIMODAL_VERIFICATION_LOOP_VERSION,
  buildEvidenceDecision, evidenceDecisionInstruction, publicEvidenceDecision, MULTIMODAL_EVIDENCE_DECISION_VERSION,
  buildEvidenceQuality, evidenceQualityInstruction, publicEvidenceQuality, MULTIMODAL_EVIDENCE_QUALITY_VERSION,
  buildEvidenceCalibration, evidenceCalibrationInstruction, publicEvidenceCalibration, MULTIMODAL_EVIDENCE_CALIBRATION_VERSION,
};

export function buildMultimodalLane({attachments=[]}={}){
  const hasAttachments=Array.isArray(attachments)&&attachments.length>0;
  if(!hasAttachments){
    return {
      hasAttachments:false,
      analyticsReport:[],
      multimodalIntelligence:null,
      multimodalEvidenceGraph:null,
      crossMediaReasoning:null,
      evidenceLocations:null,
      multimodalFindings:{findings:[]},
      multimodalInvestigation:null,
      multimodalTruthConflict:null,
      multimodalTemporalCausal:null,
      multimodalEvidenceSynthesis:null,
      multimodalAnswerComposer:null,
      multimodalVerificationLoop:null,
      dataIntelligenceWorkspace:null,
      visualizationSpecs:[],
      decisionWorkspace:null,
    };
  }

  const analyticsReport=analyzeAttachments(attachments);
  const multimodalIntelligence=buildMultimodalIntelligence(attachments);
  const multimodalEvidenceGraph=buildMultimodalEvidenceGraph(attachments);
  const crossMediaReasoning=buildCrossMediaReasoning(attachments,multimodalEvidenceGraph);
  const evidenceLocations=buildEvidenceLocations(attachments);
  const multimodalFindings=buildMultimodalFindings(attachments,multimodalEvidenceGraph,crossMediaReasoning);
  const multimodalInvestigation=buildMultimodalInvestigation({attachments,findings:multimodalFindings,evidenceGraph:multimodalEvidenceGraph});
  const multimodalTruthConflict=buildTruthConflictEngine(attachments,multimodalFindings.findings||multimodalFindings.evidence||[]);
  const multimodalTemporalCausal=buildTemporalCausalEngine(attachments,multimodalFindings.findings||[]);
  const multimodalEvidenceSynthesis=buildMultimodalEvidenceSynthesis({attachments,findings:multimodalFindings,investigation:multimodalInvestigation,truthConflict:multimodalTruthConflict,temporalCausal:multimodalTemporalCausal});
  const multimodalAnswerComposer=buildMultimodalAnswerComposer(multimodalEvidenceSynthesis);
  const multimodalVerificationLoop=buildMultimodalVerificationLoop({synthesis:multimodalEvidenceSynthesis,composer:multimodalAnswerComposer,toolResults:[]});
  const dataIntelligenceWorkspace=buildDataIntelligenceWorkspace(analyticsReport);
  const visualizationSpecs=buildVisualizationSpecs(analyticsReport);
  const decisionWorkspace=buildDecisionWorkspace(dataIntelligenceWorkspace);

  return {hasAttachments:true,analyticsReport,multimodalIntelligence,multimodalEvidenceGraph,crossMediaReasoning,evidenceLocations,multimodalFindings,multimodalInvestigation,multimodalTruthConflict,multimodalTemporalCausal,multimodalEvidenceSynthesis,multimodalAnswerComposer,multimodalVerificationLoop,dataIntelligenceWorkspace,visualizationSpecs,decisionWorkspace};
}
