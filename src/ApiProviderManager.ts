import * as vscode from 'vscode';
import { ClaudeApiClient } from './ClaudeApiClient';
import { OpenAIApiClient } from './OpenAIApiClient';
import { ClaudeMessage, ClaudeTool, ClaudeResponse, ToolResult } from './types';
import { ConfigurationManager } from './ConfigurationManager';

export type ApiProvider = 'claude' | 'openai';

export interface ApiProviderInterface {
  chat(
    messages: ClaudeMessage[],
    tools?: ClaudeTool[],
    onStream?: (chunk: string) => void,
    modelId?: string,
    onToolCall?: (toolCall: {id: string, name: string, input: any}) => void,
    onThinking?: (thinking: string) => void
  ): Promise<ClaudeResponse>;
  
  sendWithToolResults(
    messages: ClaudeMessage[],
    tools: ClaudeTool[],
    toolResults: ToolResult[],
    onStream?: (chunk: string) => void,
    onThinking?: (thinking: string) => void
  ): Promise<ClaudeResponse>;
  
  cancel(): void;
}

export class ApiProviderManager {
  private static readonly instance = new ApiProviderManager();
  private claudeClient?: ClaudeApiClient;
  private openaiClient?: OpenAIApiClient;
  private currentProvider: ApiProvider = 'claude';
  private context?: vscode.ExtensionContext;

  private constructor() {}

  static getInstance(): ApiProviderManager {
    return this.instance;
  }

  initialize(context: vscode.ExtensionContext): void {
    this.context = context;
    this.claudeClient = new ClaudeApiClient(context);
    this.openaiClient = new OpenAIApiClient(context);
    
    // Load current provider from configuration
    const config = ConfigurationManager.getInstance().getConfig();
    this.currentProvider = this.getProviderFromConfig(config);
  }

  private getProviderFromConfig(config: any): ApiProvider {
    // First check for explicit provider setting (this should take priority)
    const providerSetting = config.provider as ApiProvider;
    if (providerSetting === 'claude' || providerSetting === 'openai') {
      return providerSetting;
    }
    
    // If no explicit setting, try to detect from API URL
    if (config.apiUrl && config.apiUrl.includes('chutes.ai')) {
      return 'openai';
    }
    
    // Default to Claude
    return 'claude';
  }

  getCurrentProvider(): ApiProvider {
    return this.currentProvider;
  }

  setCurrentProvider(provider: ApiProvider): void {
    this.currentProvider = provider;
  }

  refreshProviderFromConfig(): void {
    const config = ConfigurationManager.getInstance().getConfig();
    const newProvider = this.getProviderFromConfig(config);
    if (newProvider !== this.currentProvider) {
      console.log(`[ApiProviderManager] Provider changed from ${this.currentProvider} to ${newProvider}`);
      this.currentProvider = newProvider;
    }
  }

  getProviderName(): string {
    switch (this.currentProvider) {
      case 'claude':
        return 'Claude API (Chutes AI)';
      case 'openai':
        return 'OpenAI API (Chutes AI)';
      default:
        return 'Unknown Provider';
    }
  }

  getEndpointUrl(): string {
    const config = ConfigurationManager.getInstance().getConfig();
    switch (this.currentProvider) {
      case 'claude':
        return `${config.apiUrl}/v1/messages`;
      case 'openai':
        return 'https://llm.chutes.ai/v1/chat/completions';
      default:
        return config.apiUrl;
    }
  }

  async chat(
    messages: ClaudeMessage[],
    tools?: ClaudeTool[],
    onStream?: (chunk: string) => void,
    modelId?: string,
    onToolCall?: (toolCall: {id: string, name: string, input: any}) => void,
    onThinking?: (thinking: string) => void
  ): Promise<ClaudeResponse> {
    // Refresh provider from config to ensure we have the latest setting
    this.refreshProviderFromConfig();
    
    const client = this.getCurrentClient();
    
    try {
      console.log(`[ApiProviderManager] Current provider setting: ${this.currentProvider}`);
      console.log(`[ApiProviderManager] Using provider: ${this.getProviderName()}`);
      console.log(`[ApiProviderManager] Endpoint: ${this.getEndpointUrl()}`);
      
      return await client.chat(messages, tools, onStream, modelId, onToolCall, onThinking);
    } catch (error) {
      console.error(`[ApiProviderManager] Error with ${this.getProviderName()}:`, error);
      throw error;
    }
  }

  async sendWithToolResults(
    messages: ClaudeMessage[],
    tools: ClaudeTool[],
    toolResults: ToolResult[],
    onStream?: (chunk: string) => void
  ): Promise<ClaudeResponse> {
    const client = this.getCurrentClient();
    
    try {
      console.log(`[ApiProviderManager] Using provider: ${this.getProviderName()} for tool results`);
      return await client.sendWithToolResults(messages, tools, toolResults, onStream);
    } catch (error) {
      console.error(`[ApiProviderManager] Error with ${this.getProviderName()} for tool results:`, error);
      throw error;
    }
  }

  cancel(): void {
    this.getCurrentClient().cancel();
  }

  private getCurrentClient(): ApiProviderInterface {
    switch (this.currentProvider) {
      case 'claude':
        if (!this.claudeClient) {
          throw new Error('Claude client not initialized');
        }
        return this.claudeClient;
      case 'openai':
        if (!this.openaiClient) {
          throw new Error('OpenAI client not initialized');
        }
        return this.openaiClient;
      default:
        throw new Error(`Unknown provider: ${this.currentProvider}`);
    }
  }

  

  async switchProvider(provider: ApiProvider): Promise<void> {
    if (provider === this.currentProvider) {
      return;
    }

    // Check if the target provider is configured
    const isConfigured = await this.isProviderConfigured(provider);
    if (!isConfigured) {
      throw new Error(`${provider} provider is not configured`);
    }

    this.currentProvider = provider;
    
    // Update configuration
    const config = vscode.workspace.getConfiguration('claude-code');
    await config.update('provider', provider, true);
    
    vscode.window.showInformationMessage(`Switched to ${this.getProviderName()}`);
  }

  private async isProviderConfigured(provider: ApiProvider): Promise<boolean> {
    const config = ConfigurationManager.getInstance();
    
    switch (provider) {
      case 'claude':
        if (!this.context) {
          return false;
        }
        return await config.isConfigured(this.context);
      case 'openai':
        if (!this.openaiClient) {
          return false;
        }
        const openaiKey = await this.openaiClient.getOpenAIApiKey();
        return !!openaiKey;
      default:
        return false;
    }
  }

  getAvailableProviders(): ApiProvider[] {
    return ['claude', 'openai'];
  }

  async getProviderStatus(): Promise<Record<ApiProvider, 'configured' | 'not_configured' | 'error'>> {
    const status: Record<ApiProvider, 'configured' | 'not_configured' | 'error'> = {
      claude: 'not_configured',
      openai: 'not_configured'
    };

    // Check Claude
    try {
      const claudeConfigured = await this.isProviderConfigured('claude');
      status.claude = claudeConfigured ? 'configured' : 'not_configured';
    } catch {
      status.claude = 'error';
    }

    // Check OpenAI
    try {
      const openaiConfigured = await this.isProviderConfigured('openai');
      status.openai = openaiConfigured ? 'configured' : 'not_configured';
    } catch {
      status.openai = 'error';
    }

    return status;
  }
}