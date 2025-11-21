import * as vscode from 'vscode';
import { ClaudeLanguageModelProvider } from './ClaudeLanguageModelProvider';
import { ClaudeApiClient } from './ClaudeApiClient';
import { ConfigurationManager } from './ConfigurationManager';

let providerRegistration: vscode.Disposable | undefined;
let statusBarItem: vscode.StatusBarItem | undefined;

export function activate(context: vscode.ExtensionContext) {
  console.log('Claude Code Language Model Provider is now active!');

  // Create API client
  const apiClient = new ClaudeApiClient(context);

  // Create status bar item
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'claude-code.configure';
  statusBarItem.text = '$(claude) Claude Code';
  statusBarItem.tooltip = 'Claude Code Extension - Click to configure';
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
  const provider = new ClaudeLanguageModelProvider(apiClient);

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
    statusBarItem!.text = '$(claude) Claude Code';
  });

  // Watch for configuration changes
  const configChangeSubscription = vscode.workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration('claude-code')) {
      console.log('Claude Code configuration changed');
      // Could add logic here to reload models if needed
    }
  });

  // Add all disposables to context
  context.subscriptions.push(
    providerRegistration,
    statusBarItem,
    configureCommand,
    setApiKeyCommand,
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
