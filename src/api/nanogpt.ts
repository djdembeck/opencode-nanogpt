import axios, { AxiosError } from 'axios';
import { NanogptModel } from '../providers/nanogpt.js';
import { ConfigManager } from '../config-manager.js';
import { updateNanogptProvider } from '../providers/nanogpt.js';

const API_BASE_URL = 'https://nano-gpt.com';
const API_TIMEOUT = 30000;

/**
 * API response structure from NanoGPT models endpoint
 */
interface ApiModel {
  id: string;
  name?: string;
  context_length?: number;
  max_output_tokens?: number;
  capabilities?: {
    reasoning?: boolean;
    vision?: boolean;
  };
  pricing?: {
    input: number;
    output: number;
  };
  created?: number;
}

interface ApiResponse {
  models: ApiModel[];
}

/**
 * Custom error class for NanoGPT API errors
 */
export class NanogptApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code: string = 'API_ERROR'
  ) {
    super(message);
    this.name = 'NanogptApiError';
  }
}

/**
 * Fetches available models from the NanoGPT API.
 *
 * @param apiKey - The NanoGPT API key for authentication
 * @returns Promise resolving to an array of NanogptModel objects
 * @throws NanogptApiError if the request fails
 */
export async function fetchModels(apiKey: string): Promise<NanogptModel[]> {
  try {
    const response = await axios.get<ApiResponse>(
      `${API_BASE_URL}/api/v1/models?detailed=true`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
        timeout: API_TIMEOUT,
      }
    );

    if (!response.data?.models || !Array.isArray(response.data.models)) {
      throw new NanogptApiError(
        'Invalid API response: missing or invalid models array',
        response.status,
        'INVALID_RESPONSE'
      );
    }

    return response.data.models.map(transformApiModel);
  } catch (error) {
    if (error instanceof NanogptApiError) {
      throw error;
    }

    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;

      if (axiosError.response) {
        const status = axiosError.response.status;

        if (status === 401) {
          throw new NanogptApiError(
            'Authentication failed: Invalid API key',
            status,
            'AUTH_ERROR'
          );
        }

        if (status === 429) {
          throw new NanogptApiError(
            'Rate limit exceeded: Too many requests',
            status,
            'RATE_LIMIT'
          );
        }

        if (status >= 500) {
          throw new NanogptApiError(
            'NanoGPT API server error: Please try again later',
            status,
            'SERVER_ERROR'
          );
        }

        throw new NanogptApiError(
          `API request failed: ${axiosError.message}`,
          status,
          'REQUEST_FAILED'
        );
      }

      if (axiosError.code === 'ECONNABORTED') {
        throw new NanogptApiError(
          'Request timeout: API did not respond in time',
          undefined,
          'TIMEOUT'
        );
      }

      if (axiosError.code === 'ENOTFOUND' || axiosError.code === 'ECONNREFUSED') {
        throw new NanogptApiError(
          'Network error: Unable to connect to NanoGPT API',
          undefined,
          'NETWORK_ERROR'
        );
      }

      throw new NanogptApiError(
        `Network error: ${axiosError.message}`,
        undefined,
        'NETWORK_ERROR'
      );
    }

    throw new NanogptApiError(
      `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      undefined,
      'UNKNOWN_ERROR'
    );
  }
}

/**
 * Transforms an API model response into the OpenCode NanogptModel format.
 *
 * @param apiModel - The raw model data from the NanoGPT API
 * @returns A NanogptModel object configured for OpenCode
 */
export function transformApiModel(apiModel: ApiModel): NanogptModel {
  const contextLength = apiModel.context_length ?? 128000;
  const maxOutputTokens = apiModel.max_output_tokens ?? Math.min(contextLength, 128000);

  const model: NanogptModel = {
    id: apiModel.id,
    name: apiModel.name || apiModel.id,
    limit: {
      context: contextLength,
      output: maxOutputTokens,
    },
    temperature: true,
    tool_call: true,
    modalities: {
      input: apiModel.capabilities?.vision ? ['text', 'image'] : ['text'],
      output: ['text'],
    },
  };

  if (apiModel.capabilities?.reasoning) {
    model.reasoning = true;
    model.interleaved = { field: 'reasoning_content' };
  }

  if (apiModel.pricing) {
    model.cost = {
      input: apiModel.pricing.input,
      output: apiModel.pricing.output,
    };
  }

  if (apiModel.created) {
    model.release_date = new Date(apiModel.created * 1000).toISOString().split('T')[0];
  }

  return model;
}

/**
 * Fetches models from the NanoGPT API and updates the configuration file.
 *
 * @param configManager - ConfigManager instance for surgical config edits
 * @param filePath - Path to the OpenCode configuration file
 * @param apiKey - The NanoGPT API key for authentication
 * @throws NanogptApiError if the API request fails
 * @throws Error if config update fails
 */
export async function updateModelsFromApi(
  configManager: ConfigManager,
  filePath: string,
  apiKey: string
): Promise<void> {
  const models = await fetchModels(apiKey);

  const modelsRecord: Record<string, NanogptModel> = {};
  for (const model of models) {
    modelsRecord[model.id] = model;
  }

  await updateNanogptProvider(configManager, filePath, modelsRecord);
}
