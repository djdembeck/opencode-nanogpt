import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import {
  fetchModels,
  transformApiModel,
  updateModelsFromApi,
  NanogptApiError,
} from './nanogpt.js';
import { ConfigManager } from '../config-manager.js';
import { readFile, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import axios from 'axios';

describe('fetchModels', () => {
  const originalGet = axios.get;

  beforeEach(() => {
    axios.get = originalGet;
  });

  afterEach(() => {
    axios.get = originalGet;
  });

  test('fetches models successfully from API', async () => {
    const mockResponse = {
      data: {
        models: [
          {
            id: 'zai-org/glm-4.7',
            name: 'GLM 4.7',
            context_length: 200000,
            max_output_tokens: 65535,
            capabilities: { reasoning: false, vision: false },
            pricing: { input: 0.0001, output: 0.0002 },
            created: 1704067200,
          },
        ],
      },
      status: 200,
      statusText: 'OK',
    };

    axios.get = () => Promise.resolve(mockResponse) as any;

    const models = await fetchModels('test-api-key');

    expect(models.length).toBe(1);
    expect(models[0].id).toBe('zai-org/glm-4.7');
    expect(models[0].name).toBe('GLM 4.7');
  });

  test('throws auth error on 401 response', async () => {
    const error = new Error('Request failed') as any;
    error.isAxiosError = true;
    error.response = { status: 401, data: {} };
    axios.get = () => Promise.reject(error);

    try {
      await fetchModels('invalid-key');
      expect(false).toBe(true);
    } catch (err) {
      expect(err instanceof NanogptApiError).toBe(true);
      expect((err as NanogptApiError).message).toContain('Authentication failed');
    }
  });

  test('throws rate limit error on 429 response', async () => {
    const error = new Error('Too many requests') as any;
    error.isAxiosError = true;
    error.response = { status: 429, data: {} };
    axios.get = () => Promise.reject(error);

    try {
      await fetchModels('test-key');
      expect(false).toBe(true);
    } catch (err) {
      expect(err instanceof NanogptApiError).toBe(true);
      expect((err as NanogptApiError).message).toContain('Rate limit exceeded');
    }
  });

  test('throws server error on 500+ response', async () => {
    const error = new Error('Server error') as any;
    error.isAxiosError = true;
    error.response = { status: 500, data: {} };
    axios.get = () => Promise.reject(error);

    try {
      await fetchModels('test-key');
      expect(false).toBe(true);
    } catch (err) {
      expect(err instanceof NanogptApiError).toBe(true);
      expect((err as NanogptApiError).message).toContain('server error');
    }
  });

  test('throws timeout error on timeout', async () => {
    const error = new Error('Timeout') as any;
    error.isAxiosError = true;
    error.code = 'ECONNABORTED';
    axios.get = () => Promise.reject(error);

    try {
      await fetchModels('test-key');
      expect(false).toBe(true);
    } catch (err) {
      expect(err instanceof NanogptApiError).toBe(true);
      expect((err as NanogptApiError).message).toContain('timeout');
    }
  });

  test('throws network error on connection failure', async () => {
    const error = new Error('Network Error') as any;
    error.isAxiosError = true;
    error.code = 'ENOTFOUND';
    axios.get = () => Promise.reject(error);

    try {
      await fetchModels('test-key');
      expect(false).toBe(true);
    } catch (err) {
      expect(err instanceof NanogptApiError).toBe(true);
      expect((err as NanogptApiError).message).toContain('Network error');
    }
  });

  test('throws network error on connection refused', async () => {
    const error = new Error('Connection refused') as any;
    error.isAxiosError = true;
    error.code = 'ECONNREFUSED';
    axios.get = () => Promise.reject(error);

    try {
      await fetchModels('test-key');
      expect(false).toBe(true);
    } catch (err) {
      expect(err instanceof NanogptApiError).toBe(true);
      expect((err as NanogptApiError).message).toContain('Network error');
    }
  });

  test('throws invalid response error when models array is missing', async () => {
    axios.get = () =>
      Promise.resolve({
        data: { error: 'invalid' },
        status: 200,
      }) as any;

    try {
      await fetchModels('test-key');
      expect(false).toBe(true);
    } catch (err) {
      expect(err instanceof NanogptApiError).toBe(true);
      expect((err as NanogptApiError).message).toContain('Invalid API response');
    }
  });

  test('throws unknown error on unexpected errors', async () => {
    axios.get = () => Promise.reject(new Error('Unexpected'));

    try {
      await fetchModels('test-key');
      expect(false).toBe(true);
    } catch (err) {
      expect(err instanceof NanogptApiError).toBe(true);
      expect((err as NanogptApiError).message).toContain('Unexpected error');
    }
  });

  test('does not expose API key in error messages', async () => {
    const error = new Error('Request failed') as any;
    error.isAxiosError = true;
    error.response = { status: 400, data: {} };
    axios.get = () => Promise.reject(error);

    try {
      await fetchModels('secret-api-key-12345');
    } catch (err) {
      const errorMessage = (err as Error).message;
      expect(errorMessage.includes('secret-api-key-12345')).toBe(false);
    }
  });
});

describe('transformApiModel', () => {
  test('transforms basic model correctly', () => {
    const apiModel = {
      id: 'zai-org/glm-4.7',
      name: 'GLM 4.7',
      context_length: 200000,
      max_output_tokens: 65535,
      capabilities: { reasoning: false, vision: false },
      pricing: { input: 0.0001, output: 0.0002 },
      created: 1704067200,
    };

    const model = transformApiModel(apiModel);

    expect(model.id).toBe('zai-org/glm-4.7');
    expect(model.name).toBe('GLM 4.7');
    expect(model.limit.context).toBe(200000);
    expect(model.limit.output).toBe(65535);
    expect(model.temperature).toBe(true);
    expect(model.tool_call).toBe(true);
    expect(model.reasoning).toBeUndefined();
    expect(model.interleaved).toBeUndefined();
    expect(model.modalities.input).toEqual(['text']);
    expect(model.modalities.output).toEqual(['text']);
    expect(model.cost).toEqual({ input: 0.0001, output: 0.0002 });
    expect(model.release_date).toBe('2024-01-01');
  });

  test('transforms reasoning model with interleaved field', () => {
    const apiModel = {
      id: 'zai-org/glm-4.7:thinking',
      name: 'GLM 4.7 Thinking',
      context_length: 200000,
      capabilities: { reasoning: true, vision: false },
    };

    const model = transformApiModel(apiModel);

    expect(model.reasoning).toBe(true);
    expect(model.interleaved).toEqual({ field: 'reasoning_content' });
  });

  test('transforms vision model with image support', () => {
    const apiModel = {
      id: 'gpt-4-vision',
      name: 'GPT-4 Vision',
      context_length: 128000,
      capabilities: { reasoning: false, vision: true },
    };

    const model = transformApiModel(apiModel);

    expect(model.modalities.input).toEqual(['text', 'image']);
  });

  test('uses id as name when name is not provided', () => {
    const apiModel = {
      id: 'custom-model-id',
    };

    const model = transformApiModel(apiModel);

    expect(model.name).toBe('custom-model-id');
  });

  test('uses defaults when optional fields are missing', () => {
    const apiModel = {
      id: 'minimal-model',
    };

    const model = transformApiModel(apiModel);

    expect(model.limit.context).toBe(128000);
    expect(model.limit.output).toBe(128000);
    expect(model.cost).toBeUndefined();
    expect(model.release_date).toBeUndefined();
  });

  test('limits output tokens to 128000 max', () => {
    const apiModel = {
      id: 'large-context-model',
      context_length: 200000,
    };

    const model = transformApiModel(apiModel);

    expect(model.limit.output).toBe(128000);
  });

  test('correctly converts unix timestamp to ISO date', () => {
    const apiModel = {
      id: 'dated-model',
      created: 1700000000,
    };

    const model = transformApiModel(apiModel);

    expect(model.release_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('updateModelsFromApi', () => {
  let configManager: ConfigManager;
  let testFilePath: string;
  const originalGet = axios.get;

  beforeEach(async () => {
    configManager = new ConfigManager();
    testFilePath = join('/tmp', `test-api-update-${Date.now()}.json`);
    axios.get = originalGet;
  });

  afterEach(async () => {
    axios.get = originalGet;
    try {
      await unlink(testFilePath);
    } catch {}
  });

  test('fetches and updates models in config', async () => {
    const mockResponse = {
      data: {
        models: [
          {
            id: 'zai-org/glm-4.7',
            name: 'GLM 4.7',
            context_length: 200000,
            capabilities: { reasoning: false },
          },
        ],
      },
      status: 200,
    };

    axios.get = () => Promise.resolve(mockResponse) as any;

    await writeFile(
      testFilePath,
      JSON.stringify(
        { provider: { nanogpt: { npm: '@ai-sdk', name: 'Nano', options: {}, models: {} } } },
        null,
        2
      )
    );

    await updateModelsFromApi(configManager, testFilePath, 'test-key');

    const content = await readFile(testFilePath, 'utf-8');
    const config = JSON.parse(content);

    expect(config.provider.nanogpt.models['zai-org/glm-4.7']).toBeDefined();
    expect(config.provider.nanogpt.models['zai-org/glm-4.7'].name).toBe('GLM 4.7');
  });

  test('propagates API errors without exposing API key', async () => {
    const error = new Error('Request failed') as any;
    error.isAxiosError = true;
    error.response = { status: 401 };
    axios.get = () => Promise.reject(error);

    await writeFile(
      testFilePath,
      JSON.stringify({ provider: { nanogpt: { models: {} } } })
    );

    try {
      await updateModelsFromApi(configManager, testFilePath, 'secret-key');
      expect(false).toBe(true);
    } catch (err) {
      const errorMessage = (err as Error).message;
      expect(errorMessage.includes('secret-key')).toBe(false);
      expect(err instanceof NanogptApiError).toBe(true);
    }
  });
});

describe('NanogptApiError', () => {
  test('creates error with message and code', () => {
    const error = new NanogptApiError('Test error', 500, 'TEST_ERROR');

    expect(error.message).toBe('Test error');
    expect(error.statusCode).toBe(500);
    expect(error.code).toBe('TEST_ERROR');
    expect(error.name).toBe('NanogptApiError');
  });

  test('creates error with default code', () => {
    const error = new NanogptApiError('Test error');

    expect(error.code).toBe('API_ERROR');
  });
});
