import { GoogleGenerativeAI } from "@google/generative-ai";

// Gemini API 설정
const API_KEY = "AIzaSyCisAVLU4kK9rP7K158uxlMYFccMOsPVMs";
const MODEL_NAME = "gemini-2.5-flash-preview-05-20";

// Gemini 클라이언트 초기화
const genAI = new GoogleGenerativeAI(API_KEY);

// 기본 모델 인스턴스
export const geminiModel = genAI.getGenerativeModel({ model: MODEL_NAME });

// 텍스트 생성 함수
export async function generateText(prompt: string): Promise<string> {
  const result = await geminiModel.generateContent(prompt);
  const response = result.response;
  return response.text();
}

// 스트리밍 텍스트 생성 함수
export async function* generateTextStream(prompt: string) {
  const result = await geminiModel.generateContentStream(prompt);
  for await (const chunk of result.stream) {
    yield chunk.text();
  }
}

// 채팅 세션 생성
export function createChatSession() {
  return geminiModel.startChat({
    history: [],
  });
}

// 채팅 메시지 전송
export async function sendChatMessage(
  chat: ReturnType<typeof createChatSession>,
  message: string
): Promise<string> {
  const result = await chat.sendMessage(message);
  const response = result.response;
  return response.text();
}

export { genAI, API_KEY, MODEL_NAME };
