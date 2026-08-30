// this is main concept to run all agents and mainly check state and take action acording to agent previous action 
//---first agent --

/*
content desinger agent to design content as per previous memory if there 
and provide all information like video duretion , music category , and video theme 
*/

// second agent -

/*
duretion/ number = get loops is equal to api run to download music





*/

import { error } from "node:console";
import { AgentState, stateConfig } from "../state/agent-state.js";
import { content_designer_agent } from "./content-designer-agent.js";


 const date = new Date();

const dateTime = date
  .toISOString()
  .replace("T", "_")
  .replace(/\..+/, "");

async function loop() {
     let count = 0
     const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
     
     const prompt = `You are a content designer agent. you have
         Your task is to generate creative and engaging content based on the provided context . 
         Please provide a detailed response that includes ideas, 
         suggestions, and any relevant information to help with content creation.`
    while(count<1){

        const state = new AgentState()
        const memory =  await state.getMemoryState()
        console.log("memory-------------")

        if (memory.size<1) {
            // there is not state agent content-designer-agent never run 
        //content_designer_aget should not add or delete any state should return value for state 
        // once schema return and added to state
        const ContentState= await content_designer_agent(GEMINI_API_KEY,prompt)
        if(ContentState instanceof Error){
            return error

        }
        await state.addtoState(ContentState,dateTime)
          if(!ContentState){
            console.log("running with loops")
           return content_designer_agent(prompt,GEMINI_API_KEY,ContentState)
          } 
    }
    

        // before running the main agent check the state values updated and follow the correct schema need to video agent 
        // if (true) {
            
        // } else {

        // }
        // video agent need loops - number of time run the music api to download music and vidoe as well 
        // run the video agent 


        /*
        check the downloaded files and video actully downloaded or not if not run the loop again with correct information what you have in your store 
        if you have correct information than update on stated and memory (context) as well 
        So next time agent know what happened previously 
        
        */
       
       
       
       count++
       
       
    }


}


loop()

