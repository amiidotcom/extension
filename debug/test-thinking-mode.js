#!/usr/bin/env node

// Simple test to verify thinking mode separation is working
const { OpenAIApiClient } = require('../out/OpenAIApiClient');

async function testThinkingMode() {
    console.log('🧠 Testing thinking mode separation...');
    
    const client = new OpenAIApiClient('https://llm.chutes.ai/v1', 'cpk_a522f4893d9a49eeb3af7e4adae5ac68.8b3a69700e9350ecb930061a6081e37f.5LSsDNmmXNaVp0H5qDdNAiH9iAcrASwG');
    
    const messages = [
        {
            role: 'user',
            content: 'Tell me a 100 word story about a lighthouse.'
        }
    ];
    
    try {
        console.log('📤 Sending request to Kimi-K2-Thinking model...');
        
        const response = await client.send(messages, [], {
            model: 'moonshotai/Kimi-K2-Thinking',
            max_tokens: 1024,
            temperature: 0.7,
            stream: false
        });
        
        console.log('📥 Response received!');
        console.log('='.repeat(60));
        
        // Analyze the response content
        const fullText = response.content.map(c => c.text).join('');
        console.log('Full response text:');
        console.log(fullText);
        console.log('='.repeat(60));
        
        // Check if thinking content is properly separated
        const hasThinkingMarkers = fullText.includes('🤔');
        const thinkingParts = fullText.match(/🤔\n([\s\S]*?)\n🤔/g);
        
        console.log('\n🔍 Analysis:');
        console.log(`Has thinking markers: ${hasThinkingMarkers ? '✅ Yes' : '❌ No'}`);
        
        if (thinkingParts) {
            console.log(`Found ${thinkingParts.length} thinking block(s)`);
            thinkingParts.forEach((block, index) => {
                const thinkingContent = block.replace(/🤔\n/g, '').replace(/\n🤔/g, '');
                console.log(`\nThinking Block ${index + 1}:`);
                console.log(`Length: ${thinkingContent.length} characters`);
                console.log(`Preview: ${thinkingContent.substring(0, 100)}...`);
            });
        }
        
        // Extract main content (outside thinking blocks)
        const mainContent = fullText.replace(/🤔\n[\s\S]*?\n🤔\n\n/g, '');
        console.log(`\nMain content length: ${mainContent.length} characters`);
        console.log(`Main content preview: ${mainContent.substring(0, 200)}...`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testThinkingMode();