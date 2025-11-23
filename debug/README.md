# Chutes API Debug Tools

This folder contains debugging tools for testing the Chutes API with the Kimi-K2-Thinking model.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set your API token as an environment variable:
```bash
# Windows (PowerShell)
$env:CHUTES_API_TOKEN = "your_token_here"

# Windows (Command Prompt)
set CHUTES_API_TOKEN=your_token_here

# Linux/Mac
export CHUTES_API_TOKEN=your_token_here
```

## Usage

### Run the debug script:
```bash
npm run debug
```

### Or compile and run manually:
```bash
npm run build
npm start
```

## What the Debug Script Does

The `debug-chutes-api.ts` script:

1. **Calls the Chutes API** with the Kimi-K2-Thinking model
2. **Handles streaming responses** properly
3. **Detects thinking blocks** in real-time
4. **Analyzes patterns** in the response
5. **Provides detailed output** including:
   - Raw streaming output
   - Separated thinking vs main content
   - Pattern detection for various thinking markers
   - Character counts and statistics

## Expected Output

The script will show:
- 🧠 **THINKING BLOCK START/END** markers when thinking blocks are detected
- 📊 **ANALYSIS** section with content statistics
- 🔍 **PATTERN DETECTION** showing various thinking patterns found
- 💬 **MAIN CONTENT** and 🧠 **THINKING CONTENT** separated

## Debugging Information

This helps us understand:
- The exact format of thinking blocks from Kimi-K2-Thinking
- How thinking content is structured
- What markers/patterns are used
- Whether thinking content is properly separated from main responses

## Troubleshooting

If you get "Cannot find module 'node-fetch'" error:
```bash
npm install
```

If you get "CHUTES_API_TOKEN not set" error:
- Make sure you've set the environment variable correctly
- Check that your token is valid and has proper permissions

If you get HTTP errors:
- Check your internet connection
- Verify the API endpoint is accessible
- Ensure your token has the right permissions for the Kimi-K2-Thinking model