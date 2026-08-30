

import { content_designer_agent } from "../core/content-designer-agent.js";
import { AgentState } from "../state/agent-state.js";


const state =  new AgentState()


const MockGeminiResponse = {
  title: "Test streamer Live agent ",
  description:  "good testing the agent ",
  tags: ["longer"],
  video_duration:3600,// one hour, two hours , three hours in minutes 
  mood:"calm" ,
  musicCategory:"Lofi",
  loops: 10, // number of loops for the content generate audio 
  state:"success"

}
async function TestAgent(){
   const date = new Date();

const dateTime = date
  .toISOString()
  .replace("T", "_")
  .replace(/\..+/, "");
   const res  =  await state.addtoState(MockGeminiResponse, dateTime )
    return res
}

async function TestMemory(){
     const state = new AgentState()
        const memory =  await state.getMemoryState()
        console.log(memory)
        if(memory.size<1){
            console.log("calling agent ")
        }else{
            console.log("calling agent with context ")

        }

}

TestMemory()