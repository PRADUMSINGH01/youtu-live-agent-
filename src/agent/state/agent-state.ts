/* 
this is stated of agent to see previous agent work and get propes  as well in real time 
*/

import { realtimedate } from "../../firebase/init.js";


export interface stateConfig {
    title: string,
    description: string,
    tags: string[],
    video_duration: number,// one hour, two hours , three hours in minutes 
    mood: string,
    musicCategory: string,
    loops: number, // number of loops for the content generate audio 
    state: string,//


}

interface Response {
    Result: true | Error
}


export class AgentState {
    Store = realtimedate.ref('store')

    /*
   store: {

    -today_session:{
      -store memoery
    }
 
    -previous_session:{
    -store memoery
     }

     }
     
     provide only 7 stored memory  max and delete previous stored memoery 
    */


    async getMemoryState() {
        const memory = new Map();

        // Use once("value") to get all data at this moment
        const snapshot = await this.Store.orderByChild("Agent-update").once("value");
        snapshot.forEach((childSnapshot) => {
            memory.set(childSnapshot.key, childSnapshot.val());
        });

        return memory;
    }


    async updatetoState() {
        return
    }

    async deletetoState() {
        return
    }

    async addtoState(
        data: stateConfig,
        date: string
    ): Promise<Response> {
        try {
            await this.Store.child(date).set({ ...data });
            return { Result: true };
        } catch (error: unknown) {
            return {
                Result: error instanceof Error
                    ? error
                    : new Error("Unknown error occurred"),
            };

        }
    }


}


// export async function Agent_Store(state: string, stateConfig: stateConfig) {
//     const Store = realtimedate.ref('store')
//     Store.child(state).set({ ...stateConfig }, (error) => {
//         if (error) {
//             console.log("State not saved ")
//         } else {
//             console.log("State  saved ")
//             return

//         }
//     })

// }



