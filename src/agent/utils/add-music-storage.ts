import { db,storage } from "../../firebase/init.js";
import { SongConfig } from "../types.js";

interface AddMusicStorage {
  documentId: string;
}
async function addMusicStorage(musicData: SongConfig): Promise<AddMusicStorage>     {
  
    try {
    // Add music data to Firestore
    const docRef = await db.collection('music').add(musicData);
    console.log('Music data added with ID:', docRef.id);    
    return { documentId: docRef.id };

  }catch (error) {
    console.error('Error adding music data:', error);
    throw error;
  }


}