import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors({
    origin: process.env.ALLOW_ORIGIN || "*"
}));

// ================================
// Moderasyon endpoint
// ================================
app.post("/", async (req, res) => {
    try {
        const text = req.body.text;
        if (!text) return res.status(400).json({ allowed: false, reason: "Text missing" });

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

        // 2️⃣ HuggingFace API ile ek analiz (çok dil destek)
        const hfResp = await fetch(
            "https://api-inference.huggingface.co/models/RobertRoberto/moderation",
            {
                method: "POST",
                headers: { "Authorization": `Bearer ${process.env.HF_KEY}` },
                body: JSON.stringify({ inputs: text })
            }
        );
        const hfData = await hfResp.json();

        // Basit karar: Perspective score > 0.85 veya HF label TOXIC ise engelle
        const isBad = score > 0.85 || (hfData[0]?.label === "TOXIC");

        // Frontend’in beklediği format
        if (isBad) {
            return res.json({ allowed: false, reason: "Mesaj uygunsuz" });
        } else {
            return res.json({ allowed: true, text }); // temiz mesajı gönder
        }

    } catch (e) {
        console.error(e);
        res.status(500).json({ allowed: false, reason: "moderation_failed" });
    }
});

// Sağlık kontrol endpoint
app.get("/", (req,res)=>res.send("Moderation API is running"));

// Cloud Run port
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
