import { config } from "dotenv";
import { writeFileSync } from "fs";
import OpenAI from "openai";

const seedPeers = [];

const out = config();

const apiKey = process.env.SEED_AI_KEY;

const openai = new OpenAI({
    apiKey,
});

class SeedGenerator {

    async generate() {
        const output = await openai.chat.completions.create({
            temperature: 0.6,
            frequency_penalty: 0.4,
            model: "gpt-3.5-turbo-0301",
            messages: [
                {
                    role: "system",
                    content:
                        `Generate seed data for the following format: interface Peer {
                        interests: string[]
                        age: number;
                        browser: string;
                        interestId: string;
                        os: string;
                        device: string;
                    }. The format: [{"peer": Peer, "tag": string}]. The tag needs to represent a shopping category that the person who is described by the peer object could buy based on the characteristics. Give more weightage to the age parameter when deciding what they would buy. Also take the location and interests into consideration when deciding the category. The mac / ios browsers / os will tend to be more creative / musical friendly. Now generate 50 such data in JSON array format. Do not output any other text, this needs to be saved to a file. Also give the data in minified format`
                }
            ]
        });
        const data = output.choices[0].message.content.trim() 
        writeFileSync('seed.json', data);
        console.log('Finished')
    }

}

async function main() {
    console.log('Generating')
    const seedGen = new SeedGenerator();
    seedGen.generate();
};
main();