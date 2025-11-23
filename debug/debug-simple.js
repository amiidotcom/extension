#!/usr/bin/env node

const fetch = require('node-fetch');

const CHUTES_API_TOKEN = 'cpk_a522f4893d9a49eeb3af7e4adae5ac68.8b3a69700e9350ecb930061a6081e37f.5LSsDNmmXNaVp0H5qDdNAiH9iAcrASwG';

async function invokeChute() {
    console.log('🚀 Calling Chutes API with Kimi-K2-Thinking model...');
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
                "stream": false, // Disable streaming for now
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

        const data = await response.json();
        console.log('✅ Response received!');
        console.log('-'.repeat(60));
        console.log('📋 Full Response:');
        console.log(JSON.stringify(data, null, 2));
        
        if (data.choices && data.choices[0] && data.choices[0].message) {
            const message = data.choices[0].message;
            const content = message.content || '';
            const reasoningContent = message.reasoning_content || '';
            
            console.log('\n💬 Message Content:');
            console.log('-'.repeat(40));
            console.log(content || 'null');
            console.log('-'.repeat(40));
            
            console.log('\n🧠 Reasoning Content:');
            console.log('-'.repeat(40));
            console.log(reasoningContent || 'null');
            console.log('-'.repeat(40));
            
            // Look for thinking patterns in both content and reasoning_content
            const combinedContent = content + reasoningContent;
            console.log('\n🔍 Pattern Detection:');
            const patterns = [
                { name: '</think> tags', regex: /<think[^>]*>/gi },
                { name: '</think> tags', regex: /<\/think>/gi },
                { name: '🤔 markers', regex: /🤔/gi },
                { name: 'Thinking keywords', regex: /thinking|reasoning|analysis/gi }
            ];

            patterns.forEach(pattern => {
                const matches = combinedContent.match(pattern.regex);
                if (matches) {
                    console.log(`✅ Found ${pattern.name}: ${matches.length} occurrences`);
                    matches.forEach((match, index) => {
                        const position = combinedContent.indexOf(match);
                        console.log(`   ${index + 1}. "${match}" at position ${position}`);
                    });
                } else {
                    console.log(`❌ No ${pattern.name} found`);
                }
            });
        }

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

// Run the debug function
invokeChute();