# Claude Code for VSCode

A VSCode extension that integrates Claude Code API with full tool access, allowing Claude to read/write files, execute commands, and interact with your workspace through the VSCode chat interface.

## 🚀 Current Status

**Development Phase**: Active Development ✅  
**Last Updated**: November 21, 2025  
**Git Status**: Fresh repository with privacy configurations  

### Recent Progress
- ✅ **Major Refactoring**: Migrated from custom tool execution to VS Code's native language model API
- ✅ **Tool Call Parsing**: Implemented robust parsing for embedded tool calls in Claude's responses
- ✅ **Interactive Flow**: Fixed tool execution flow using VS Code's callback mechanism
- ✅ **Tool Name Mapping**: Created comprehensive mapping between Claude function names and VS Code tools
- ✅ **Privacy Setup**: Configured for private repository with security workflows
- ✅ **Clean Git History**: Fresh repository with proper .gitignore and documentation

### Current Implementation
- Uses VS Code's native `LanguageModelChatProvider` API
- Supports streaming responses with embedded tool call detection
- Handles thinking blocks and complex response formats
- Comprehensive error handling and debugging capabilities
- Tool execution through VS Code's native tool system

## Features

- **Chat Integration**: Chat with Claude directly in VSCode's chat panel
- **Tool Access**: Claude can execute tools to interact with your workspace:
  - **File Operations**: Read, write, edit, search files
  - **Terminal Commands**: Execute shell commands
  - **Git Operations**: Status, commit, push, branch management
  - **VSCode Integration**: Open files, run tasks, get/set selections
- **Streaming Responses**: Real-time streaming of Claude's responses
- **Advanced Tool Call Handling**: Parses embedded tool calls from Claude's responses
- **Native VS Code Integration**: Uses VS Code's built-in language model and tool APIs
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

### Tool Calls Not Executing

**Current Status**: ✅ **RESOLVED** - Tool execution now works with VS Code native API

If you experience issues:
1. Check VSCode Developer Console for tool call parsing logs
2. Verify tool names are properly mapped in `mapToolName()` function
3. Ensure VS Code has the required tools available
4. Check that `claude-code.enableTools: true` in settings

**Recent Fixes Applied**:
- Fixed embedded tool call parsing from response text
- Implemented proper VS Code callback flow
- Added comprehensive tool name mapping
- Enhanced error handling and debugging

### API Errors

- **401 Unauthorized**: Check your API key is correct
- **403 Forbidden**: Verify your API key has access to the model
- **404 Not Found**: Check the API endpoint URL is correct
- **429 Rate Limit**: You've hit rate limits, wait and try again

### Extension Won't Activate

1. Check VSCode version: Must be 1.90.0 or higher
2. Check output panel: Select "Claude Code Extension" from dropdown
3. Restart VSCode
4. Verify the language model provider is registered correctly

### Git Tools Not Working

1. Ensure you have Git installed and in PATH
2. Open a folder with a git repository initialized
3. Check the Git extension is enabled in VSCode

### Debug Information

For debugging tool execution issues:
1. Open VSCode Developer Tools (`Help > Toggle Developer Tools`)
2. Check Console tab for `[Claude Provider]` log messages
3. Look for tool call parsing and execution logs
4. Verify the interactive flow: parse → report → execute → callback

### Known Issues & Solutions

| Issue | Status | Solution |
|-------|--------|----------|
| Tool calls not executing | ✅ Fixed | Implemented proper VS Code callback flow |
| Tool name mismatches | ✅ Fixed | Added comprehensive tool name mapping |
| JSON parsing errors | ✅ Fixed | Added malformed JSON fixing logic |
| Leading whitespace in tool calls | ✅ Fixed | Enhanced regex parsing with trimming |
| Tool calls in thinking blocks | ✅ Fixed | Updated parsing to handle thinking blocks |

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
npm run lint
```

### Current Project Structure

```
src/
├── extension.ts                      # Main extension activation and registration
├── ClaudeLanguageModelProvider.ts    # Core language model provider with VS Code native API
├── ClaudeApiClient.ts                # Claude API client for communication
├── ConfigurationManager.ts           # Settings and configuration management
└── types.ts                          # TypeScript type definitions

# Removed files (migrated to VS Code native tools):
# - ClaudeChatParticipant.ts (replaced by ClaudeLanguageModelProvider)
# - ToolService.ts (now using VS Code native tools)
# - ToolExecutor.ts (now using VS Code native tools)
# - tools/ directory (now using VS Code built-in tools)
```

### Architecture Changes

**Previous Architecture** (Custom Tool System):
- Custom tool execution engine
- Manual tool registration and management
- Complex tool call handling

**Current Architecture** (VS Code Native):
- ✅ Uses VS Code's `LanguageModelChatProvider` API
- ✅ Leverages VS Code's built-in tool system
- ✅ Simplified tool call parsing and execution
- ✅ Better integration with VS Code ecosystem

### Key Implementation Details

#### Tool Call Flow
1. Claude generates responses with embedded tool calls
2. `parseEmbeddedToolCalls()` extracts tool calls from response text
3. Tool names are mapped using `mapToolName()` function
4. Tool calls are reported to VS Code via `progress.report()`
5. VS Code executes tools and calls back with results
6. Provider continues conversation with tool results

#### Tool Name Mapping
The extension includes comprehensive mapping between Claude's function names and VS Code tool names:
- `functions.read_file` → `read_file`
- `functions.execute_command` → `run_in_terminal`
- `functions.search_files` → `file_search`
- And many more...

### Development Notes

- **Tool Execution**: Now handled by VS Code's native tool system
- **Streaming**: Implemented with proper progress reporting
- **Error Handling**: Comprehensive error handling and logging
- **Debugging**: Extensive logging for troubleshooting tool execution
- **Privacy**: Configured for private repository with security workflows

### Adding New Tool Mappings

To add support for new tools:

1. Update the `toolMapping` object in `mapToolName()` method
2. Add the new tool name mapping: `'claude.function.name': 'vscode_tool_name'`
3. Test the tool execution flow
4. Update documentation as needed

## Privacy & Security

⚠️ **Important**: This repository should be kept **PRIVATE** as it may contain:
- API keys and configuration files
- Personal development settings
- Sensitive workspace information

### Privacy Checklist

- [ ] Repository is set to **Private** on GitHub
- [ ] No API keys are committed to the repository
- [ ] Sensitive configuration files are in `.gitignore`
- [ ] Environment variables are used for secrets
- [ ] Code is reviewed before committing

### Making Repository Private on GitHub

1. Go to your repository on GitHub
2. Click **Settings** tab
3. Scroll down to **Danger Zone**
4. Click **Change repository visibility**
5. Select **Make private**
6. Confirm the change

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
