#!/usr/bin/env node

const fetch = require('node-fetch');

const CHUTES_API_TOKEN = 'cpk_a522f4893d9a49eeb3af7e4adae5ac68.8b3a69700e9350ecb930061a6081e37f.5LSsDNmmXNaVp0H5qDdNAiH9iAcrASwG';

async function testThinkingSeparation() {
    console.log('🧠 Testing thinking mode separation logic...');
    
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
                        "content": "Tell me a 100 word story about a lighthouse."
                    }
                ],
                "stream": false,
                "max_tokens": 1024,
                "temperature": 0.7
            })
        });

        if (!response.ok) {
            console.error(`❌ HTTP Error: ${response.status} ${response.statusText}`);
            return;
        }

        const data = await response.json();
        const choice = data.choices[0];
        const message = choice.message;
        
        console.log('✅ Response received!');
        console.log('='.repeat(60));
        
        // Simulate the separation logic from OpenAI API client
        const content = [];
        
        // Add thinking content first (if any)
        if (message.reasoning_content) {
            content.push({
                type: 'text',
                text: `🤔\n${message.reasoning_content}\n🤔\n\n`
            });
            console.log('🧠 Thinking content detected and separated');
        }
        
        // Add main content
        if (message.content) {
            content.push({
                type: 'text',
                text: message.content
            });
            console.log('📝 Main content detected');
        }
        
        const fullText = content.map(c => c.text).join('');
        
        console.log('\n📋 Processed response:');
        console.log('-'.repeat(40));
        console.log(fullText);
        console.log('-'.repeat(40));
        
        // Analysis
        const hasThinkingMarkers = fullText.includes('🤔');
        const thinkingParts = fullText.match(/🤔\n([\s\S]*?)\n🤔/g);
        
        console.log('\n🔍 Analysis:');
        console.log(`Has thinking markers: ${hasThinkingMarkers ? '✅ Yes' : '❌ No'}`);
        console.log(`Total content blocks: ${content.length}`);
        
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
        
        console.log('\n✅ Thinking mode separation test completed successfully!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testThinkingSeparation();