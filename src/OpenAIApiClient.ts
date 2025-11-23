import * as vscode from 'vscode';
import { ClaudeRequest, ClaudeResponse, ClaudeTool, ClaudeMessage, ToolResult } from './types';
import { ConfigurationManager } from './ConfigurationManager';

// OpenAI-compatible API types
export interface OpenAIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | Array<{
    type: 'text' | 'image_url';
    text?: string;
    image_url?: {
      url: string;
    };
  }>;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

export interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

export interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  max_tokens?: number;
  stream?: boolean;
  tools?: OpenAITool[];
  tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  temperature?: number;
  stop?: string[] | string;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
}

export interface OpenAIResponse {
  id: string;
  object: 'chat.completion' | 'chat.completion.chunk';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message?: {
      role: 'assistant';
      content: string | null;
      tool_calls?: OpenAIToolCall[];
    };
    delta?: {
      role?: 'assistant';
      content?: string;
      tool_calls?: OpenAIToolCall[];
    };
    finish_reason?: 'stop' | 'length' | 'tool_calls' | 'content_filter';
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OpenAIApiClient {
  private config = ConfigurationManager.getInstance();
  private abortController?: AbortController;

  constructor(private context: vscode.ExtensionContext) {}

  async chat(
    messages: ClaudeMessage[],
    tools?: ClaudeTool[],
    onStream?: (chunk: string) => void,
    modelId?: string
  ): Promise<ClaudeResponse> {
    const config = this.config.getConfig();
    const apiKey = await this.getOpenAIApiKey();

    if (!apiKey) {
      throw new Error('OpenAI API key not configured. Please run "Configure OpenAI API" command.');
    }

    this.abortController = new AbortController();

    // Use provided modelId or fall back to config
    const model = modelId || config.model;

    // Convert Claude messages to OpenAI format
    const openaiMessages = this.convertMessagesToOpenAI(messages);

    // Convert Claude tools to OpenAI format
    const openaiTools = tools && tools.length > 0 && config.enableTools 
      ? this.convertToolsToOpenAI(tools) 
      : undefined;

    const request: OpenAIRequest = {
      model: model,
      messages: openaiMessages,
      max_tokens: config.maxTokens,
      stream: !!onStream,
      ...(openaiTools && { tools: openaiTools }),
      ...(config.temperature !== undefined && { temperature: config.temperature }),
      ...(config.stopSequences && config.stopSequences.length > 0 && { stop: config.stopSequences }),
      ...(config.topP !== undefined && { top_p: config.topP }),
      ...(config.toolChoice && { tool_choice: this.convertToolChoice(config.toolChoice) })
    };

    try {
      console.log('[OpenAIApiClient] Making request to:', 'https://llm.chutes.ai/v1/chat/completions');
      console.log('[OpenAIApiClient] Model:', model);
      console.log('[OpenAIApiClient] Tools enabled:', !!(openaiTools && openaiTools.length > 0));

      const response = await fetch('https://llm.chutes.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(request),
        signal: this.abortController.signal
      });

      console.log('[OpenAIApiClient] Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Could not read error body');
        console.log('[OpenAIApiClient] Error response body:', errorBody);
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorBody}`);
      }

      if (onStream && response.body) {
        return await this.handleStreamingResponse(response.body, onStream);
      } else {
        const data = await response.json() as OpenAIResponse;
        return this.convertOpenAIResponseToClaude(data);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request cancelled');
      }
      throw error;
    }
  }

  private convertMessagesToOpenAI(claudeMessages: ClaudeMessage[]): OpenAIMessage[] {
    return claudeMessages.map(msg => {
      if (typeof msg.content === 'string') {
        return {
          role: msg.role,
          content: msg.content
        };
      } else {
        // Handle complex content (text, images, tool results, etc.)
        const openaiContent: OpenAIMessage['content'] = [];
        
        for (const item of msg.content) {
          if (item.type === 'text') {
            openaiContent.push({
              type: 'text',
              text: item.text
            });
          } else if (item.type === 'image_url') {
            openaiContent.push({
              type: 'image_url',
              image_url: {
                url: item.url
              }
            });
          } else if (item.type === 'tool_result') {
            // Convert tool result to text for OpenAI
            openaiContent.push({
              type: 'text',
              text: `Tool result for ${item.tool_use_id}: ${item.content}`
            });
          }
        }

        return {
          role: msg.role,
          content: openaiContent
        };
      }
    });
  }

  private convertToolsToOpenAI(claudeTools: ClaudeTool[]): OpenAITool[] {
    return claudeTools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema
      }
    }));
  }

  private convertToolChoice(toolChoice: string): OpenAIRequest['tool_choice'] {
    if (toolChoice === 'auto' || toolChoice === 'none') {
      return toolChoice;
    }
    
    // Handle specific tool choice format
    if (toolChoice.startsWith('{')) {
      try {
        const parsed = JSON.parse(toolChoice);
        if (parsed.type === 'tool' && parsed.name) {
          return {
            type: 'function',
            function: { name: parsed.name }
          };
        }
      } catch {
        // Fall through to default
      }
    }
    
    return 'auto';
  }

  private convertOpenAIResponseToClaude(openaiResponse: OpenAIResponse): ClaudeResponse {
    const choice = openaiResponse.choices[0];
    if (!choice || !choice.message) {
      throw new Error('Invalid OpenAI response format');
    }

    const content: ClaudeResponse['content'] = [];

    // Add text content
    if (choice.message.content) {
      content.push({
        type: 'text',
        text: choice.message.content
      });
    }

    // Add tool calls
    if (choice.message.tool_calls) {
      for (const toolCall of choice.message.tool_calls) {
        try {
          const input = JSON.parse(toolCall.function.arguments);
          content.push({
            type: 'tool_use',
            id: toolCall.id,
            name: toolCall.function.name,
            input: input
          });
        } catch (e) {
          console.error('[OpenAIApiClient] Failed to parse tool arguments:', e);
        }
      }
    }

    return {
      id: openaiResponse.id,
      type: 'message',
      role: 'assistant',
      content: content,
      model: openaiResponse.model,
      stop_reason: this.mapFinishReason(choice.finish_reason),
      stop_sequence: null
    };
  }

  private mapFinishReason(reason?: string): ClaudeResponse['stop_reason'] {
    switch (reason) {
      case 'stop':
        return 'end_turn';
      case 'tool_calls':
        return 'tool_use';
      case 'length':
        return 'max_tokens';
      default:
        return 'end_turn';
    }
  }

  private async handleStreamingResponse(
    body: ReadableStream<Uint8Array>,
    onStream: (chunk: string) => void
  ): Promise<ClaudeResponse> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullResponse: ClaudeResponse | null = null;
    let currentContent = '';
    let currentToolCalls: OpenAIToolCall[] = [];

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const event = JSON.parse(data) as OpenAIResponse;
              const choice = event.choices[0];
              
              if (!choice) continue;

              // Handle text content
              if (choice.delta?.content) {
                currentContent += choice.delta.content;
                onStream(choice.delta.content);
              }

              // Handle tool calls
              if (choice.delta?.tool_calls) {
                for (const deltaToolCall of choice.delta.tool_calls) {
                  let existingCall = currentToolCalls.find(tc => tc.id === deltaToolCall.id);
                  
                  if (!existingCall) {
                    existingCall = {
                      id: deltaToolCall.id || `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                      type: 'function',
                      function: {
                        name: '',
                        arguments: ''
                      }
                    };
                    currentToolCalls.push(existingCall);
                  }

                  if (deltaToolCall.function?.name) {
                    existingCall.function.name += deltaToolCall.function.name;
                  }
                  if (deltaToolCall.function?.arguments) {
                    existingCall.function.arguments += deltaToolCall.function.arguments;
                  }
                }
              }

              // Initialize response on first chunk
              if (!fullResponse) {
                fullResponse = {
                  id: event.id,
                  type: 'message',
                  role: 'assistant',
                  content: [],
                  model: event.model,
                  stop_reason: null as any,
                  stop_sequence: null
                };
              }

              // Update finish reason
              if (choice.finish_reason) {
                fullResponse.stop_reason = this.mapFinishReason(choice.finish_reason);
              }
            } catch (e) {
              console.log('[OpenAIApiClient] Error parsing streaming data:', e);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    if (!fullResponse) {
      throw new Error('No response received from streaming API');
    }

    // Add accumulated text content
    if (currentContent) {
      fullResponse.content.push({
        type: 'text',
        text: currentContent
      });
    }

    // Add completed tool calls
    for (const toolCall of currentToolCalls) {
      if (toolCall.function.name && toolCall.function.arguments) {
        try {
          const input = JSON.parse(toolCall.function.arguments);
          fullResponse.content.push({
            type: 'tool_use',
            id: toolCall.id,
            name: toolCall.function.name,
            input: input
          });
        } catch (e) {
          console.error('[OpenAIApiClient] Failed to parse tool arguments:', e);
        }
      }
    }

    return fullResponse;
  }

  cancel(): void {
    this.abortController?.abort();
  }

  async sendWithToolResults(
    messages: ClaudeMessage[],
    tools: ClaudeTool[],
    toolResults: ToolResult[],
    onStream?: (chunk: string) => void
  ): Promise<ClaudeResponse> {
    // Add tool results to messages
    const messagesWithResults = [...messages];

    if (toolResults.length > 0) {
      for (const result of toolResults) {
        const toolResultMessage: ClaudeMessage = {
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: result.toolUseId,
            content: result.content
          }]
        };
        messagesWithResults.push(toolResultMessage);
      }
    }

    return this.chat(messagesWithResults, tools, onStream);
  }

  async getOpenAIApiKey(): Promise<string | undefined> {
    // Try to get OpenAI-specific key first, then fall back to general key
    const openaiKey = await this.context.secrets.get('openai-api-key');
    if (openaiKey) return openaiKey;
    
    // Fall back to the general API key for backward compatibility
    return await this.config.getApiKey(this.context);
  }

  async storeOpenAIApiKey(context: vscode.ExtensionContext, apiKey: string): Promise<void> {
    await context.secrets.store('openai-api-key', apiKey);
  }
}