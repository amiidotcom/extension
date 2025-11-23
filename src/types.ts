import * as vscode from 'vscode';

// Claude API Types (Native Format)
export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string | any[];
}

export interface ClaudeTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface ToolUse {
  id: string;
  name: string;
  input: Record<string, any>;
}

export interface ToolResult {
  toolUseId: string;
  content: string;
}

export interface ClaudeRequest {
  model: string;
  messages: ClaudeMessage[];
  max_tokens: number;
  tools?: ClaudeTool[];
  stream: boolean;
  // Optional parameters
  system?: string | TextBlockParam[];
  temperature?: number;
  stop_sequences?: string[];
  top_p?: number;
  top_k?: number;
  metadata?: Metadata;
  tool_choice?: ToolChoice;
}

// Supporting types for optional parameters
export interface TextBlockParam {
  type: 'text';
  text: string;
}

export interface Metadata {
  user_id?: string;
}

export type ToolChoice = 'auto' | 'any' | { type: 'tool'; name: string };

export interface ClaudeResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: Array<
    | { type: 'text'; text: string }
    | { type: 'tool_use'; id: string; name: string; input: Record<string, any> }
    | { type: 'thinking'; thinking: string }
  >;
  model: string;
  stop_reason: 'end_turn' | 'tool_use' | 'max_tokens';
  stop_sequence: null | string;
}

// Tool Definition Types
export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      items?: any;
    }>;
    required?: string[];
  };
}

export interface ToolExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  tool_use_id: string;
}

// Extension Configuration
export interface ExtensionConfig {
  apiUrl: string;
  model: string;
  maxTokens: number;
  enableTools: boolean;
  apiKey?: string;
  // Provider configuration
  provider?: 'claude' | 'openai';
  // Optional parameters
  system?: string;
  temperature?: number;
  stopSequences?: string[];
  topP?: number;
  topK?: number;
  metadataUserId?: string;
  toolChoice?: string;
}

// Tool Implementations
export interface ToolImplementation {
  definition: ToolDefinition;
  execute: (input: any) => Promise<any>;
}

// VSCode API Tool Context
export interface ToolContext {
  workspaceRoot?: string;
  activeFile?: string;
  selection?: vscode.Selection;
}
