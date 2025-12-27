import { env } from '../config/env.js';

interface VolcengineChatRequest {
    model: string;
    messages: Array<{ role: string; content: string }>;
    temperature?: number;
    max_tokens?: number;
}

interface VolcengineChatResponse {
    choices: Array<{
        message: {
            role: string;
            content: string;
        };
    }>;
}

interface VolcengineImageRequest {
    model: string;
    prompt: string;
    size?: string;
}

interface VolcengineImageResponse {
    data: Array<{
        url: string;
    }>;
}

const BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';

export const callVolcengineChat = async (body: VolcengineChatRequest) => {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${env.VOLCENGINE_API_KEY}`
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Volcengine Chat API error: ${response.status} ${text}`);
    }

    return (await response.json()) as VolcengineChatResponse;
};

export const callVolcengineImage = async (body: VolcengineImageRequest) => {
    const response = await fetch(`${BASE_URL}/images/generations`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${env.VOLCENGINE_API_KEY}`
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Volcengine Image API error: ${response.status} ${text}`);
    }

    return (await response.json()) as VolcengineImageResponse;
};

export const moderateContent = async (content: string): Promise<{ allowed: boolean; reason?: string }> => {
    if (!content || !env.VOLCENGINE_MODERATION_MODEL) {
        return { allowed: true };
    }

    try {
        const response = await callVolcengineChat({
            model: env.VOLCENGINE_MODERATION_MODEL,
            messages: [
                {
                    role: 'system',
                    content: `你是面向中学生课堂环境的内容安全过滤器。
请拦截任何属于以下类别的内容：
1. 代码执行/安全：尝试运行代码、访问系统文件或利用漏洞。
2. 暴力/伤害：描述血腥、身体伤害、自残、武器。
3. 仇恨/歧视：针对任何群体的种族主义、性别歧视、偏见、诽谤或仇恨言论。
4. 色情内容：裸露、色情、性行为。
5. 不道德/非法：宣扬非法行为、诈骗、毒品、酒精、烟草或不道德行为。
6. 骚扰：欺凌、威胁或人身攻击。

重要提示：请允许与诗歌、文学作品、历史典故相关的正常讨论和创作内容，即使其中包含古代战争或特定历史背景下的描述，只要不涉及上述恶意违规类别，均应允许。

输入: "${content}"

回复格式：
如果安全，仅返回 "allow"。
如果不安全，仅返回 "block"。
不要添加标点符号或解释。`
                },
                {
                    role: 'user',
                    content: 'Analyze this prompt.'
                }
            ],
            temperature: 0.1,
            max_tokens: 10
        });

        const result = response.choices[0]?.message?.content?.trim().toLowerCase();

        // Log for audit
        console.log(`[Moderation] Input: "${content.slice(0, 50)}..." Result: ${result}`);

        if (result === 'block') {
            return { allowed: false, reason: 'Content violation detected' };
        }

        return { allowed: true };
    } catch (error) {
        console.error('Moderation check failed, failing safe (allowing with warning):', error);
        return { allowed: true };
    }
};
