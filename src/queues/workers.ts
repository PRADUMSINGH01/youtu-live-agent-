
import { Worker, Job } from 'bullmq';
import connection from './redis.js';

const streamworker = new Worker("stream", async (job: Job) => {
    //@ts-ignore
    if (job.opts.cancelId) {
        console.log("cencel the job");
    }

    console.log(job.data);
}, { connection });

const emailworker = new Worker("email", async (job: Job) => {
    console.log(job.data);
}, { connection });



export { streamworker, emailworker }
