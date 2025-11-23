import * as vscode from 'vscode';
import { ClaudeRequest, ClaudeResponse, ClaudeTool, ClaudeMessage, ToolResult } from './types';
import { ConfigurationManager } from './ConfigurationManager';

export class ClaudeApiClient {
  private config = ConfigurationManager.getInstance();
  private abortController?: AbortController;

  constructor(private context: vscode.ExtensionContext) {}

  async chat(
    messages: ClaudeMessage[],
    tools?: ClaudeTool[],
    onStream?: (chunk: string) => void,
    modelId?: string  // Optional model ID to override config
  ): Promise<ClaudeResponse> {
    const config = this.config.getConfig();
    const apiKey = await this.config.getApiKey(this.context);

    if (!apiKey) {
      throw new Error('API key not configured. Please run "Configure Claude Code Extension" command.');
    }

    this.abortController = new AbortController();

    // Use provided modelId or fall back to config
    const model = modelId || config.model;

    //console.log('[ClaudeApiClient] Using model:', model);

    // Validate messages array
    if (!messages || messages.length === 0) {
      throw new Error('No messages to send to API. Messages array is empty.');
    }

    const request: ClaudeRequest = {
      model: model,
      messages,
      max_tokens: config.maxTokens,
      stream: !!onStream,
      ...(tools && tools.length > 0 && config.enableTools ? { tools } : {}),
      // Optional parameters
      ...(config.system ? { system: config.system } : {}),
      ...(config.temperature !== undefined ? { temperature: config.temperature } : {}),
      ...(config.stopSequences && config.stopSequences.length > 0 ? { stop_sequences: config.stopSequences } : {}),
      ...(config.topP !== undefined ? { top_p: config.topP } : {}),
      ...(config.topK !== undefined && config.topK > 0 ? { top_k: config.topK } : {}),  // Only send if valid (> 0)
      ...(config.metadataUserId ? { metadata: { user_id: config.metadataUserId } } : {}),
      ...(config.toolChoice ? { tool_choice: config.toolChoice as any } : {})
    };

    try {
      //console.log('[ClaudeApiClient] Making request to:', `${config.apiUrl}/v1/messages`);
      //console.log('[ClaudeApiClient] API Key starts with:', apiKey.substring(0, 8) + '...');
      console.log('[ClaudeApiClient] Model:', model);
      //console.log('[ClaudeApiClient] Tools enabled:', config.enableTools && tools && tools.length > 0);
      //console.log('[ClaudeApiClient] Request body:', JSON.stringify(request, null, 2));

      const response = await fetch(`${config.apiUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(request)
      });

      //console.log('[ClaudeApiClient] Response status:', response.status, response.statusText);

      // If we get a 400 error and tools were included, retry without tools
      if (response.status === 400 && tools && tools.length > 0 && config.enableTools) {
        console.log('[ClaudeApiClient] Got 400 error with tools. Retrying without tools...');
        const requestWithoutTools = {
          model: model,
          messages,
          max_tokens: config.maxTokens,
          stream: !!onStream,
          // Optional parameters (without tools)
          ...(config.system ? { system: config.system } : {}),
          ...(config.temperature !== undefined ? { temperature: config.temperature } : {}),
          ...(config.stopSequences && config.stopSequences.length > 0 ? { stop_sequences: config.stopSequences } : {}),
          ...(config.topP !== undefined ? { top_p: config.topP } : {}),
          ...(config.topK !== undefined && config.topK > 0 ? { top_k: config.topK } : {}),  // Only send if valid (> 0)
          ...(config.metadataUserId ? { metadata: { user_id: config.metadataUserId } } : {}),
          ...(config.toolChoice ? { tool_choice: config.toolChoice as any } : {})
        };

       // console.log('[ClaudeApiClient] Retry request body:', JSON.stringify(requestWithoutTools, null, 2));

        const retryResponse = await fetch(`${config.apiUrl}/v1/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify(requestWithoutTools)
        });

       // console.log('[ClaudeApiClient] Retry response status:', retryResponse.status, retryResponse.statusText);

        if (!retryResponse.ok) {
          const errorBody = await retryResponse.text().catch(() => 'Could not read error body');
          console.log('[ClaudeApiClient] Retry error response body:', errorBody);
          throw new Error(`API error: ${retryResponse.status} ${retryResponse.statusText} - ${errorBody}`);
        }

        if (onStream && retryResponse.body) {
          return await this.handleStreamingResponse(retryResponse.body, onStream);
        } else {
          const data = await retryResponse.json();
          return data as ClaudeResponse;
        }
      }

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Could not read error body');
        console.log('[ClaudeApiClient] Error response body:', errorBody);
        throw new Error(`API error: ${response.status} ${response.statusText} - ${errorBody}`);
      }

      if (onStream && response.body) {
        return await this.handleStreamingResponse(response.body, onStream);
      } else {
        const data = await response.json();
        return data as ClaudeResponse;
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request cancelled');
      }
      throw error;
    }
  }

  private async handleStreamingResponse(
    body: ReadableStream<Uint8Array>,
    onStream: (chunk: string) => void
  ): Promise<ClaudeResponse> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let fullResponse: ClaudeResponse | null = null;
    let contentBlocks: Map<number, { type: string; text: string; toolUse?: any; jsonBuffer?: string }> = new Map();
    let buffer = '';
    let hasShownThinking = false;

    //console.log('[ClaudeApiClient] Starting to handle streaming response...');

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          //console.log('[ClaudeApiClient] Stream reading completed');
          break;
        }

        const chunk = decoder.decode(value);
        //console.log('[ClaudeApiClient] Received chunk:', chunk.substring(0, 200));
        
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep the last incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
           // console.log('[ClaudeApiClient] Processing data line:', data.substring(0, 100));

            if (data === '[DONE]') {
              //console.log('[ClaudeApiClient] Received [DONE] signal');
              continue;
            }

            try {
              const event = JSON.parse(data);
              console.log('[ClaudeApiClient] Parsed event:', JSON.stringify(event).substring(0, 150));

              if (event.type === 'content_block_delta') {
                const blockIndex = event.index;
                const currentBlock = contentBlocks.get(blockIndex);
                
                if (event.delta?.text) {
                 // console.log('[ClaudeApiClient] Streaming text chunk:', event.delta.text);
                  // Accumulate to content block
                  if (currentBlock) {
                    currentBlock.text += event.delta.text;
                  }
                  // Stream text content
                  if (currentBlock && currentBlock.type === 'text') {
                    onStream(event.delta.text);
                  }
                } else if (event.delta?.thinking) {
                  // Handle thinking delta - show it in the response
                  if (currentBlock && currentBlock.type === 'thinking') {
                    currentBlock.text += event.delta.thinking;
                    
                    // Show thinking blocks with a marker to distinguish from regular text
                    if (!hasShownThinking) {
                      onStream("\n🤔 **Thinking:**\n");
                      hasShownThinking = true;
                    }
                    onStream(event.delta.thinking);
                  }
                } else if (event.delta?.partial_json && currentBlock?.type === 'tool_use') {
                  // Handle tool use input JSON delta
                  console.log('[ClaudeApiClient] Tool use JSON delta:', event.delta.partial_json);
                  if (currentBlock.jsonBuffer !== undefined) {
                    currentBlock.jsonBuffer += event.delta.partial_json;
                  }
                }
              } else if (event.type === 'message_start') {
                console.log('[ClaudeApiClient] Message started');
                fullResponse = {
                  id: event.message.id,
                  type: 'message',
                  role: 'assistant',
                  content: [],
                  model: event.message.model,
                  stop_reason: null as any,
                  stop_sequence: null
                };
                console.log('[ClaudeApiClient] Initialized response:', fullResponse);
              } else if (event.type === 'content_block_start') {
                console.log('[ClaudeApiClient] Content block started:', event.content_block?.type, 'index:', event.index);
                // Start a new content block
                if (event.content_block?.type === 'text') {
                  contentBlocks.set(event.index, {
                    type: 'text',
                    text: ''
                  });
                  // Reset thinking flag when starting a new text block
                  if (hasShownThinking) {
                    onStream("\n\n**Response:**\n");
                    hasShownThinking = false;
                  }
                } else if (event.content_block?.type === 'thinking') {
                  // For thinking blocks, initialize
                  contentBlocks.set(event.index, {
                    type: 'thinking',
                    text: ''
                  });
                } else if (event.content_block?.type === 'tool_use') {
                  // For tool use blocks, initialize with tool data
                  contentBlocks.set(event.index, {
                    type: 'tool_use',
                    text: '',
                    toolUse: {
                      id: event.content_block.id,
                      name: event.content_block.name,
                      input: {}
                    },
                    jsonBuffer: ''
                  });
                  console.log('[ClaudeApiClient] Tool use block started:', event.content_block.name);
                }
              } else if (event.type === 'content_block_stop') {
                console.log('[ClaudeApiClient] Content block stopped for index:', event.index);
                const currentBlock = contentBlocks.get(event.index);
                console.log('[ClaudeApiClient] Current content block type:', currentBlock?.type);
                // Add completed content block to response
                if (fullResponse && currentBlock) {
                  if (currentBlock.type === 'text') {
                    fullResponse.content.push({
                      type: 'text',
                      text: currentBlock.text
                    });
                    console.log('[ClaudeApiClient] Added text block to response');
                  } else if (currentBlock.type === 'tool_use' && currentBlock.toolUse) {
                    console.log('[ClaudeApiClient] Processing tool use block:', currentBlock.toolUse.name);
                    console.log('[ClaudeApiClient] JSON buffer:', currentBlock.jsonBuffer);
                    // Parse the accumulated JSON for tool input
                    if (currentBlock.jsonBuffer) {
                      try {
                        currentBlock.toolUse.input = JSON.parse(currentBlock.jsonBuffer);
                        console.log('[ClaudeApiClient] Parsed tool input:', currentBlock.toolUse.input);
                      } catch (e) {
                        console.log('[ClaudeApiClient] Failed to parse tool input JSON:', e);
                        // Use empty object as fallback
                        currentBlock.toolUse.input = {};
                      }
                    }
                    
                    // Add tool use block to response
                    fullResponse.content.push({
                      type: 'tool_use',
                      id: currentBlock.toolUse.id,
                      name: currentBlock.toolUse.name,
                      input: currentBlock.toolUse.input
                    });
                    console.log('[ClaudeApiClient] Added tool use to response:', currentBlock.toolUse.name);
                  } else {
                    console.log('[ClaudeApiClient] Unknown content block type:', currentBlock.type);
                  }
                  // Remove the block from the map since it's processed
                  contentBlocks.delete(event.index);
                } else {
                  console.log('[ClaudeApiClient] No fullResponse or currentBlock for index:', event.index);
                }
              } else if (event.type === 'message_delta') {
                console.log('[ClaudeApiClient] Message delta:', event.delta);
                if (fullResponse) {
                  fullResponse.stop_reason = event.delta.stop_reason;
                  fullResponse.stop_sequence = event.delta.stop_sequence;
                }
              }
            } catch (e) {
              console.log('[ClaudeApiClient] Error parsing event data:', e, 'data:', data);
              // Ignore parsing errors for incomplete chunks
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    console.log('[ClaudeApiClient] Stream processing complete. Full response:', fullResponse);

    if (!fullResponse) {
      throw new Error('No response received from streaming API');
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
      const toolResultContent = {
        role: 'user' as const,
        content: toolResults.map(result => ({
          type: 'tool_result' as const,
          tool_use_id: result.toolUseId,
          content: result.content
        }))
      };
      messagesWithResults.push(toolResultContent as any);
    }

    return this.chat(messagesWithResults, tools, onStream);
  }
}
