// 大模型联网检索服务：周边配套分析 + 全网房源检索。
// 诚实契约：解析不出结果就返回失败，绝不生成兜底数据（历史遗留的假房源兜底已移除）。

import { GoogleGenAI } from '@google/genai';
import { GEMINI_MODEL, geminiApiKey } from '../config.js';
import { amenitiesPrompt, liveListingsPrompt } from '../prompts.js';

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!client) {
    client = new GoogleGenAI({
      apiKey: geminiApiKey(),
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });
  }
  return client;
}

export interface GroundingSource {
  title: string;
  url: string;
}

function extractSources(groundingMetadata: any): GroundingSource[] {
  const sources: GroundingSource[] = [];
  const seenUrls = new Set<string>();
  for (const chunk of (groundingMetadata?.groundingChunks || []) as any[]) {
    if (chunk.web?.uri && !seenUrls.has(chunk.web.uri)) {
      seenUrls.add(chunk.web.uri);
      sources.push({ title: chunk.web.title || chunk.web.uri, url: chunk.web.uri });
    }
  }
  return sources;
}

export type AmenitiesOutcome =
  | {
      ok: true;
      query: string;
      content: string;
      sources: GroundingSource[];
      searchQueries: string[];
    }
  | { ok: false; error: string };

export async function searchAmenities(params: {
  city: string;
  community: string;
  address: string;
}): Promise<AmenitiesOutcome> {
  const { city, community, address } = params;
  if (!community && !address) {
    return { ok: false, error: '请提供小区名称或详细地址' };
  }
  const locationQuery = `${city ? city + '市 ' : ''}${community || ''} ${address || ''}`.trim();

  try {
    const response = await getClient().models.generateContent({
      model: GEMINI_MODEL,
      contents: amenitiesPrompt({ city, community, address }),
      config: { tools: [{ googleSearch: {} }] },
    });

    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    return {
      ok: true,
      query: locationQuery,
      content: response.text || '暂无检索结果，请核对小区名称。',
      sources: extractSources(groundingMetadata),
      searchQueries: groundingMetadata?.webSearchQueries || [],
    };
  } catch (error: any) {
    console.error('Amenities Search Grounding Error:', error);
    return { ok: false, error: error.message || '查询周边生活配套失败，请稍后重试' };
  }
}

export type LiveListingsOutcome =
  | {
      ok: true;
      query: Record<string, unknown>;
      listings: Record<string, any>[];
      sources: GroundingSource[];
      searchQueries: string[];
    }
  | { ok: false; error: string; sources?: GroundingSource[]; searchQueries?: string[] };

export async function searchLiveListings(params: {
  city: string;
  district: string;
  subwayStation: string;
  budgetMin: number;
  budgetMax: number;
  roomType: string;
  keywords: string;
}): Promise<LiveListingsOutcome> {
  try {
    const response = await getClient().models.generateContent({
      model: GEMINI_MODEL,
      contents: liveListingsPrompt(params),
      config: { tools: [{ googleSearch: {} }] },
    });

    const responseText = response.text || '';
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    const sources = extractSources(groundingMetadata);
    const searchQueries: string[] = groundingMetadata?.webSearchQueries || [];

    let listings: Record<string, any>[] = [];
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      try {
        listings = JSON.parse(jsonMatch[1]);
      } catch (parseErr) {
        console.error('Failed to parse JSON from AI response:', parseErr);
      }
    }

    if (!Array.isArray(listings) || listings.length === 0) {
      return {
        ok: false,
        error: 'AI 未返回可解析的房源 JSON（0 条）。按规则不生成任何模拟数据，请调整条件后重试。',
        sources,
        searchQueries,
      };
    }

    listings = listings.map((item, idx) => ({
      ...item,
      id: `live-${Date.now()}-${idx}`,
      sourceUrl: sources[idx % Math.max(1, sources.length)]?.url || '',
    }));

    return {
      ok: true,
      query: {
        city: params.city,
        district: params.district,
        subwayStation: params.subwayStation,
        budgetMin: params.budgetMin,
        budgetMax: params.budgetMax,
        roomType: params.roomType,
      },
      listings,
      sources,
      searchQueries,
    };
  } catch (error: any) {
    console.error('Live Listings Fetch Error:', error);
    return { ok: false, error: error.message || '全网房源抓取与检索失败，请稍后重试' };
  }
}
