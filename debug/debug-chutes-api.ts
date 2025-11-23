#!/usr/bin/env node

// @ts-ignore
const fetch = require('node-fetch');

const CHUTES_API_TOKEN = 'cpk_a522f4893d9a49eeb3af7e4adae5ac68.8b3a69700e9350ecb930061a6081e37f.5LSsDNmmXNaVp0H5qDdNAiH9iAcrASwG';

if (!CHUTES_API_TOKEN) {
    console.error('Error: CHUTES_API_TOKEN environment variable is not set');
    console.error('Please set it using: export CHUTES_API_TOKEN=your_token_here');
    process.exit(1);
}

async function invokeChute() {
    console.log('🚀 Calling Chutes API with Kimi-K2-Thinking model...');
    console.log('📝 Prompt: "Tell me a 250 word story."');
    console.log('=' .repeat(60));
    
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
        let inThinkingBlock = false;
        let thinkingContent = '';
        let mainContent = '';

        // Handle streaming response
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
            console.error('❌ No response body reader available');
            return;
        }

        while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
                console.log('\n🏁 Stream completed');
                break;
            }

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.trim() === '') continue;
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    
                    if (data === '[DONE]') {
                        console.log('\n📋 Stream finished with [DONE]');
                        continue;
                    }

                    try {
                        const parsed = JSON.parse(data);
                        const choice = parsed.choices?.[0];
                        
                        if (choice?.delta?.content) {
                            const content = choice.delta.content;
                            fullResponse += content;
                            
                            // Log raw content for debugging
                            process.stdout.write(content);
                            
                            // Track thinking blocks
                            if (content.includes('<think')) {
                                inThinkingBlock = true;
                                console.log('\n🧠 **THINKING BLOCK START**');
                            }
                            
                            if (inThinkingBlock) {
                                thinkingContent += content;
                                if (content.includes('</think>')) {
                                    inThinkingBlock = false;
                                    console.log('\n🧠 **THINKING BLOCK END**');
                                }
                            } else {
                                mainContent += content;
                            }
                        }
                    } catch (parseError) {
                        console.warn(`⚠️  Parse error for line: ${data}`);
                    }
                }
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('📊 **ANALYSIS**');
        console.log('=' .repeat(60));
        console.log(`Full response length: ${fullResponse.length} characters`);
        console.log(`Thinking content length: ${thinkingContent.length} characters`);
        console.log(`Main content length: ${mainContent.length} characters`);
        
        if (thinkingContent) {
            console.log('\n🧠 **THINKING CONTENT EXTRACTED:**');
            console.log('-'.repeat(40));
            console.log(thinkingContent);
            console.log('-'.repeat(40));
        }
        
        if (mainContent) {
            console.log('\n💬 **MAIN CONTENT EXTRACTED:**');
            console.log('-'.repeat(40));
            console.log(mainContent);
            console.log('-'.repeat(40));
        }

        // Look for various thinking patterns
        console.log('\n🔍 **PATTERN DETECTION:**');
        const patterns = [
            { name: '<think> tags', regex: /<think[^>]*>/gi },
            { name: '</think> tags', regex: /<\/think>/gi },
            { name: '🤔 markers', regex: /🤔/gi },
            { name: 'Thinking keywords', regex: /thinking|reasoning|analysis/gi }
        ];

        patterns.forEach(pattern => {
            const matches = fullResponse.match(pattern.regex);
            if (matches) {
                console.log(`✅ Found ${pattern.name}: ${matches.length} occurrences`);
                matches.forEach((match, index) => {
                    const position = fullResponse.indexOf(match);
                    console.log(`   ${index + 1}. "${match}" at position ${position}`);
                });
            } else {
                console.log(`❌ No ${pattern.name} found`);
            }
        });

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

// Run the debug function
invokeChute();