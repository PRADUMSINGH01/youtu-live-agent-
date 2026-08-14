import { Queue } from "bullmq";

import connection from "./redis.js";


const streamQueue = new Queue("stream", { connection })
const emailQueue = new Queue("email", { connection })

export { streamQueue, emailQueue }


