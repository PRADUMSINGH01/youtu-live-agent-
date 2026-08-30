import { GoogleGenAI } from '@google/genai'
import dotenv from 'dotenv'

dotenv.config()
const GEMINI_API_KEY = process.env.GEMINI_API_KEY



type Model = {
  id: string;
  name: string;
  description: string;
};

async function createGeminiClient() {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not defined in the environment variables.')
  }
  try {

    //create gemini client
    const GeminiClient = new GoogleGenAI({ apiKey: GEMINI_API_KEY, });

    //fetch latest model list and use theme automatically
    const getmodel = GeminiClient.models.list().then((models): Model => {

      const model = 'gemini-3.1-flash-lite'//models.page[6].name||;

      return { id: model, name: model, description: 'Selected model' };
    });

    //generate content using the selected model

    const generateContent = GeminiClient.models.generateContent({
      model: (await getmodel).id.replace('models/', ''),
      contents: [
        { role: 'user', parts: [{ text: 'call the fetch_audio tool to fetch audio data from a given URL and return it as an ArrayBuffer along with its content type. The URL is https://api.freetouse.com/v3/music/categories/' }] }
      ],
      config: {
        maxOutputTokens: 1024,
        tools: [] as any[],
      }


    })

    generateContent.then((response) => {
      console.log('--- Raw Response ---', response);

      const candidate = response.candidates?.[0];
      const part = candidate?.content?.parts?.[0];

      // 1. Check if Gemini is asking to execute a tool (functionCall)
      if (part?.functionCall) {
        console.log('🤖 Gemini is requesting a Function Call:');
        console.log('Function Name:', part.functionCall.name);
        console.log('Arguments passed:', part.functionCall.args);
      }

      // 2. Check if it's a normal text response
      else if (part?.text) {
        console.log('🤖 Gemini replied with text:', part.text);
      }

      // 3. Inspect why it failed if it broke
      if (candidate?.finishReason === 'MALFORMED_FUNCTION_CALL') {
        console.warn('⚠️ The tool definition schema caused Gemini to output an invalid format.');
      }
    });


  } catch (error: unknown) {
    if (typeof error === 'string') {
      console.error(`Error: ${error}`);
    } else {
      console.error('An unexpected error occurred:', error);
    }

  }


}



createGeminiClient()












