


import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();
//

import z from 'zod';
import { stateConfig } from '../state/agent-state.js';
// agent state 


// gemini json response
const GEMINI_RESPONSE_SCHEMA = z.object({
  title: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
  video_duration: z.number(),// one hour, two hours , three hours in minutes 
  mood: z.string(),
  musicCategory:z.string(),
  loops: z.number(), // number of loops for the content generate audio 
  state:z.string(),// 

});
//


const responseSchema = GEMINI_RESPONSE_SCHEMA.toJSONSchema();
// content-----designer---agent 
export async function content_designer_agent(GEMINI_API_KEY:string,prompt:string ,memory?:{} ):Promise<stateConfig|Error> {

  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not defined in the environment variables.');
  }
  try {
    const contentDesignerClient = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const modelId = 'gemini-3.1-flash-lite'; // Use the desired model ID
   

    // get response from the content designer agent
    let response = await contentDesignerClient.models.generateContent({
      model: modelId,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: prompt
            }
          ]
        }],
      config: {
        maxOutputTokens: 1524,
        systemInstruction: memory,
        responseSchema,
        responseMimeType: "application/json",
        tools:[]

      }

    })

    const raw = response.candidates?.[0]?.content?.parts?.at(0)?.text;

    const result = GEMINI_RESPONSE_SCHEMA.parse(
      JSON.parse(raw || '{}')
    );
    if (!raw) {
      throw new Error("No response from content designer agent.");
    }else{
      console.log(result)

      return result
    }
    // update state 
  } catch (error:unknown){
    

  }
}









