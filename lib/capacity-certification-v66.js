import {
  CAPACITY_POLICY_VERSION,
  CAPACITY_TARGET_SUBSCRIBERS,
  CAPACITY_TARGET_CONCURRENCY,
  CAPACITY_STAGES,
  architectureEvidenceForPrincipals,
  evaluateArchitectureEvidence,
  evaluateCapacityStage,
  capacityEvidenceFingerprint,
  certifyCapacityEvidence as certifyV65,
  capacityAutopilotDecision as autopilotV65,
  latestTrustedCapacityCertification,
  recordTrustedCapacityCertification,
  capacityCertificationCapabilities as capabilitiesV65
} from './capacity-certification-v65.js';

export const CAPACITY_CERTIFICATION_VERSION='capacity-certification/v66';
export {
  CAPACITY_POLICY_VERSION,
  CAPACITY_TARGET_SUBSCRIBERS,
  CAPACITY_TARGET_CONCURRENCY,
  CAPACITY_STAGES,
  architectureEvidenceForPrincipals,
  evaluateArchitectureEvidence,
  evaluateCapacityStage,
  capacityEvidenceFingerprint,
  latestTrustedCapacityCertification,
  recordTrustedCapacityCertification
};

export function certifyCapacityEvidence(evidence={},options={}){
  return{...certifyV65(evidence,options),version:CAPACITY_CERTIFICATION_VERSION};
}

export function capacityAutopilotDecision(metrics={}){
  return{...autopilotV65(metrics),version:CAPACITY_CERTIFICATION_VERSION};
}

export function capacityCertificationCapabilities(){
  return{...capabilitiesV65(),version:CAPACITY_CERTIFICATION_VERSION,release:'Universal Core v66'};
}
