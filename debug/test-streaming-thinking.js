#!/usr/bin/env node

const fetch = require('node-fetch');

const CHUTES_API_TOKEN = 'cpk_a522f4893d9a49eeb3af7e4adae5ac68.8b3a69700e9350ecb930061a6081e37f.5LSsDNmmXNaVp0H5qDdNAiH9iAcrASwG';

async function testStreamingThinking() {
    console.log('🧠 Testing thinking mode separation in streaming...');
    
    try {
        const response = await fetch("https://llm.chutes.ai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${CHUTES_API_TOKEN}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "model": "moonshotai/Kimi-K2-Thinking",
                "messages": [
                    {
                        "role": "user",
                        "content": "Tell me a short story about a robot discovering music."
                    }
                ],
                "stream": true,
                "max_tokens": 500,
                "temperature": 0.7
            })
        });

        if (!response.ok) {
            console.error(`❌ HTTP Error: ${response.status} ${response.statusText}`);
            return;
        }

        console.log('✅ Streaming response received, processing...');
        console.log('='.repeat(60));
        
        let currentContent = '';
        let currentThinkingContent = '';
        let streamedContent = '';
        
        // Handle streaming response
        const responseText = await response.text();
        const lines = responseText.split('\n');
        
        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                    console.log('🏁 Stream completed');
                    break;
                }
                
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.choices && parsed.choices[0]) {
                        const choice = parsed.choices[0];
                        const delta = choice.delta;
                        
                        // Handle main content (stream to user)
                        if (delta.content) {
                            currentContent += delta.content;
                            streamedContent += delta.content;
                            process.stdout.write(delta.content); // Stream to console
                        }
                        
                        // Handle thinking content (don't stream, collect separately)
                        if (delta.reasoning_content) {
                            currentThinkingContent += delta.reasoning_content;
                        }
                    }
                } catch (e) {
                    // Skip invalid JSON
                }
            }
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('📊 Streaming Analysis:');
        console.log(`Main content streamed: ${currentContent.length} characters`);
        console.log(`Thinking content collected: ${currentThinkingContent.length} characters`);
        console.log(`Total streamed to user: ${streamedContent.length} characters`);
        
        // Show what the final separated response would look like
        console.log('\n📋 Final separated response would be:');
        console.log('-'.repeat(40));
        
        let finalResponse = '';
        if (currentThinkingContent) {
            finalResponse += `🤔\n${currentThinkingContent}\n🤔\n\n`;
        }
        if (currentContent) {
            finalResponse += currentContent;
        }
        
        console.log('Thinking content: [HIDDEN FROM STREAM]');
        console.log('Main content: [STREAMED TO USER]');
        console.log('\n✅ Streaming thinking mode separation test completed!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testStreamingThinking();