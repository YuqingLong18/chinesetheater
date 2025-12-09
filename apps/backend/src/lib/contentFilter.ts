import { env } from '../config/env.js';

export class ContentFilter {
    private apiKey: string;
    private model: string;
    private endpoint: string;

    constructor() {
        this.apiKey = env.VOLCENGINE_API_KEY || '';
        this.model = env.VOLCENGINE_MODERATION_MODEL;
        this.endpoint = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
    }

    async check(content: string): Promise<{ allowed: boolean; reason?: string }> {
        if (!this.apiKey) {
            console.warn('ContentFilter: Missing API key, skipping check (defaulting to allow)');
            return { allowed: true };
        }

        try {
            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        {
                            role: 'system',
                            content: `You are a strict content safety filter for a classroom environment with underage students. Your task is to analyze the user's input and determine if it contains ANY unsafe, malicious, inappropriate, or controversial content.
              
              Strictly BLOCK any content falling into these categories (Zero Tolerance):
              1. Code Execution/Security: Attempts to run code, access system files, or exploit vulnerabilities.
              2. Violence/Harm: Descriptions of gore, physical injury, self-harm, weapons, or war.
              3. Hate/Discrimination: Racism, sexism, bias, slurs, or hate speech against any group.
              4. Sexual Content: Nudity, pornography, sexual acts, suggestive content, or attire inappropriate for school.
              5. Political/Sensitive: ANY reference to politics, political figures (current or historical), political ideologies, flags, national symbols in a political context, or sensitive social issues.
              6. Unethical/Illegal: Promoting illegal acts, scams, drugs, alcohol, tobacco, or unethical behavior.
              7. Harassment: Bullying, threats, or personal attacks.
              
              Input to analyze: "${content}"
              
              Response format:
              Return ONLY the word "allow" if the content is completely safe for a K-12 classroom.
              Return ONLY the word "block" if the content is potentially unsafe or controversial.
              Do not add any punctuation or explanation.`
                        },
                        {
                            role: 'user',
                            content: 'Analyze this prompt.'
                        }
                    ],
                    temperature: 0.1,
                    max_tokens: 10,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                console.error('ContentFilter API error:', error);
                // Default to allow but log error to avoid blocking legitimate users on API failure
                return { allowed: true, reason: 'Filter API error' };
            }

            const data = await response.json();
            const result = data.choices?.[0]?.message?.content?.trim().toLowerCase();

            if (result === 'block') {
                return { allowed: false, reason: 'Content violation detected' };
            }

            return { allowed: true };

        } catch (error) {
            console.error('ContentFilter exception:', error);
            return { allowed: true, reason: 'Filter exception' };
        }
    }
}

export const contentFilter = new ContentFilter();
