import puppeteer, { Frame, Page } from "puppeteer"
import Container, { Service } from "typedi";
import { AnyNode, CheerioAPI, load as cheerio } from "cheerio";
import { CacheManager } from "./cache.js";
import { NLPService } from "./nlp.js";
import { PeerManager } from "./peerManager.js";
import { shops } from "./data/shops.js";
import { sleep } from "./utils.js";
import { isUrlBlacklisted } from "./data/url_blacklist.js";

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

        browser.pages().then(pages => this.handleNewPage(peer, pages[0]));

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
        if (cacheTags) {
            console.log("[cache] hit for url")
            return cacheTags;
        }
        try {
            await sleep(2000)
            const document = await frame.content();

            const contentArr = await frame.evaluate(() => {
                const doc = document as unknown as Document;
                const tagsToScrape = ['h1', 'h2', 'h3', 'h4', 'h5', 'b', 'strong', 'title', 'a'];

                function getText(element: Element) {
                    if (element.childNodes.length == 0) {
                        return [element.textContent.trim()];
                    }
                    return Array.from(element.childNodes).map(getText).flat(1);
                }
                let content: string[] = [];
                for (const tag of tagsToScrape) {
                    const elements = doc.querySelectorAll(tag);
                    const text = Array.from(elements).map(getText).flat(1);
                    content = content.concat(text);
                }
                return content;
            })
            console.log({ contentArr })
            const gist = contentArr.join(', ')
            console.log({ gist, url })
            const tags = this.nlpService.getTags(gist);
            const tokens = tags.map(tag => tag.token);
            this.cacheManager.saveUrlTags(url, tokens);
            return tokens;
        } catch (err) {
            return [];
        }
    }

    getTextContent(elem: AnyNode, cheerio: CheerioAPI): string[] {
        const e$ = cheerio(elem);
        if (e$.children().length == 0) {
            console.log({ text: e$.text().trim() })
            return [e$.text().trim() || ''];
        }
        return e$.children().map((index, elem) => this.getTextContent(elem, cheerio)).get();
    }

    handleNewPage(peer: Peer, page: Page) {
        page.on('framenavigated', (frame) => this.handleNavigation(peer, frame));
    }

    async handleNavigation(peer: Peer, frame: Frame) {
        const url = frame.url();

        if (url == ':' || url.startsWith("chrome") || isUrlBlacklisted(url))
            return console.log("Navigated to internal page, skip tagging");

        console.log('Detected navigation to: ', url);
        let isShop = false;

        shops.map(async (shop) => {
            if (url.includes(shop.domain)) {
                isShop = true;
                if (url === shop.baseUrl) {
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