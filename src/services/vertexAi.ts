import { getFirebaseBundle } from './firebase';
import { getAI, getGenerativeModel, VertexAIBackend, GenerativeModel } from 'firebase/ai';

let cachedModel: GenerativeModel | null = null;

/**
 * Gets the initialized Vertex AI generative model safely.
 * Returns null if Firebase is not configured or initialization fails.
 */
export function getVertexModel(): GenerativeModel | null {
  if (cachedModel) return cachedModel;

  const bundle = getFirebaseBundle();
  if (!bundle) {
    console.warn('[Vertex AI]: Firebase bundle not available yet.');
    return null;
  }

  try {
    // We use us-central1 as the default location. Ensure Vertex AI API is enabled in this region for your project.
    const backend = new VertexAIBackend('us-central1');
    const ai = getAI(bundle.app, {
      backend,
    });

    cachedModel = getGenerativeModel(ai, {
      model: 'gemini-2.5-flash',
    });
    return cachedModel;
  } catch (error) {
    console.error('[Vertex AI]: Failed to initialize Vertex AI:', error);
    return null;
  }
}
