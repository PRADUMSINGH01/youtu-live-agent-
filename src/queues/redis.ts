import { Redis } from "ioredis";

const connection = new Redis(  "rediss://default:AYltAAIncDFhOWU2YmFiNzEzZTk0NDI0YjMxMGQ3ZDM3OGRkNzViNXAxMzUxODE@helping-goose-35181.upstash.io:6379"             ,{maxRetriesPerRequest: null, enableReadyCheck: false });


connection.on("connect", () => {
    console.log("Connected to Redis");
});

connection.on("error", (error:any) => {
    console.error("Error connecting to Redis:", error);
});



export default connection;