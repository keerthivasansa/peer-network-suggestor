import Container, { Service } from "typedi";
import { CacheManager } from "./cache.js";
import axios from "axios";
import { load as cheerioLoad } from "cheerio";
import { NLPService } from "./nlp.js";
import puppeteer from "puppeteer"

@Service()
export class Classifier {
    private cacheManager = Container.get(CacheManager);
    private nlpService = Container.get(NLPService);

    async generateTags(url: string) {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.goto(url);
        return [];
        const cacheTags = this.cacheManager.getUrlTags(url);
        if (cacheTags) {
            return cacheTags;
        }
        try {

            const resp = await axios.get(url);
            console.log('response recoreded')
            const $ = cheerioLoad(resp.data);
            const headers = [];

            const elementsToScrape = [
                'h1', 'h2', 'h3', 'h4', 'h5', 'b', 'strong'
            ]
            elementsToScrape.map(tag => {
                $(tag).each((_, elem) => {
                    const content = $(elem).text();
                    headers.push(content);
                });
            })

            const gist = headers.slice(0, 25).join(", ")
            console.log({ gist })
            const tags = this.nlpService.getTags(gist);
            this.cacheManager.saveUrlTags(url, tags.map(tag => tag.token));
        } catch {
            console.log('access denied');
            return [];
        }
    }
}