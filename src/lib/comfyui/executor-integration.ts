import { callComfyUI } from '@/lib/comfyui-call-service';
export async function executeFeatureWorkflow(featureId: string, workflowId: string | null, inputs: Record<string, unknown>) { return callComfyUI({ featureId, ...(inputs as Record<string, unknown>), workflowId: workflowId || undefined }); }
