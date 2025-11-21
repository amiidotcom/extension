# Collapsible Thinking Blocks Feature

This VS Code extension now supports collapsible thinking blocks similar to VS Code's built-in chat interface.

## How It Works

The extension automatically detects structured thinking blocks from the Claude API and converts them into collapsible HTML sections using `<details>` and `<summary>` tags. The thinking content is hidden by default and can be expanded by clicking the header.

## Supported Thinking Patterns

The extension detects these thinking patterns from the API:
- Structured `thinking` content blocks from Claude's streaming API
- Traditional text patterns (fallback):
  - `🤔 Thinking:`
  - `<thinking>`
  - `[THINKING]`
  - `--- Thinking ---`

## Configuration Options

You can configure this feature in your VS Code settings:

### `claude-code.collapsibleThinking`
- **Type**: Boolean
- **Default**: `true`
- **Description**: Enable or disable collapsible thinking blocks

### `claude-code.thinkingPatterns`
- **Type**: Array of strings
- **Default**: `["🤔 Thinking:", "<thinking>", "[THINKING]", "--- Thinking ---"]`
- **Description**: Custom patterns that indicate the start of thinking blocks (fallback)

## Example Usage

When the AI responds with something like:

```
🤔 Thinking: I need to analyze this code and identify the issue.
Let me break down the problem step by step:
1. Check the syntax
2. Look for logical errors
3. Consider edge cases

Response: The issue is in the variable declaration on line 5...
```

It will be displayed as:

<details>
<summary>🤔 <strong>Thinking...</strong> <em>(click to expand)</em></summary>

I need to analyze this code and identify the issue.
Let me break down the problem step by step:
1. Check the syntax
2. Look for logical errors
3. Consider edge cases

</details>

The issue is in the variable declaration on line 5...

## Customization

You can add your own thinking patterns by modifying the `claude-code.thinkingPatterns` setting. For example:

```json
{
  "claude-code.thinkingPatterns": [
    "🤔 Thinking:",
    "<thinking>",
    "[THINKING]",
    "--- Thinking ---",
    "🧠 Analysis:",
    "[INTERNAL]"
  ]
}
```

## Benefits

- **Cleaner Interface**: Thinking content is hidden by default, reducing visual clutter
- **On-Demand Detail**: Users can expand thinking blocks when they want to understand the AI's reasoning
- **Better UX**: Similar to VS Code's native chat experience
- **Configurable**: Can be disabled or customized according to user preferences