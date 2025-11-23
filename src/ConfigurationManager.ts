import * as vscode from 'vscode';
import { ExtensionConfig } from './types';

export class ConfigurationManager {
  private static readonly API_KEY_SECRET_KEY = 'claude-api-key';
  private static readonly instance = new ConfigurationManager();

  private constructor() {}

  static getInstance(): ConfigurationManager {
    return this.instance;
  }

  // Get configuration from VSCode settings
  getConfig(): ExtensionConfig {
    const config = vscode.workspace.getConfiguration('claude-code');
    const defaultSystem = `You are a helpful AI assistant with access to file system and development tools. Use tools when they are necessary to complete the user's request effectively. 

Guidelines for tool usage:
- Use tools to explore the workspace when setting up projects or understanding code structure
- Read files when you need to understand existing code or configuration
- Create/modify files when implementing features requested by the user
- Use development tools (npm, git, etc.) when appropriate for the task
- Always explain what you're doing and why you're using tools

Focus on completing the user's requests efficiently and effectively.`;
    
    return {
      apiUrl: config.get<string>('apiUrl', 'https://claude.monarchrise.dev'),
      model: config.get<string>('model', 'moonshotai/Kimi-K2-Thinking'),
      maxTokens: config.get<number>('maxTokens', 4096),
      enableTools: config.get<boolean>('enableTools', true),
      // Provider configuration
      provider: config.get<'claude' | 'openai'>('provider', 'claude'),
      // Optional parameters
      system: config.get<string>('system', defaultSystem),
      temperature: config.get<number>('temperature', 1.0),
      stopSequences: config.get<string[]>('stopSequences', []),
      topP: config.get<number>('topP', 1.0),
      topK: config.get<number | undefined>('topK', undefined),
      metadataUserId: config.get<string>('metadataUserId', ''),
      toolChoice: config.get<string>('toolChoice', 'auto')
    };
  }

  // Store API key securely
  async storeApiKey(context: vscode.ExtensionContext, apiKey: string): Promise<void> {
    await context.secrets.store(ConfigurationManager.API_KEY_SECRET_KEY, apiKey);
  }

  // Retrieve API key
  async getApiKey(context: vscode.ExtensionContext): Promise<string | undefined> {
    return await context.secrets.get(ConfigurationManager.API_KEY_SECRET_KEY);
  }

  // Delete API key
  async deleteApiKey(context: vscode.ExtensionContext): Promise<void> {
    await context.secrets.delete(ConfigurationManager.API_KEY_SECRET_KEY);
  }

  // Prompt user for API key
  async promptForApiKey(context: vscode.ExtensionContext): Promise<string | undefined> {
    const apiKey = await vscode.window.showInputBox({
      prompt: 'Enter your Claude API Key',
      password: true,
      ignoreFocusOut: true,
      placeHolder: 'cpk_xxxxxx',
      validateInput: (input) => {
        if (!input || input.trim().length === 0) {
          return 'API key cannot be empty';
        }
        if (!input.startsWith('cpk_')) {
          return 'API key should start with "cpk_"';
        }
        return null;
      }
    });

    if (apiKey) {
      await this.storeApiKey(context, apiKey);
      vscode.window.showInformationMessage('API key saved securely!');
    }

    return apiKey;
  }

  // Prompt for proxy URL
  async promptForApiUrl(): Promise<string | undefined> {
    const config = this.getConfig();
    const apiUrl = await vscode.window.showInputBox({
      prompt: 'Enter Claude API Proxy URL',
      ignoreFocusOut: true,
      placeHolder: 'https://claude.monarchrise.dev',
      value: config.apiUrl,
      validateInput: (input) => {
        if (!input || input.trim().length === 0) {
          return 'API URL cannot be empty';
        }
        try {
          new URL(input);
          return null;
        } catch {
          return 'Invalid URL format';
        }
      }
    });

    if (apiUrl) {
      await vscode.workspace.getConfiguration('claude-code').update('apiUrl', apiUrl, true);
    }

    return apiUrl;
  }

  // Check if configuration is complete
  async isConfigured(context: vscode.ExtensionContext): Promise<boolean> {
    const apiKey = await this.getApiKey(context);
    return !!apiKey;
  }

  // OpenAI API key management
  async storeOpenAIApiKey(context: vscode.ExtensionContext, apiKey: string): Promise<void> {
    await context.secrets.store('openai-api-key', apiKey);
  }

  async getOpenAIApiKey(context: vscode.ExtensionContext): Promise<string | undefined> {
    return await context.secrets.get('openai-api-key');
  }

  async deleteOpenAIApiKey(context: vscode.ExtensionContext): Promise<void> {
    await context.secrets.delete('openai-api-key');
  }

