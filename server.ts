import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

const SYSTEM_INSTRUCTION = `Você é o consultor financeiro pessoal do usuário, com mentalidade de economista e especialista em renegociação de dívidas. Ele é motorista de aplicativo e está entrando em um emprego com salário fixo no Mercado Livre, e está muito endividado. Fale em português simples do Brasil, com empatia e franqueza. Nunca julgue, nunca culpe e não enrole. Use sempre os dados reais do app fornecidos no contexto, nunca invente números, e diga quando faltar informação. Lembre com naturalidade quando fizer sentido que suas sugestões são orientação e não substituem um profissional ou órgãos gratuitos de defesa do consumidor (como Procon/Defensoria) se a situação sair do controle. Termine toda resposta com a próxima ação prática, em uma frase.`;

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, aiConfigured: Boolean(getAiClient()) });
  });

  // Natural language Financial Consultant Chat
  app.post('/api/ai/chat', async (req, res) => {
    try {
      const ai = getAiClient();
      if (!ai) {
        return res.status(503).json({
          error: 'Chave da API Gemini não configurada no servidor (Settings > Secrets).',
        });
      }
      const { message, financialContext, history } = req.body as {
        message: string;
        financialContext: string;
        history?: { role: 'user' | 'assistant'; text: string }[];
      };

      if (!message || !financialContext) {
        return res.status(400).json({ error: 'Mensagem e contexto financeiro são obrigatórios.' });
      }

      const historyText = (history || [])
        .slice(-6)
        .map((h) => `${h.role === 'user' ? 'Usuário' : 'Consultor'}: ${h.text}`)
        .join('\n');

      const prompt = `${financialContext}

${historyText ? `HISTÓRICO RECENTE DA CONVERSA:\n${historyText}\n` : ''}
PERGUNTA ATUAL DO USUÁRIO:
${message}

Responda de forma clara, direta, sem jargões difíceis (se usar termos como amortização ou saldo devedor, explique em 1 linha), citando os valores exatos em R$ do contexto acima, e termine com "Próxima ação prática:" em uma frase.`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
        },
      });

      res.json({ reply: response.text || 'Não foi possível gerar a resposta no momento.' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao consultar o assistente.';
      console.error('Gemini chat error:', msg);
      res.status(500).json({ error: msg });
    }
  });

  // Proactive Weekly/Monthly Summary, Debt Exit Plan, or Negotiation Script
  app.post('/api/ai/plan', async (req, res) => {
    try {
      const ai = getAiClient();
      if (!ai) {
        return res.status(503).json({
          error: 'Chave da API Gemini não configurada no servidor (Settings > Secrets).',
        });
      }
      const { mode, financialContext, targetCreditor } = req.body as {
        mode: 'resumo_semanal' | 'resumo_mensal' | 'plano_dividas' | 'roteiro_negociacao' | 'resumo_diario';
        financialContext: string;
        targetCreditor?: string;
      };

      let taskPrompt = '';
      if (mode === 'resumo_semanal') {
        taskPrompt =
          'Faça um resumo semanal amigável e direto com base nos números da semana: quanto entrou, quanto saiu, o que sobrou e dê NO MÁXIMO 3 ações práticas numeradas para a semana.';
      } else if (mode === 'resumo_mensal') {
        taskPrompt =
          'Faça um resumo mensal direto: para onde foi o dinheiro do mês, evolução das dívidas, resultado do Uber vs custos, e dê NO MÁXIMO 3 ações práticas para o próximo mês.';
      } else if (mode === 'plano_dividas') {
        taskPrompt =
          'Monte um plano mês a mês objetivo para sair das dívidas usando o salário CLT do Mercado Livre + renda do Uber, indicando quais dívidas atacar primeiro, quando considerar portabilidade ou troca de dívida cara por mais barata, e mencionando feirões como Serasa Limpa Nome.';
      } else if (mode === 'roteiro_negociacao') {
        taskPrompt = `Escreva um roteiro pronto de conversa (o que falar por telefone, WhatsApp ou chat) para renegociar com o credor "${
          targetCreditor || 'banco / credor prioritário'
        }", pedindo desconto à vista ou redução de juros e parcela que caiba no orçamento real do usuário.`;
      } else {
        taskPrompt =
          'Faça o resumo diário das 21h em até 4 linhas curtas: quanto ganhou hoje, quanto gastou, quanto faltou ou sobrou da meta, e a próxima ação prática para amanhã.';
      }

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `${financialContext}\n\nTAREFA:\n${taskPrompt}`,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
        },
      });

      res.json({ reply: response.text || 'Não foi possível gerar a análise.' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao gerar análise com IA.';
      console.error('Gemini plan error:', msg);
      res.status(500).json({ error: msg });
    }
  });

  // Receipt Photo OCR via Gemini Multimodal
  app.post('/api/ai/receipt', async (req, res) => {
    try {
      const ai = getAiClient();
      if (!ai) {
        return res.status(503).json({
          error: 'Chave da API Gemini não configurada no servidor (Settings > Secrets).',
        });
      }
      const { imageBase64, mimeType } = req.body as { imageBase64: string; mimeType: string };
      if (!imageBase64) {
        return res.status(400).json({ error: 'Imagem do comprovante é obrigatória.' });
      }

      const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mimeType || 'image/jpeg',
                data: cleanBase64,
              },
            },
            {
              text: 'Extraia os dados deste comprovante/nota fiscal brasileiro. Retorne valor total em reais (número decimal, ex: 45.90), data no formato YYYY-MM-DD (se não legível, string vazia), nome do estabelecimento e categoria sugerida (ex: Combustível, Padaria, Mercado, Alimentação, Carro e Manutenção, Saúde, Outros).',
            },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              amountReais: { type: Type.NUMBER, description: 'Valor total em reais' },
              date: { type: Type.STRING, description: 'Data YYYY-MM-DD ou vazio' },
              merchant: { type: Type.STRING, description: 'Nome do estabelecimento' },
              suggestedCategory: { type: Type.STRING, description: 'Categoria sugerida' },
            },
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json(parsed);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao ler comprovante.';
      console.error('Gemini receipt error:', msg);
      res.status(500).json({ error: msg });
    }
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Cérebro Financeiro server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
