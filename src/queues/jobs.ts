import { emailQueue, streamQueue } from "./queues.js";

await emailQueue.add("send-email", {
    to: "[EMAIL_ADDRESS]",
    subject: "Test Email",
    text: "This is a test email sent from BullMQ",
});

await streamQueue.add("stream", {
    name: "John",
    age: 30,
    job: "Developer",
});

console.log("Jobs added to queues successfully.");
process.exit(0);