#!/usr/bin/env node

const fetch = require('node-fetch');

const CHUTES_API_TOKEN = 'cpk_a522f4893d9a49eeb3af7e4adae5ac68.8b3a69700e9350ecb930061a6081e37f.5LSsDNmmXNaVp0H5qDdNAiH9iAcrASwG';

async function testThinkingDisplay() {
    console.log('🧠 Testing thinking content display in VS Code chat format...');
    
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
                        "content": "Explain the concept of black holes in simple terms."
                    }
                ],
                "stream": true,
                "max_tokens": 800,
                "temperature": 0.7
            })
        });

        if (!response.ok) {
            console.error(`❌ HTTP Error: ${response.status} ${response.statusText}`);
            return;
        }

        console.log('✅ Streaming response received, simulating VS Code chat display...');
        console.log('='.repeat(80));
        
        let currentContent = '';
        let currentThinkingContent = '';
        let hasShownThinkingHeader = false;
        let hasShownResponseHeader = false;
        
        // Handle streaming response
        const responseText = await response.text();
        const lines = responseText.split('\n');
        
        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                    console.log('\n🏁 Stream completed');
                    break;
                }
                
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.choices && parsed.choices[0]) {
                        const choice = parsed.choices[0];
                        const delta = choice.delta;
                        
                        // Handle thinking content
                        if (delta.reasoning_content) {
                            currentThinkingContent += delta.reasoning_content;
                            
                            // Show thinking header once
                            if (!hasShownThinkingHeader) {
                                console.log('🤔 **Thinking Process:**');
                                hasShownThinkingHeader = true;
                            }
                            
                            // Stream thinking content
                            process.stdout.write(delta.reasoning_content);
                        }
                        
                        // Handle main content
                        if (delta.content) {
                            currentContent += delta.content;
                            
                            // Add transition if we have thinking content and this is the first main content
                            if (currentThinkingContent && !hasShownResponseHeader) {
                                console.log('\n🤔\n**Response:**');
                                hasShownResponseHeader = true;
                            }
                            
                            // Stream main content
                            process.stdout.write(delta.content);
                        }
                    }
                } catch (e) {
                    // Skip invalid JSON
                }
            }
        }
        
        console.log('\n' + '='.repeat(80));
        console.log('📊 Display Analysis:');
        console.log(`Thinking content shown: ${hasShownThinkingHeader ? '✅ Yes' : '❌ No'}`);
        console.log(`Main content shown: ${hasShownResponseHeader ? '✅ Yes' : '❌ No'}`);
        console.log(`Thinking content length: ${currentThinkingContent.length} characters`);
        console.log(`Main content length: ${currentContent.length} characters`);
        
        console.log('\n✅ Thinking content display test completed!');
        console.log('The thinking content should now be visible in VS Code chat with clear formatting.');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testThinkingDisplay();