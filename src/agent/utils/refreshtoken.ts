import { db } from "../../firebase/init.js";


export async function GetRefreshtoken(userID:string){
    
    const user = await db.collection("users").where("email","==",userID).get()
    const refreshtoken =  user.docs[0]
    return refreshtoken.data().googleTokens.refreshToken

}

// console.log(

// await  (GetRefreshtoken("hs947518@gmail.com"))
// )