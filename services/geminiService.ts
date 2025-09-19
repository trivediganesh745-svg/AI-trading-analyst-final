import { GoogleGenAI, Type } from "@google/genai";
import { config } from '../config';
import type { Tick, NewsHeadline, AISignal, Trade, OHLCV } from '../types';
import { SignalAction } from '../types';

if (!config.API_KEY || config.API_KEY === 'PASTE_YOUR_GEMINI_API_KEY_HERE') {
    throw new Error("Missing Gemini API Key. Please edit config.ts");
}

const ai = new GoogleGenAI({ apiKey: config.API_KEY });

const signalSchema = {
    type: Type.OBJECT,
    properties: {
        signal: {
            type: Type.STRING,
            enum: [SignalAction.BUY, SignalAction.SELL, SignalAction.HOLD],
            description: "The trading signal: BUY, SELL, or HOLD."
        },
        confidence: {
            type: Type.NUMBER,
            description: "Confidence level of the signal, from 0.0 to 1.0."
        },
        target: {
            type: Type.NUMBER,
            description: "Suggested target price for the trade."
        },
        stoploss: {
            type: Type.NUMBER,
            description: "Suggested stop-loss price for the trade."
        },
        reason: {
            type: Type.STRING,
            description: "A brief, one-sentence reason for the signal."
        }
    },
    required: ["signal", "confidence", "target", "stoploss", "reason"]
};

const formatTicks = (ticks: Tick[]): string => {
    return ticks.slice(-20) // Last 20 ticks
        .map(t => `Price: ${t.price.toFixed(2)}, Volume: ${t.volume} at ${new Date(t.timestamp).toLocaleTimeString()}`)
        .join('\n');
};

const formatHeadlines = (headlines: NewsHeadline[]): string => {
    return headlines.slice(-5) // Last 5 headlines
        .map(h => `[${h.sentiment}] ${h.text}`)
        .join('\n');
};

export const getGeminiAnalysis = async (
    instrument: string,
    ticks: Tick[],
    headlines: NewsHeadline[],
    ohlcv: OHLCV
): Promise<AISignal> => {

    const cleanInstrument = instrument.replace(/NSE:|BSE:|-EQ|-INDEX/gi, '');
    const latestPrice = ticks.length > 0 ? ticks[ticks.length - 1].price : ohlcv.close;

    const prompt = `
        Analyze the following real-time market data for ${cleanInstrument} and generate a trading signal.

        Current Market Context:
        - Current Price: ${latestPrice.toFixed(2)}
        - Day's Open: ${ohlcv.open.toFixed(2)}
        - Day's High: ${ohlcv.high.toFixed(2)}
        - Day's Low: ${ohlcv.low.toFixed(2)}
        - Previous Day's Close: ${ohlcv.close.toFixed(2)}

        Recent Price Ticks (last 20):
        ${formatTicks(ticks)}

        Recent News Headlines (last 5):
        ${formatHeadlines(headlines)}

        Task:
        Based on all the provided data (current price, OHLCV, recent ticks, and news sentiment), generate a trading signal (BUY, SELL, or HOLD).
        - If BUY or SELL, provide a realistic target price and a stop-loss price. The target should represent a potential profit, and the stop-loss should limit potential loss.
        - Target and stop-loss should be reasonably close to the current price, suitable for short-term intraday trading. For example, within a 0.5% to 1.5% range of the current price.
        - Provide a confidence score between 0.0 and 1.0.
        - Provide a concise, one-sentence reason for your decision, incorporating technical and sentiment factors.
        - Your response must be in JSON format conforming to the provided schema.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash", 
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: signalSchema,
            },
        });

        const jsonText = response.text.trim();
        const result = JSON.parse(jsonText);
        
        if (!result.signal || !result.reason) {
            throw new Error("Invalid response structure from Gemini");
        }
        
        if (result.signal === SignalAction.HOLD) {
            result.target = latestPrice;
            result.stoploss = latestPrice;
        }

        return result as AISignal;

    } catch (error) {
        console.error("Error getting Gemini analysis:", error);
        return {
            signal: SignalAction.HOLD,
            confidence: 0.5,
            target: latestPrice,
            stoploss: latestPrice,
            reason: "Could not retrieve AI analysis due to an error.",
        };
    }
};

export const getSignalExplanation = async (trade: Trade): Promise<string> => {
    const { signal, tick, contextTicks, contextHeadlines } = trade;

    const prompt = `
        A trading bot executed a ${signal.signal} trade at a price of ${tick.price.toFixed(2)}.
        The AI's original reason for the trade was: "${signal.reason}".

        Here is the market data available at the moment of the trade:
        
        Price Ticks Leading Up to the Trade (last 20):
        ${formatTicks(contextTicks)}

        News Headlines at the Time (last 5):
        ${formatHeadlines(contextHeadlines)}

        Task:
        Provide a brief, post-trade analysis explaining WHY the AI likely made this decision.
        - Elaborate on the original reason.
        - Refer to the specific price action in the ticks (e.g., "upward momentum," "breaking a key level") and news sentiment.
        - Keep the explanation to 2-3 sentences.
        - Be objective and analytical. Start your explanation with "The AI likely recommended this trade because...".
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });

        return response.text.trim();
    } catch (error) {
        console.error("Error getting trade explanation from Gemini:", error);
        return "An error occurred while generating the explanation.";
    }
};