  async promptForOpenAIApiKey(context: vscode.ExtensionContext): Promise<string | undefined> {
    const apiKey = await vscode.window.showInputBox({
      prompt: 'Enter your OpenAI API Key (for Chutes AI)',
      password: true,
      ignoreFocusOut: true,
      placeHolder: 'cpk_xxxxxx',
      validateInput: (input) => {
        if (!input || input.trim().length === 0) {
          return 'API key cannot be empty';
        }
        if (!input.startsWith('cpk_')) {
          return 'OpenAI API key should start with "cpk_"';
        }
        return null;
      }
    });

    if (apiKey) {
      await this.storeOpenAIApiKey(context, apiKey);
      vscode.window.showInformationMessage('OpenAI API key saved securely!');
    }

    return apiKey;
  }

  // Provider configuration
  async promptForProvider(): Promise<'claude' | 'openai' | undefined> {
    const selection = await vscode.window.showQuickPick([
      { label: 'Claude API', value: 'claude' as const },
      { label: 'OpenAI API (Chutes AI)', value: 'openai' as const }
    ], {
      placeHolder: 'Select API provider',
      ignoreFocusOut: true
    });

    return selection?.value;
  }

  // Show configuration status
  async showConfigurationStatus(context: vscode.ExtensionContext): Promise<void> {
    const config = this.getConfig();
    const claudeApiKey = await this.getApiKey(context);
    const openaiApiKey = await this.getOpenAIApiKey(context);
    
    const statusMessage = `
Current Configuration:
• Provider: ${config.provider}
• Model: ${config.model}
• API URL: ${config.apiUrl}

API Keys Status:
• Claude API: ${claudeApiKey ? '✅ Configured' : '❌ Not configured'}
• OpenAI API: ${openaiApiKey ? '✅ Configured' : '❌ Not configured'}
    `.trim();

    const action = await vscode.window.showInformationMessage(
      statusMessage,
      'Configure Provider',
      'Set Claude API Key',
      'Set OpenAI API Key',
      'Close'
    );

    switch (action) {
      case 'Configure Provider':
        await this.configureWizard(context);
        break;
      case 'Set Claude API Key':
        await this.promptForApiKey(context);
        break;
      case 'Set OpenAI API Key':
        await this.promptForOpenAIApiKey(context);
        break;
      default:
        break;
    }
  }

  

  // Check if provider has existing API key
  async hasApiKeyForProvider(context: vscode.ExtensionContext, provider: 'claude' | 'openai'): Promise<boolean> {
    if (provider === 'claude') {
      const apiKey = await this.getApiKey(context);
      return !!apiKey;
    } else if (provider === 'openai') {
      const apiKey = await this.getOpenAIApiKey(context);
      return !!apiKey;
    }
    return false;
  }

  // Show configuration wizard
  async configureWizard(context: vscode.ExtensionContext): Promise<void> {
    const currentConfig = this.getConfig();
    const currentProvider = currentConfig.provider;
    
    const provider = await this.promptForProvider();
    if (!provider) {
      vscode.window.showWarningMessage('Configuration cancelled: No provider selected');
      return;
    }

    // Check if we're switching providers
    const isSwitchingProviders = provider !== currentProvider;
    
    // Update provider setting
    await vscode.workspace.getConfiguration('claude-code').update('provider', provider, true);

    // Check if API key already exists for the selected provider
    const hasExistingKey = await this.hasApiKeyForProvider(context, provider);
    
    if (!hasExistingKey) {
      // Only prompt for API key if it doesn't exist for this provider
      if (provider === 'claude') {
        const apiKey = await this.promptForApiKey(context);
        if (!apiKey) {
          vscode.window.showWarningMessage('Configuration cancelled: No API key provided');
          return;
        }
      } else if (provider === 'openai') {
        const apiKey = await this.promptForOpenAIApiKey(context);
        if (!apiKey) {
          vscode.window.showWarningMessage('Configuration cancelled: No API key provided');
          return;
        }
      }
    } else {
      // API key already exists for this provider
      vscode.window.showInformationMessage(`Using existing ${provider === 'claude' ? 'Claude' : 'OpenAI'} API key`);
    }

    // Configure API URL for Claude (OpenAI uses fixed URL)
    if (provider === 'claude') {
      // Only prompt for API URL if it's the first time configuring Claude or if user wants to change it
      if (!hasExistingKey || currentConfig.apiUrl === 'https://claude.monarchrise.dev') {
        const apiUrl = await this.promptForApiUrl();
        if (!apiUrl) {
          vscode.window.showWarningMessage('Configuration cancelled: No API URL provided');
          return;
        }
      }
    }

    const message = isSwitchingProviders 
      ? `Switched to ${provider === 'claude' ? 'Claude' : 'OpenAI'} provider successfully!`
      : 'Claude Code extension configured successfully!';
    
    vscode.window.showInformationMessage(message);
  }
}
