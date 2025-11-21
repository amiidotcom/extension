# Claude Code for VSCode

A VSCode extension that integrates Claude Code API with full tool access, allowing Claude to read/write files, execute commands, and interact with your workspace through the VSCode chat interface.

## Features

- **Chat Integration**: Chat with Claude directly in VSCode's chat panel
- **Tool Access**: Claude can execute tools to interact with your workspace:
  - **File Operations**: Read, write, edit, search files
  - **Terminal Commands**: Execute shell commands
  - **Git Operations**: Status, commit, push, branch management
  - **VSCode Integration**: Open files, run tasks, get/set selections
- **Streaming Responses**: Real-time streaming of Claude's responses
- **Slash Commands**:
  - `/explain` - Explain selected code
  - `/fix` - Fix issues in selected code
  - `/refactor` - Refactor selected code
- **Secure API Key Storage**: API keys stored in VSCode's secure secret storage
- **Configurable**: Custom API endpoints and model selection

## Requirements

- VSCode 1.90.0 or higher
- GitHub Copilot Chat extension (for the chat interface)
- Claude API key or proxy with Claude Code compatible API

## Installation

### From Source

1. Clone or download this repository
2. Run `npm install` to install dependencies
3. Run `npm run compile` to compile TypeScript
4. Open the project in VSCode
5. Press F5 to launch a new VSCode window with the extension loaded

### Packaging for Distribution

```bash
npm install
npm run compile
# Use vsce to package
npx vsce package
```

## Setup

### 1. Initial Configuration

When you first activate the extension, you'll be prompted to configure it. You can also run:

- `Claude Code: Configure Claude Code Extension` - Full configuration wizard
- `Claude Code: Set Claude API Key` - Set API key only

### 2. Configuration Options

Configure via VSCode Settings (`Settings > Claude Code`):

- **`claude-code.apiUrl`**: Claude API proxy URL (default: `https://api.anthropic.com/v1`)
- **`claude-code.model`**: Model to use (default: `claude-3-5-sonnet-latest`)
- **`claude-code.maxTokens`**: Maximum tokens in responses (default: `4096`)
- **`claude-code.enableTools`**: Enable VSCode tool execution (default: `true`)

### 3. API Key Setup

Your API key is stored securely in VSCode's secret storage. Supported formats:

