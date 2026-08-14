import { Router } from "express";
import { streamQueue } from "../../queues/queues.js";

const router = Router();


router.post("/add-stream", async (req, res) => {

const {videoId} = req.body;

if (!videoId) {
    return res.status(400).json({ message: "Video ID is required" });
}

const job = await streamQueue.add("stream", {
    videoId,
});

return res.status(200).json({ message: "Stream added successfully", job });

} )

export default router;