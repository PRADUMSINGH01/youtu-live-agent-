// Tool list ---

// 1. search_music()
// 2. find_background_video()
// 3. create_stream_scene()
// 4. configure_obs()
// 5. start_stream()


import { error } from "console";
import { configDotenv } from "dotenv";
import EventEmitter from "events";
import { audioUploadFile } from "../utils/upload.js";
configDotenv()

 const event = new EventEmitter()


const tools = [
  {
    functionDeclarations: [
      {
        name: "search_music",
        description: "use this function to  search music using freetouse API , they category ,genre,mood ",
        parameters: {
          type: "OBJECT",
          properties: {},
        },
      },
      {
        name: "start_obs_stream",
        description: "Start the configured OBS stream.",
        parameters: {
          type: "OBJECT",
          properties: {
            confirmation: {
              type: "STRING",
              description: "Confirmation reason for starting the stream",
            },
          },
          required: ["confirmation"],
        },
      },
    ],
  },
];

export { tools as const }

interface DownloadItem {
  track: {
    id: string;
    title: string;
    mainArtists: string[];
  };

  download: {
    url: string;
    expires: string;
  };
}

interface MusicResult {
  downloads: DownloadItem[];
}

interface MusicResponse {
  status: string;
  result: MusicResult;
}


async function search_music(searchTerm:string): Promise<MusicResponse> {
  const EPIDEMIC_API_KEY = process.env.EPIDEMIC_API_KEY
  const baseUrl = 'https://partner-content-api.epidemicsound.com'
  const limit = 3
  let allTracks = []

  let offset = 0

  if (!EPIDEMIC_API_KEY) {
  throw new error("API KEY MISSING")
  }
  try {
     const response = await fetch(
      `${baseUrl}/v0/tracks/search?term=${encodeURIComponent(
        searchTerm
      )}&limit=${limit}&offset=${offset}`,
      { headers: { Authorization: `Bearer ${process.env.EPIDEMIC_API_KEY}` } }
    )

   const result = await response.json();

allTracks = allTracks.concat(result.tracks);

const downloads  = [];
if (allTracks.length > 0) {

  for (const item of allTracks) {

    const downloadResponse = await fetch(
      `${baseUrl}/v0/tracks/${item.id}/download`,
      {
        headers: {
          "Authorization": `Bearer ${EPIDEMIC_API_KEY}`,
          "x-partner-user-id": process.env.USER_ID,
          "accept": "application/json"
        } 
      }
    );

    if (!downloadResponse.ok) {
      console.log(
        `Download failed for ${item.title}:`,
        downloadResponse.status,
        await downloadResponse.text()
      );
      continue;
    }

    const downloadResult = await downloadResponse.json();
 downloads.push({
    track: item,
    download: downloadResult
  });
    console.log("Track:", item.title);
    console.log("Download result:", downloadResult);
    
  }
 console.log(downloads)
  return  {status: "success",
    result: {downloads}
  }
}

if (!result.links.next) {
    return 
    }
    offset += limit


  } catch (error: unknown) {

    if (error instanceof Error) {
      throw new Error('Invalid API key — check your credentials')
    }
  }



}  

async function DownloadToFirebase(music:DownloadItem){
  const songdata  =  await fetch(music.download.url)
  const rawdata  =  await songdata.arrayBuffer()
  const buffer = Buffer.from(rawdata);
  audioUploadFile(buffer)

console.log(buffer)


}


event.on("search_music", async (search:string) => {
  const music:MusicResponse = await search_music(search);
  console.log("Music received:", music);
  
  music.result.downloads.map((items)=>items.download.url)

  event.emit("download_url_ready" , music.result)

});


event.emit("search_music" , "jazz")


event.on("download_url_ready" , async(music:MusicResult)=>{

  for (const item of music.downloads) {
      await DownloadToFirebase(item);
    }
})