- **Direct Anthropic API**: Get from [Anthropic Console](https://console.anthropic.com/)
- **Claude Code Proxy**: Compatible proxy with Anthropic API format
- **AWS Bedrock**: If using AWS Bedrock with Claude

## Usage

### Starting a Chat

1. Open the VSCode Chat panel (`Ctrl+Shift+I` or `Cmd+Shift+I` on Mac)
2. Type `@claude` followed by your question or request
3. Or use the default chat with `/claude` command

### Examples

#### Basic Chat
```
@claude How do I create a React component in TypeScript?
```

#### With File Context
```
@claude Read the file app.ts and explain what it does
```

#### Code Explanation
1. Select code in the editor
2. Type:
```
@claude /explain Explain this code
```

#### Code Fix
1. Select code with errors
2. Type:
```
@claude /fix Fix any errors in this code
```

#### Using Tools
```
@claude Read package.json, then run npm install to install dependencies
```

## Available Tools

### File Operations (`file_operations`)

- **read**: Read a file
  ```json
  {"operation": "read", "path": "src/index.ts"}
  ```

- **write**: Write or overwrite a file
  ```json
  {"operation": "write", "path": "src/new.ts", "content": "// code here"}
  ```

- **edit**: Edit specific lines in a file
  ```json
  {"operation": "edit", "path": "src/index.ts", "start_line": 10, "end_line": 15, "new_content": "// new code"}
  ```

- **glob**: Find files by pattern
  ```json
  {"operation": "glob", "pattern": "**/*.ts"}
  ```

- **grep**: Search for text in files
  ```json
  {"operation": "grep", "pattern": "**/*.ts", "search": "function"}
  ```

### Terminal (`terminal`)

Execute commands in the terminal:
```json
{"command": "npm install", "working_directory": "."}
```

### Git Operations (`git`)

- **status**: Get git status
  ```json
  {"operation": "status"}
  ```

- **add**: Stage files
  ```json
  {"operation": "add", "files": ["src/index.ts"]}
  ```

- **commit**: Commit changes
  ```json
  {"operation": "commit", "message": "Your commit message"}
  ```

- **push**: Push to remote
  ```json
  {"operation": "push"}
  ```

- **branch**: Create/switch branch
  ```json
  {"operation": "branch", "branch_name": "feature/new-feature"}
  ```

### VSCode Integration (`vscode`)

- **open_file**: Open a file in editor
  ```json
  {"operation": "open_file", "file_path": "src/index.ts"}
  ```

- **run_task**: Run a VSCode task
  ```json
  {"operation": "run_task", "task_name": "build"}
  ```

- **get_selection**: Get current selection
  ```json
  {"operation": "get_selection"}
  ```

- **set_selection**: Set selection text
  ```json
  {"operation": "set_selection", "text": "new text"}
  ```

- **show_information_message**: Show info message
  ```json
  {"operation": "show_information_message", "message": "Hello!"}
  ```

## Security Considerations

⚠️ **Important**: This extension allows Claude to execute commands and modify files on your system.

### Safety Features

- **Tool Permissions**: All tools can be disabled via `claude-code.enableTools` setting
- **Path Validation**: File operations are restricted to the workspace
- **Confirmation**: No actions are taken without your explicit request
- **API Key Security**: Keys stored in VSCode secure storage, not in plain text

### Best Practices

1. **Review Tool Usage**: Always review what tools Claude is executing
2. **Use Version Control**: Ensure your code is in git before allowing modifications
3. **Check API Endpoint**: Verify your API endpoint is correct and trusted
4. **Restrict Tools**: Disable tools you don't need via settings
5. **Monitor Execution**: Pay attention to the status bar showing tool execution

## Troubleshooting

### "API key not configured" Error

Run the configuration wizard:
- Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
- Type "Configure Claude Code Extension"
- Enter your API key when prompted

### Tools Not Working

1. Check that tools are enabled: `claude-code.enableTools: true`
2. Ensure you have a workspace folder open (not just individual files)
3. Verify the tool names in the API response match registered tools

### API Errors

- **401 Unauthorized**: Check your API key is correct
- **403 Forbidden**: Verify your API key has access to the model
- **404 Not Found**: Check the API endpoint URL is correct
- **429 Rate Limit**: You've hit rate limits, wait and try again

### Extension Won't Activate

1. Check VSCode version: Must be 1.90.0 or higher
2. Check output panel: Select "Claude Code Extension" from dropdown
3. Restart VSCode

### Git Tools Not Working

1. Ensure you have Git installed and in PATH
2. Open a folder with a git repository initialized
3. Check the Git extension is enabled in VSCode

## Development

### Building

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch mode for development
npm run watch

# Lint
pm run lint
```

### Project Structure

```
src/
├── extension.ts              # Main extension activation
├── ClaudeChatParticipant.ts  # Chat handler with tool loop
├── ClaudeApiClient.ts        # Claude API client
├── ConfigurationManager.ts   # Settings management
├── ToolService.ts            # Tool registry
├── ToolExecutor.ts           # Tool execution engine
├── types.ts                  # TypeScript types
└── tools/                    # Tool implementations
    ├── FileTools.ts
    ├── TerminalTools.ts
    ├── GitTools.ts
    └── VSCodeTools.ts
```

### Adding New Tools

1. Create a new tool class implementing `ToolImplementation`
2. Register it in `ToolService.ts`
3. Add input validation and execution logic
4. Update this README documentation

## License

MIT License - see LICENSE file for details

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Submit a pull request with detailed description

## Support

For issues and feature requests, please use the GitHub issue tracker.

---

**Disclaimer**: This extension is not affiliated with Anthropic. Claude is a product of Anthropic PBC.
