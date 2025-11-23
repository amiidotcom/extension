import * as vscode from 'vscode';
import { ApiProviderManager } from './ApiProviderManager';
import { ClaudeMessage } from './types';

export class ClaudeLanguageModelProvider implements vscode.LanguageModelChatProvider<vscode.LanguageModelChatInformation> {
  private _onDidChangeLanguageModelChatInformation = new vscode.EventEmitter<void>();
  public readonly onDidChangeLanguageModelChatInformation = this._onDidChangeLanguageModelChatInformation.event;

  private availableModels: vscode.LanguageModelChatInformation[] = [];

  constructor(
    private apiProviderManager: ApiProviderManager
  ) {
    this.initializeModels();
  }

  private initializeModels(): void {
    // Define available models using Anthropic model identifiers
    // The Claude Code proxy will map these to actual models via environment variables:
    // - ANTHROPIC_DEFAULT_SONNET_MODEL: moonshotai/Kimi-K2-Thinking
    // - ANTHROPIC_DEFAULT_OPUS_MODEL: MiniMaxAI/MiniMax-M2
    // - ANTHROPIC_DEFAULT_HAIKU_MODEL: zai-org/GLM-4.6
    this.availableModels = [
      {
        id: 'moonshotai/Kimi-K2-Thinking',
        name: 'moonshotai/Kimi-K2-Thinking',
        family: 'claude-3.5',
        version: '2024-10-22',
        maxInputTokens: 200000,
        maxOutputTokens: 8192,
        capabilities: {
          toolCalling: true,
          imageInput: false
        },
        tooltip: 'Claude 3.5 Sonnet - Advanced reasoning and coding (mapped to moonshotai/Kimi-K2-Thinking)',
        detail: 'by Chutes Ai'
      },
      {
        id: 'zai-org/GLM-4.6',
        name: 'GLM 4.6',
        family: 'zai-org',
        version: '2024-02-29',
        maxInputTokens: 200000,
        maxOutputTokens: 4096,
        capabilities: {
          toolCalling: true,
          imageInput: false
        },
        tooltip: 'Claude 3 Opus - Most capable for complex tasks (mapped to MiniMaxAI/MiniMax-M2)',
        detail: 'by Chutes Ai'
      },
      {
        id: 'Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8',
        name: 'Qwen 3 Coder',
        family: 'qwen',
        version: '2024-03-07',
        maxInputTokens: 200000,
        maxOutputTokens: 4096,
        capabilities: {
          toolCalling: true,
          imageInput: false
        },
        tooltip: 'Claude 3 Haiku - Fast and efficient (mapped to zai-org/GLM-4.6)',
        detail: 'by Chutes Ai'
      }
    ];
  }

