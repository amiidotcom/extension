#!/usr/bin/env node

const fetch = require('node-fetch');

const CHUTES_API_TOKEN = 'cpk_a522f4893d9a49eeb3af7e4adae5ac68.8b3a69700e9350ecb930061a6081e37f.5LSsDNmmXNaVp0H5qDdNAiH9iAcrASwG';

async function invokeChute() {
    console.log('🚀 Calling Chutes API with Kimi-K2-Thinking model (streaming)...');
    console.log('📝 Prompt: "Tell me a 250 word story."');
    console.log('='.repeat(60));
    
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
                        "content": "Tell me a 250 word story."
                    }
                ],
                "stream": true,
                "max_tokens": 1024,
                "temperature": 0.7
            })
        });

        if (!response.ok) {
            console.error(`❌ HTTP Error: ${response.status} ${response.statusText}`);
            const errorText = await response.text();
            console.error('Error details:', errorText);
            return;
        }

        console.log('✅ Response received, processing stream...');
        console.log('-'.repeat(60));
        
        let fullResponse = '';
        let thinkingContent = '';
        let mainContent = '';
        
        // Handle streaming response
        const responseText = await response.text();
        console.log('📋 Raw streaming response:');
        console.log(responseText);
        console.log('-'.repeat(60));
        
        // Parse SSE chunks
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
                        
                        if (delta.content) {
                            mainContent += delta.content;
                            fullResponse += delta.content;
                        }
                        
                        if (delta.reasoning_content) {
                            thinkingContent += delta.reasoning_content;
                            fullResponse += delta.reasoning_content;
                        }
                    }
                } catch (e) {
                    console.log('⚠️  Failed to parse chunk:', data);
                }
            }
        }
        
        console.log('\n💬 Main Content:');
        console.log('-'.repeat(40));
        console.log(mainContent);
        console.log('-'.repeat(40));
        
        console.log('\n🧠 Thinking Content:');
        console.log('-'.repeat(40));
        console.log(thinkingContent);
        console.log('-'.repeat(40));
        
        console.log('\n🔍 Analysis:');
        console.log(`Main content length: ${mainContent.length}`);
        console.log(`Thinking content length: ${thinkingContent.length}`);
        console.log(`Has thinking: ${thinkingContent.length > 0 ? '✅ Yes' : '❌ No'}`);

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

// Run the debug function
invokeChute();