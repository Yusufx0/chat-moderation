import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors({
    origin: process.env.ALLOW_ORIGIN || "*"
}));

// Moderasyon endpointi
app.post("/moderate", async (req, res) => {
    try {
        const text = req.body.text;
        if (!text) return res.status(400).json({error: "Text missing"});

        // 1️⃣ Perspective API ile toxiclik kontrolü
        const perspectiveResp = await fetch(
            "https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=" + process.env.PERSPECTIVE_KEY,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    comment: { text },
                    requestedAttributes: { TOXICITY: {} }
                })
            }
        );
        const perspectiveData = await perspectiveResp.json();
        const score = perspectiveData.attributeScores.TOXICITY.summaryScore.value;

        // 2️⃣ HuggingFace API ile ek analiz (isteğe bağlı, çok dil destek)
        const hfResp = await fetch(
            "https://api-inference.huggingface.co/models/RobertRoberto/moderation",
            {
                method: "POST",
                headers: { "Authorization": `Bearer ${process.env.HF_KEY}` },
                body: JSON.stringify({ inputs: text })
            }
        );
        const hfData = await hfResp.json();

        // Basit karar: Perspective score > 0.85 ise sansürle
        const censored = score > 0.85 || (hfData[0]?.label === "TOXIC");

        res.json({ censored, score, hfData });
    } catch (e) {
        console.error(e);
        res.status(500).json({error: "Server error"});
    }
});

// Health check
app.get("/", (req,res)=>res.send("Moderation API is running"));

// Cloud Run port
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
