import * as vscode from 'vscode';
import { ClaudeLanguageModelProvider } from './ClaudeLanguageModelProvider';
import { ApiProviderManager } from './ApiProviderManager';
import { ConfigurationManager } from './ConfigurationManager';

let providerRegistration: vscode.Disposable | undefined;
let statusBarItem: vscode.StatusBarItem | undefined;

// Helper function to update status bar
function updateStatusBar(statusBar: vscode.StatusBarItem, providerManager: ApiProviderManager) {
  const providerName = providerManager.getProviderName();
  const providerIcon = providerManager.getCurrentProvider() === 'claude' ? '$(claude)' : '$(robot)';
  statusBar.text = `${providerIcon} ${providerName}`;
  statusBar.tooltip = `${providerName} - Click to configure or switch provider`;
}

export function activate(context: vscode.ExtensionContext) {
  console.log('Claude Code Language Model Provider is now active!');

  // Initialize API provider manager
  const apiProviderManager = ApiProviderManager.getInstance();
  apiProviderManager.initialize(context);

  // Create status bar item
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'claude-code.configure';
  updateStatusBar(statusBarItem, apiProviderManager);
  statusBarItem.show();

  // Check configuration
  const configManager = ConfigurationManager.getInstance();
  configManager.isConfigured(context).then(isConfigured => {
    if (!isConfigured) {
      statusBarItem!.text = '$(claude) Claude Code (Not Configured)';
      vscode.window.showWarningMessage(
        'Claude Code extension is not configured. Please set your API key.',
        'Configure Now'
      ).then(selection => {
        if (selection === 'Configure Now') {
          vscode.commands.executeCommand('claude-code.configure');
        }
      });
    }
  });

  // Register Claude as a Language Model Provider
  const provider = new ClaudeLanguageModelProvider(apiProviderManager);

  providerRegistration = vscode.lm.registerLanguageModelChatProvider(
    'chutes',
    provider
  );

  console.log('Claude Language Model Provider registered with vendor "chutes"');

  // Register commands
  const configureCommand = vscode.commands.registerCommand('claude-code.configure', () => {
    configManager.configureWizard(context);
  });

  const setApiKeyCommand = vscode.commands.registerCommand('claude-code.setApiKey', async () => {
    await configManager.promptForApiKey(context);
    updateStatusBar(statusBarItem!, apiProviderManager);
  });

  const switchProviderCommand = vscode.commands.registerCommand('claude-code.switchProvider', async () => {
    const currentProvider = apiProviderManager.getCurrentProvider();
    const availableProviders = apiProviderManager.getAvailableProviders();
    
    const selection = await vscode.window.showQuickPick(
      availableProviders.map(provider => ({
        label: provider === 'claude' ? '$(claude) Claude API' : '$(robot) OpenAI API (Chutes AI)',
        value: provider,
        description: provider === currentProvider ? 'Current' : undefined
      })),
      {
        placeHolder: 'Select API provider',
        ignoreFocusOut: true
      }
    );

    if (selection && selection.value !== currentProvider) {
      try {
        await apiProviderManager.switchProvider(selection.value);
        updateStatusBar(statusBarItem!, apiProviderManager);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        vscode.window.showErrorMessage(`Failed to switch provider: ${errorMessage}`);
      }
    }
  });

  const setOpenAIApiKeyCommand = vscode.commands.registerCommand('claude-code.setOpenAIApiKey', async () => {
    await configManager.promptForOpenAIApiKey(context);
    updateStatusBar(statusBarItem!, apiProviderManager);
  });

  const showProviderStatusCommand = vscode.commands.registerCommand('claude-code.showProviderStatus', async () => {
    const currentProvider = apiProviderManager.getCurrentProvider();
    const providerName = apiProviderManager.getProviderName();
    const endpoint = apiProviderManager.getEndpointUrl();
    const status = await apiProviderManager.getProviderStatus();
    const config = ConfigurationManager.getInstance().getConfig();

    const message = `
Current Provider: ${providerName} (${currentProvider})
Endpoint: ${endpoint}
Config Setting: ${config.provider}
API URL: ${config.apiUrl}
Provider Status:
- Claude: ${status.claude}
- OpenAI: ${status.openai}
    `.trim();

    console.log('[Extension] Provider Status:', message);
    vscode.window.showInformationMessage(message, { modal: true });
  });

  const debugProviderCommand = vscode.commands.registerCommand('claude-code.debugProvider', async () => {
    const config = ConfigurationManager.getInstance().getConfig();
    console.log('[Debug] Raw config:', config);
    console.log('[Debug] Provider setting:', config.provider);
    console.log('[Debug] API URL:', config.apiUrl);
    console.log('[Debug] Contains chutes.ai:', config.apiUrl?.includes('chutes.ai'));
    
    apiProviderManager.refreshProviderFromConfig();
    console.log('[Debug] Provider after refresh:', apiProviderManager.getCurrentProvider());
    
    vscode.window.showInformationMessage(
      `Debug info logged to console. Provider: ${apiProviderManager.getCurrentProvider()}`,
      'OK'
    );
  });

  // Watch for configuration changes
  const configChangeSubscription = vscode.workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration('claude-code')) {
      console.log('Claude Code configuration changed');
      // Refresh provider from configuration
      apiProviderManager.refreshProviderFromConfig();
      // Update status bar to reflect current provider
      updateStatusBar(statusBarItem!, apiProviderManager);
    }
  });

  // Add all disposables to context
  context.subscriptions.push(
    providerRegistration,
    statusBarItem,
    configureCommand,
    setApiKeyCommand,
    switchProviderCommand,
    setOpenAIApiKeyCommand,
    showProviderStatusCommand,
    debugProviderCommand,
    configChangeSubscription
  );

  console.log('Claude Code Language Model Provider activated successfully!');
}

export function deactivate() {
  console.log('Claude Code Language Model Provider is deactivated');

  // Clean up status bar
  if (statusBarItem) {
    statusBarItem.dispose();
  }

  if (providerRegistration) {
    console.log('Language Model Provider registration disposed');
  }
}