  provideLanguageModelChatInformation(
    options: vscode.PrepareLanguageModelChatModelOptions,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.LanguageModelChatInformation[]> {
    // Log for debugging - helps determine if Copilot is requesting models
    console.log('[Claude Provider] provideLanguageModelChatInformation called with options:', options);

    return this.availableModels;
  }

  async provideLanguageModelChatResponse(
    model: vscode.LanguageModelChatInformation,
    messages: readonly vscode.LanguageModelChatRequestMessage[],
    options: vscode.ProvideLanguageModelChatResponseOptions,
    progress: vscode.Progress<vscode.LanguageModelResponsePart>,
    token: vscode.CancellationToken
  ): Promise<void> {
    console.log('[Claude Provider] provideLanguageModelChatResponse called for model:', model.id);
    console.log('[Claude Provider] Messages:', messages.length);
    console.log('[Claude Provider] Options:', options);

    try {
      // Convert VSCode messages to Claude format
      const claudeMessages = this.convertMessages(messages);
      console.log('[Claude Provider] Converted Claude messages:', claudeMessages.length);

      // Tools are handled by VS Code's native tool system
      // We don't need to provide custom tool definitions anymore
      console.log('[Claude Provider] VS Code tools provided:', options.tools?.length || 0);
      
      // Log available VS Code tools for debugging
      if (options.tools && options.tools.length > 0) {
        console.log('[Claude Provider] Available VS Code tools:');
        options.tools.forEach((tool, index) => {
          console.log(`  ${index + 1}. ${tool.name} - ${tool.description || 'No description'}`);
        });
      }

      // Check if the last message contains tool results that need to be processed
      const lastMessage = messages[messages.length - 1];
      const hasToolResults = this.hasToolResults(lastMessage);
      console.log('[Claude Provider] Last message has tool results:', hasToolResults);
      console.log('[Claude Provider] Last message details:', JSON.stringify(lastMessage, null, 2));

      // Call Claude API with the current conversation state
      const claudeResponse = await this.callClaudeApi(
        model.id,
        claudeMessages,
        token,
        progress  // Pass progress for streaming
      );

      if (token.isCancellationRequested) {
        return;
      }

      // Parse and report any tool calls embedded in the response
      const toolCalls = this.parseEmbeddedToolCalls(claudeResponse);
      if (toolCalls.length > 0) {
        console.log('[Claude Provider] Found embedded tool calls:', toolCalls.length);
        
        // Report tool calls to VS Code
        for (const toolCall of toolCalls) {
          // Map the function names to actual VS Code tool names
          const mappedToolName = this.mapToolName(toolCall.name);
          
          // Extract just the numeric ID part for VS Code (e.g., "3" from "functions.list_files:3")
          const vsCodeToolId = toolCall.id.split(':')[1] || toolCall.id;
          
          const toolCallPart = new vscode.LanguageModelToolCallPart(
            vsCodeToolId,
            mappedToolName,
            toolCall.input
          );
          
          console.log('[Claude Provider] About to report tool call to VS Code:', {
            callId: toolCallPart.callId,
            name: toolCallPart.name,
            input: toolCallPart.input
          });
          
          progress.report(toolCallPart);
          console.log('[Claude Provider] Tool call reported to VS Code:', toolCall.name, '→', mappedToolName, 'with VS Code ID:', vsCodeToolId);
        }
        
        // IMPORTANT: When we report tool calls, VS Code will execute them and then call this provider again
        // with the tool results. We should NOT complete the response here. Instead, we should wait
        // for VS Code to call us back with the tool results.
        console.log('[Claude Provider] Tool calls reported, waiting for VS Code to execute and call back...');
        return; // End this response and wait for VS Code to call back with tool results
      }

      console.log('[Claude Provider] Response streaming completed');
      console.log('[Claude Provider] Response content:', claudeResponse.content);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Claude Provider] Error:', errorMessage);
      vscode.window.showErrorMessage(`Claude Provider Error: ${errorMessage}`);
      throw error;
    }
  }

  async provideTokenCount(
    model: vscode.LanguageModelChatInformation,
    text: string | vscode.LanguageModelChatRequestMessage,
    token: vscode.CancellationToken
  ): Promise<number> {
    // Simple token counting - this is a rough estimate
    if (typeof text === 'string') {
      return Math.ceil(text.length / 4); // Rough estimate: 1 token ≈ 4 chars
    } else {
      const content = (text as any).content || '';
      return Math.ceil(content.length / 4);
    }
  }

