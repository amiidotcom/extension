import * as vscode from 'vscode';
import { ClaudeLanguageModelProvider } from './ClaudeLanguageModelProvider';
import { ApiProviderManager } from './ApiProviderManager';
import { ConfigurationManager } from './ConfigurationManager';
import { QuotaService } from './QuotaService';

let providerRegistration: vscode.Disposable | undefined;
let statusBarItem: vscode.StatusBarItem | undefined;
let quotaService: QuotaService;

// Helper function to update status bar
function updateStatusBar(statusBar: vscode.StatusBarItem, providerManager: ApiProviderManager, showQuota: boolean = true) {
  const providerName = providerManager.getProviderName();
  const currentProvider = providerManager.getCurrentProvider();
  // Using a more appropriate icon for the extension
  const providerIcon = currentProvider === 'claude' ? '$(sparkle)' : '$(robot)';
  
  let statusText = `${providerIcon} ${providerName}`;
  let tooltipText = `${providerName} - Click to configure or switch provider`;
  
  // Add quota information if available and requested
  if (showQuota && quotaService) {
    const quotaDisplay = quotaService.getQuotaDisplayString(currentProvider);
    const quotaTooltip = quotaService.getQuotaTooltip(currentProvider);
    
    statusText += ` ${quotaDisplay}`;
    tooltipText += '\n\n' + quotaTooltip;
  }
  
  statusBar.text = statusText;
  statusBar.tooltip = tooltipText;
}

export function activate(context: vscode.ExtensionContext) {
  console.log('Chutes Code Language Model Provider is now active!');

  // Initialize API provider manager
  const apiProviderManager = ApiProviderManager.getInstance();
  apiProviderManager.initialize(context);

  // Initialize quota service
  quotaService = QuotaService.getInstance();

  // Create status bar item
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'claude-code.configure';
  updateStatusBar(statusBarItem, apiProviderManager);
  statusBarItem.show();

  // Check configuration and start quota monitoring
  const configManager = ConfigurationManager.getInstance();
  configManager.isConfigured(context).then(isConfigured => {
    if (!isConfigured) {
      statusBarItem!.text = '$(sparkle) Chutes Code (Not Configured)';
      vscode.window.showWarningMessage(
        'Chutes Code extension is not configured. Please set your API key.',
        'Configure Now'
      ).then(selection => {
        if (selection === 'Configure Now') {
          vscode.commands.executeCommand('claude-code.configure');
        }
      });
    } else {
      // Start quota monitoring for the current provider
      const currentProvider = apiProviderManager.getCurrentProvider();
      quotaService.startAutoUpdate(context, currentProvider);
      
      // Initial status bar update with quota
      updateStatusBar(statusBarItem!, apiProviderManager);
    }
  });

  // Register Claude as a Language Model Provider
  const provider = new ClaudeLanguageModelProvider(apiProviderManager, context);

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
        label: provider === 'claude' ? '$(claude) Claude API (Chutes AI)' : '$(robot) OpenAI API (Chutes AI)',
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
        
        // Stop quota monitoring for old provider and start for new provider
        quotaService.stopAutoUpdate();
        quotaService.startAutoUpdate(context, selection.value);
        
        // Also fetch quota immediately for the new provider
        await quotaService.refreshQuota(context, selection.value);
        
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

  const showConfigurationStatusCommand = vscode.commands.registerCommand('claude-code.showConfigurationStatus', async () => {
    await configManager.showConfigurationStatus(context);
  });

  const refreshQuotaCommand = vscode.commands.registerCommand('claude-code.refreshQuota', async () => {
    const currentProvider = apiProviderManager.getCurrentProvider();
    await quotaService.refreshQuota(context, currentProvider);
    updateStatusBar(statusBarItem!, apiProviderManager);
    vscode.window.showInformationMessage(`Quota refreshed for ${currentProvider}`);
  });

  const toggleQuotaDisplayCommand = vscode.commands.registerCommand('claude-code.toggleQuotaDisplay', async () => {
    // This could be used to show/hide quota in status bar if needed
    updateStatusBar(statusBarItem!, apiProviderManager);
  });

  // Watch for configuration changes
  const configChangeSubscription = vscode.workspace.onDidChangeConfiguration(async e => {
    if (e.affectsConfiguration('claude-code')) {
      console.log('Chutes Code configuration changed');
      // Refresh provider from configuration
      apiProviderManager.refreshProviderFromConfig();
      
      // Restart quota monitoring with new provider
      const currentProvider = apiProviderManager.getCurrentProvider();
      quotaService.stopAutoUpdate();
      quotaService.startAutoUpdate(context, currentProvider);
      
      // Also fetch quota immediately
      await quotaService.refreshQuota(context, currentProvider);
      
      // Update status bar to reflect current provider and quota
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
    showConfigurationStatusCommand,
    refreshQuotaCommand,
    toggleQuotaDisplayCommand,
    configChangeSubscription
  );

  console.log('Chutes Code Language Model Provider activated successfully!');
}

export function deactivate() {
  console.log('Chutes Code Language Model Provider is deactivated');

  // Clean up quota service
  if (quotaService) {
    quotaService.stopAutoUpdate();
  }

  // Clean up status bar
  if (statusBarItem) {
    statusBarItem.dispose();
  }

  if (providerRegistration) {
    console.log('Language Model Provider registration disposed');
  }
}
