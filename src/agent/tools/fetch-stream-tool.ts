import { ToolType } from "@google/genai";
import { AgentState } from "../state/agent-state.js";

const get_stream_from_state={
    functionDeclarations:[{
        name:"fetch_streams_from_state",
        description:"Get youtube stream details schedule date and end time as well ",
        parameters:{
            type:"Object",
            properties:{
                ChannelName:{type :"string",description:""}
            },
            required:["ChannelName"]
        }
    }]
}


export {get_stream_from_state ,fetch_streams_from_state }  

async function fetch_streams_from_state(channelName:string) {
    const state =  new AgentState()
    let Memory=await state.getMemoryState()
         
  for(let [key,value ]of Memory)   {
  console.log(key[0], "-------",value.mood)
  } 
    return true


}

