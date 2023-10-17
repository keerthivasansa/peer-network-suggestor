import puppeteer, { Frame, Page } from "puppeteer"
import Container, { Service } from "typedi";
import { CacheManager } from "./cache.js";
import { NLPService } from "./nlp.js";
import { PeerManager } from "./peerManager.js";
import { shops } from "./data/shops.js";

@Service()
export class BrowserTagger {
    private cacheManager = Container.get(CacheManager);
    private nlpService = Container.get(NLPService);
    private peerManager = Container.get(PeerManager);

    async start(peer: Peer) {
        const browser = await puppeteer.launch({
            headless: false,
            userDataDir: "./user_data",
        });

        browser.on('targetcreated', async (target) => {
            if (target.type() === 'page') {
                const newPage = await target.page();
                if (newPage) {
                    this.handleNewPage(peer, newPage);
                }
            }
        });
    }
    
    async generateTags(frame: Frame, url: string) {
        const cacheTags = this.cacheManager.getUrlTags(url);
        if (cacheTags)
            return cacheTags;
        try {

            const contentArr = await frame.evaluate(() => {
                let headers: string[] = [];
                const elementsToScrape = [
                    'h1', 'h2', 'h3', 'h4', 'h5', 'b', 'strong'
                ]
                elementsToScrape.map(tag => {
                    const elements = Array.from(document.querySelectorAll(tag));
                    const content = elements.map(h1 => h1.textContent);
                    headers = headers.concat(content);
                });
                return headers
            });
            const gist = contentArr.slice(0, 25).join(", ")
            const tags = this.nlpService.getTags(gist).slice(0, 6);
            const tokens = tags.map(tag => tag.token);
            this.cacheManager.saveUrlTags(url, tokens);
            return tokens;
        } catch (err) {
            console.log(err);
            return [];
        }
    }

    handleNewPage(peer: Peer, page: Page) {
        page.on('framenavigated', (frame) => this.handleNavigation(peer, frame));
    }

    async handleNavigation(peer: Peer, frame: Frame) {
        const url = frame.url();
        if (url == ':' || url.startsWith("chrome"))
            return console.log("Navigated to internal page, skip tagging");

        let isShop = false;

        shops.map(async (shop) => {
            if (url.includes(shop.domain)) {
                isShop = true;
                if (url !== shop.baseUrl) {
                    console.log("Skipping shop baseUrl tagging");
                    return;
                }
                const title = await frame.title();
                const tags = this.nlpService.getTags(title).slice(0, 6);
                console.log("Detetected shop adding to identifier: ", title);
                tags.map(tag => this.peerManager.addPeerToNetwork({ peer, tag: tag.token }));
            }
        })

        if (isShop)
            return;

        const tags = await this.generateTags(frame, url);
        if (!tags)
            return;

        console.log({ tags });
        peer.interests = peer.interests.concat(tags);
    }
}