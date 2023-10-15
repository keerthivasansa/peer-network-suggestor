import 'reflect-metadata';
import { Classifier, ModelOptions } from './classifier.js';
import express from "express";


async function main() {
    const k = new Classifier();
    const app = express();
    app.use(express.json())
    app.post("/recommendation", async (req, res) => {
        const samplePeer = req.body as Peer;
        try {
            const recommendationTag = await k.getRecommendationWithNetwork(samplePeer);
            console.log({ recommendationTag })
            return res.send(recommendationTag);
        } catch (err) {
            console.log(err);
            return res.send("error");
        }
    })

    k.setOptions({
        smoothing: 0.15,
        temperature: 0.75,
    })

    const testData = k.getTestData();
    app.get("/score", async (req, res) => {
        try {
            const score = await k.getScore(testData);
            return res.json(score);
        } catch (err) {
            console.log(err);
            return res.send("error");
        }
    });

    app.get("/values", (req, res) => {
        const values = k.getUniqueTags();
        return res.json(values);
    })

    const samplePeer: Peer = {
        age: 20,
        browser: 'chrome',
        device: 'desktop',
        os: 'windows',
        interestId: "nfw0wef-afwaefkawe-fawefawe-acwea",
        interests: ['gaming', 'coding', 'music']
    };

    // k.initBrowser(samplePeer);

    app.listen(5000, () => console.log('Server started'))
}

main();