  private async callClaudeApi(
    modelId: string,
    messages: ClaudeMessage[],
    token: vscode.CancellationToken,
    progress: vscode.Progress<vscode.LanguageModelResponsePart>
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      let fullResponse: any = null;
      let isResolved = false;
      let streamedText = '';

      // Pass the model ID to the API provider manager
      this.apiProviderManager.chat(
        messages,
        undefined, // No tools - using VS Code native tools
        (chunk: string) => {
          // Accumulate streamed text
          streamedText += chunk;
          // Report streaming response to VSCode as LanguageModelTextPart
          progress.report(new vscode.LanguageModelTextPart(chunk));
        },
        modelId,  // <-- This is the new parameter
        // Tool call callback - hide tool calls from user, report to VS Code
        (toolCall: {id: string, name: string, input: any}) => {
          console.log('[Claude Provider] Tool call detected (hidden from user):', toolCall.name);
          
          // Map the function name to actual VS Code tool name
          const mappedToolName = this.mapToolName(toolCall.name);
          
          // Extract just the numeric ID part for VS Code (e.g., "3" from "functions.list_files:3")
          const vsCodeToolId = toolCall.id.split(':')[1] || toolCall.id;
          
          const toolCallPart = new vscode.LanguageModelToolCallPart(
            vsCodeToolId,
            mappedToolName,
            toolCall.input
          );
          
          console.log('[Claude Provider] Reporting tool call to VS Code:', {
            callId: toolCallPart.callId,
            name: toolCallPart.name,
            input: toolCallPart.input
          });
          
          progress.report(toolCallPart);
        }
      ).then((response: any) => {
        if (!isResolved) {
          fullResponse = response;
          isResolved = true;
          
          // Don't report final text again since it was already streamed
          // This prevents duplication
          
          resolve(fullResponse);
        }
      }).catch((error: any) => {
        if (!isResolved) {
          isResolved = true;
          reject(error);
        }
      }).finally(() => {
        if (!isResolved) {
          isResolved = true;
          resolve(fullResponse);
        }
      });

      token.onCancellationRequested(() => {
        if (!isResolved) {
          this.apiProviderManager.cancel();
          isResolved = true;
          reject(new Error('Request cancelled'));
        }
      });
    });
  }

  private hasToolResults(message: vscode.LanguageModelChatRequestMessage): boolean {
    const msgContent = (message as any).content || (message as any).message;
    
    if (Array.isArray(msgContent)) {
      return msgContent.some(part => part instanceof vscode.LanguageModelToolResultPart);
    }
    
    return false;
  }

  private convertMessages(vscodeMessages: readonly vscode.LanguageModelChatRequestMessage[]): ClaudeMessage[] {
    const claudeMessages: ClaudeMessage[] = [];

    // Map numeric roles from VSCode enum to string roles
    // VSCode uses: 1 = User, 2 = Assistant, 3 = System, etc.
    const roleMap: Record<number, string> = {
      1: 'user',
      2: 'assistant',
      3: 'system'
    };

    for (const msg of vscodeMessages) {
      // VSCode LanguageModelChatMessage has different properties
      const rawRole = (msg as any).role || (msg as any).participant;

      // Convert numeric role to string if needed
      let role: string;
      if (typeof rawRole === 'number') {
        role = roleMap[rawRole] || 'user'; // Default to user if unknown
      } else {
        role = rawRole;
      }

      // Extract content - VSCode messages have complex content structure
      let content = '';
      const msgContent = (msg as any).content || (msg as any).message;

      if (typeof msgContent === 'string') {
        content = msgContent;
      } else if (Array.isArray(msgContent)) {
        // Content is an array of parts (text, tool calls, tool results, etc.)
        const processedParts: string[] = [];
        let hasToolCalls = false;
        let hasToolResults = false;
        
        for (const part of msgContent) {
          if (typeof part === 'string') {
            processedParts.push(part);
          } else if (part && typeof part === 'object') {
            // Handle different part types
            if (part.type === 'text') {
              processedParts.push(part.text || '');
            } else if (part instanceof vscode.LanguageModelToolCallPart) {
              // This is a tool call - convert to Claude tool_use format
              hasToolCalls = true;
              const toolCallText = `<tool_use>\n<name>${part.name}</name>\n<input>${JSON.stringify(part.input)}</input>\n</tool_use>`;
              processedParts.push(toolCallText);
            } else if (part instanceof vscode.LanguageModelToolResultPart) {
              // This is a tool result - convert to Claude tool_result format  
              hasToolResults = true;
              // Claude expects tool results in a specific format
              const toolResultContent = typeof part.content === 'string' ? part.content : JSON.stringify(part.content);
              const resultText = `<tool_result>\n<tool_use_id>${part.callId}</tool_use_id>\n<result>${toolResultContent}</result>\n</tool_result>`;
              processedParts.push(resultText);
            } else {
              // Try different possible text field names for other parts
              const text = part.text || part.value || part.content || '';
              if (text) processedParts.push(text);
            }
          }
        }
        
        // For messages with tool calls/results, we need special handling
        if (hasToolCalls || hasToolResults) {
          // Create structured content that Claude can understand
          if (hasToolResults) {
            // This is a user message containing tool results
            role = 'user'; // Tool results always come from user side
          } else if (hasToolCalls) {
            // This is an assistant message containing tool calls
            role = 'assistant';
          }
        }
        
        content = processedParts.join('\n');
        
        // Log the conversion details for debugging
        console.log('[Claude Provider] Message conversion details:', { 
          originalRole: (msg as any).role || (msg as any).participant, 
          finalRole: role, 
          hasToolCalls, 
          hasToolResults,
          contentPreview: content.substring(0, 100) + '...'
        });
      } else if (msgContent && typeof msgContent === 'object') {
        // Single content object - try to extract text
        content = msgContent.text || msgContent.value || msgContent.content || '';
      }

      // Only include user and assistant messages (skip system)
      if ((role === 'user' || role === 'assistant') && content) {
        claudeMessages.push({
          role: role as 'user' | 'assistant',
          content: content
        });
        console.log('[Claude Provider] Converted message:', { role, content: content.substring(0, 100) + '...' });
      } else {
        console.log('[Claude Provider] Skipped message - role:', role, 'has content:', !!content);
      }
    }

    console.log('[Claude Provider] Converted', claudeMessages.length, 'out of', vscodeMessages.length, 'messages');
    return claudeMessages;
  }



  private extractTextContent(response: any): string {
    if (!response.content) {
      return '';
    }

    const textParts = response.content
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text)
      .join('\n');

    return textParts;
  }

  private parseEmbeddedToolCalls(response: any): Array<{id: string, name: string, input: any}> {
    const toolCalls: Array<{id: string, name: string, input: any}> = [];

    if (!response.content) {
      console.log('[Claude Provider] No content in response to parse tool calls');
      return toolCalls;
    }

    // Extract all text content from both text and thinking blocks
    const fullText = response.content
      .filter((c: any) => c.type === 'text' || c.type === 'thinking')
      .map((c: any) => c.text || c.thinking || '')
      .join('');

    console.log('[Claude Provider] Full text for tool call parsing:', fullText.substring(0, 500) + '...');

    // Parse the special tool call format: <|tool_calls_section_begin|>...<|tool_calls_section_end|>
    const toolCallSectionRegex = /<\|tool_calls_section_begin\|>(.*?)<\|tool_calls_section_end\|>/gs;
    let match;

    while ((match = toolCallSectionRegex.exec(fullText)) !== null) {
      const toolCallSection = match[1].trim();
      console.log('[Claude Provider] Found tool call section:', toolCallSection);

      // Parse individual tool calls by finding the boundaries more carefully
      const toolCallStartRegex = /<\|tool_call_begin\|>\s*([^:]+):(\d+)\s*<\|tool_call_argument_begin\|>/g;
      let toolMatch;

      while ((toolMatch = toolCallStartRegex.exec(toolCallSection)) !== null) {
        try {
          const [, name, idStr] = toolMatch;
          const startIndex = toolMatch.index;
          
          // Find the end of this tool call
          const toolCallEndMatch = toolCallSection.indexOf('<|tool_call_end|>', startIndex);
          if (toolCallEndMatch === -1) {
            console.error('[Claude Provider] Tool call end not found for:', name);
            continue;
          }
          
          // Extract the JSON argument (everything between the argument begin and end)
          const argumentStart = startIndex + toolMatch[0].length;
          const argumentEnd = toolCallEndMatch;
          const inputStr = toolCallSection.substring(argumentStart, argumentEnd).trim();
          
          // Try to parse the JSON, if it fails, try to fix common issues
          let input;
          try {
            input = JSON.parse(inputStr);
          } catch (jsonError) {
            console.log('[Claude Provider] JSON parse failed, attempting to fix:', jsonError instanceof Error ? jsonError.message : jsonError);
            // Try to fix truncated JSON by adding missing closing braces/quotes
            const fixedInputStr = this.fixMalformedJson(inputStr);
            input = JSON.parse(fixedInputStr);
          }
          
          toolCalls.push({
            id: `${name}:${idStr}`,
            name: name.trim(),
            input: input
          });

          console.log('[Claude Provider] Parsed tool call:', { name: name.trim(), id: `${name}:${idStr}`, input });
        } catch (error) {
          console.error('[Claude Provider] Failed to parse tool call:', error, 'Tool call text was:', toolMatch[0]);
        }
      }
      
      // If regex parsing failed, try manual parsing as fallback
      if (toolCalls.length === 0) {
        const hasToolCallBegin = toolCallSection.includes('<|tool_call_begin|>');
        const hasToolCallArgumentBegin = toolCallSection.includes('<|tool_call_argument_begin|>');
        const hasToolCallEnd = toolCallSection.includes('<|tool_call_end|>');
        
        if (hasToolCallBegin && hasToolCallArgumentBegin && hasToolCallEnd) {
          console.log('[Claude Provider] Regex parsing failed, trying manual fallback...');
          try {
            // Extract everything between the begin and argument tags
            const nameAndIdPart = toolCallSection
              .split('<|tool_call_begin|>')[1]
              .split('<|tool_call_argument_begin|>')[0]
              .trim();
            
            const nameIdMatch = nameAndIdPart.match(/(.+):(\d+)/);
            if (nameIdMatch) {
              const [, name, idStr] = nameIdMatch;
              
              // Extract the JSON argument
              const jsonPart = toolCallSection
                .split('<|tool_call_argument_begin|>')[1]
                .split('<|tool_call_end|>')[0]
                .trim();
              
              let input;
              try {
                input = JSON.parse(jsonPart);
              } catch (jsonError) {
                const fixedJson = this.fixMalformedJson(jsonPart);
                input = JSON.parse(fixedJson);
              }
              
              toolCalls.push({
                id: `${name}:${idStr}`,
                name: name.trim(),
                input: input
              });
              
              console.log('[Claude Provider] Manual parsing successful:', { name: name.trim(), id: `${name}:${idStr}`, input });
            }
        } catch (error) {
          console.error('[Claude Provider] Manual parsing also failed:', error);
        }
        }
      }
    }

    console.log('[Claude Provider] Total tool calls parsed:', toolCalls.length);
    return toolCalls;
  }

  private mapToolName(functionName: string): string {
    // Map the function names that Claude generates to actual VS Code tool names
    const toolMapping: Record<string, string> = {
      // File operations
      'functions.peek_file_at_path': 'read_file',
      'functions.read_file': 'read_file',
      'functions.create_file': 'create_file',
      'functions.insert_edit_into_file': 'insert_edit_into_file',
      'functions.replace_string_in_file': 'replace_string_in_file',
      'functions.edit_file': 'replace_string_in_file',
      
      // Directory operations
      'functions.list_directory': 'list_dir',
      'functions.list_files': 'file_search',
      'functions.search_files': 'file_search',
      
      // Terminal operations
      'functions.execute_command': 'run_in_terminal',
      'functions.run_command': 'run_in_terminal',
      'functions.terminal': 'run_in_terminal',
      
      // Search operations
      'functions.search_in_file': 'grep_search',
      'functions.search_text': 'grep_search',
      'functions.semantic_search': 'semantic_search',
      
      // Project operations
      'functions.create_directory': 'create_directory',
      'functions.create_folder': 'create_directory',
      
      // Web operations
      'functions.fetch_webpage': 'fetch_webpage',
      'functions.open_browser': 'open_simple_browser',
      
      // VS Code specific operations
      'functions.get_errors': 'get_errors',
      'functions.compile': 'create_and_run_task',
      'functions.run_task': 'create_and_run_task'
    };

    const mappedName = toolMapping[functionName];
    if (mappedName) {
      console.log('[Claude Provider] Mapped tool name:', functionName, '→', mappedName);
      return mappedName;
    }

    // If no mapping found, try to extract a reasonable default
    // Remove 'functions.' prefix and convert to snake_case
    const defaultName = functionName.replace(/^functions\./, '').toLowerCase();
    console.log('[Claude Provider] No mapping found for:', functionName, 'using default:', defaultName);
    
    return defaultName;
  }

  private fixMalformedJson(jsonString: string): string {
    console.log('[Claude Provider] fixMalformedJson called with:', JSON.stringify(jsonString));
    
    // Fix common JSON syntax issues
    let fixed = jsonString.trim();
    
    // Count braces to see if we're missing closing braces
    const openBraces = (fixed.match(/\{/g) || []).length;
    const closeBraces = (fixed.match(/\}/g) || []).length;
    const missingBraces = openBraces - closeBraces;
    
    console.log('[Claude Provider] JSON braces - open:', openBraces, 'close:', closeBraces, 'missing:', missingBraces);
    
    // Add missing closing braces
    for (let i = 0; i < missingBraces; i++) {
      fixed += '}';
    }
    
    // Count quotes to see if we're missing closing quotes
    const quotes = (fixed.match(/"/g) || []).length;
    console.log('[Claude Provider] JSON quotes:', quotes);
    if (quotes % 2 !== 0) {
      // Odd number of quotes means we're missing a closing quote
      fixed += '"';
      console.log('[Claude Provider] Added missing quote');
    }
    
    // Fix truncated content strings by looking for incomplete content
    const contentMatch = fixed.match(/"content":\s*"([^"]*?)$/);
    if (contentMatch) {
      // Content string is not properly closed, close it and escape newlines
      const content = contentMatch[1].replace(/\\n/g, '\\\\n').replace(/"/g, '\\"');
      fixed = fixed.replace(/"content":\s*"[^"]*?$/, `"content": "${content}"`);
    }
    
    // Fix missing quotes around property values (common issue)
    fixed = fixed.replace(/:\s*([^",\{\[\s][^",\{\[\]]*?)\s*([,\}])/g, ': "$1"$2');
    
    console.log('[Claude Provider] Fixed JSON:', JSON.stringify(fixed));
    return fixed;
  }

}
