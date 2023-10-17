import Container, { Service } from "typedi";
import { CacheManager } from "./cache.js";
import { NLPService } from "./nlp.js";
import puppeteer, { Frame, Page } from "puppeteer"
import { BayesClassifier } from "natural";
import { readFileSync } from "fs";
import combinations from "combinations";
import { getNRandomElements, getRandomIndex } from "./utils.js";
import { PeerData, PeerManager } from "./peerManager.js";

function sleep(ms: number) {
    return new Promise((res, rej) => setTimeout(res, ms));
}

const _classifier = new BayesClassifier(null, 0.15);

export interface ModelOptions {
    smoothing: number;
    temperature: number;
}

@Service()
export class Classifier {
    private cacheManager = Container.get(CacheManager);
    private classifierTrained = false;
    private classChanged = false;
    private nlpService = Container.get(NLPService);
    private peerManager = Container.get(PeerManager);
    private modelOptions: ModelOptions;
    private _currentTemperature = 0;

    setOptions(options: ModelOptions) {
        this.modelOptions = options;
    }

    async generateTags(frame: Frame, url: string) {
        const cacheTags = this.cacheManager.getUrlTags(url);
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
            return tags.map(tag => tag.token);
        } catch (err) {
            console.log(err);
            return [];
        }
    }

    getUniqueTags() {
        const seedData = this.getSampleData();
        const keys = Object.keys(seedData[0].peer);
        const map = {};
        keys.map(key => {
            if (key === 'visitedTags')
                return;
            const values = new Set();
            seedData.map(data => values.add(data.peer[key]))
            map[key] = Array.from(values);
        });
        const interests = new Set();
        seedData.map(data => data.peer.interests.map(tag => interests.add(tag)))
        map['visitedTags'] = Array.from(interests);
        return map;
    }

    async getScore(testData: any[]) {
        let correct = 0;
        let confidenceLevel = 0;
        this._currentTemperature = 0;
        await Promise.all(testData.map(async ({ peer, tag }) => {

            const { finalRecommendations } = await this.getRecommendationWithNetwork(peer, testData.length);
            const tagP = finalRecommendations.find(tg => tg.tag === tag);
            if (tagP) { correct += 1; confidenceLevel += Number(tagP.probability) }
        }));
        return {
            accuracy: Number((correct / testData.length * 100).toFixed(2)),
            confidenceOnCorrectEntry: Number((confidenceLevel / testData.length * 100).toFixed(2))
        }
    }

    async getRecommendationWithNetwork(peer: Peer, totalPeers?: number) {
        const data = this.getSampleData();
        const closestPeers = await this.peerManager.getClosestPeers(peer, data);
        const classifier = this.initModel();
        // const networkSelectLength = Math.floor(closestPeers.length * (1 - this.modelOptions.temperature));
        const selectedPeers = this.adjustForTemperature(closestPeers, peer, totalPeers ?? 0);
        for (const peerData of selectedPeers) {
            const { peer, tag } = peerData;
            this.addTagNetwork(classifier, peer, tag);
        }
        console.log({ peer, closePeers: selectedPeers.length });
        classifier.train();
        const baseMap = {};
        // base case
        Object.keys(peer).map(key => {
            const identifier = `${key}:${peer[key]}`
            const tag = classifier.classify(identifier);
            baseMap[key] = tag;
        })
        const freqMap: Record<string, number> = {};
        for (const identifier of this.generateIdentifiers(peer)) {
            const tag = classifier.classify(identifier);
            if (freqMap[tag])
                freqMap[tag] += 1;
            else
                freqMap[tag] = 1;
        }
        const totalOccurences = Object.values(freqMap).reduce((acc, curr) => acc + curr, 0);
        const hotTags = Object.keys(freqMap).sort((a, b) => freqMap[b] - freqMap[a]).map(tag => {
            const probability = (freqMap[tag] / totalOccurences).toFixed(2)
            return { tag, probability }
        });
        return { baseRecommendations: baseMap, finalRecommendations: hotTags.slice(0, 3) };
    }

    getRecommendation(peer: Peer) {
        if (this.classChanged) {
            if (!this.classifierTrained) {
                _classifier.train();
                this.classifierTrained = true;
            } else {
                _classifier.retrain();
            }
        }
        const baseMap = {};
        // base case
        Object.keys(peer).map(key => {
            const identifier = `${key}:${peer[key]}`
            const tag = _classifier.classify(identifier);
            baseMap[key] = tag;
        })
        const freqMap: Record<string, number> = {};
        const key = JSON.stringify(peer);
        for (const identifier of this.generateIdentifiers(peer)) {
            const tag = _classifier.classify(identifier);
            if (freqMap[tag])
                freqMap[tag] += 1;
            else
                freqMap[tag] = 1;
        }
        const totalOccurences = Object.values(freqMap).reduce((acc, curr) => acc + curr, 0);
        const hotTags = Object.keys(freqMap).sort((a, b) => freqMap[b] - freqMap[a]).map(tag => {
            const probability = (freqMap[tag] / totalOccurences).toFixed(2)
            return { tag, probability }
        });
        return { baseRecommendations: baseMap, finalRecommendations: hotTags.slice(0, 3) };
    }

    initModel() {
        const classifier = new BayesClassifier(null, this.modelOptions.smoothing);
        return classifier;
    }

    generateIdentifiers(peer: Peer) {
        // const key = Object.keys(peer).map(key => `${key}:${peer[key].toString()}`).join(";")
        // return [key]
        const allKeys = Object.keys(peer);
        const keysWithoutAge = allKeys.filter(key => key !== 'age')
        const tagCombos = combinations(keysWithoutAge).map(keys => ['age', ...keys]);
        return tagCombos.map(keys => {
            const identifier = keys.map(key => `${key}:${peer[key]}`).join(";")
            return identifier;
        });
    }

    addTag(peer: Peer, tag: string) {
        this.classChanged = true;
        for (const identifier of this.generateIdentifiers(peer)) {
            _classifier.addDocument(identifier, tag);
        }
    }

    addTagNetwork(classifier: BayesClassifier, peer: Peer, tag: string) {
        for (const identifier of this.generateIdentifiers(peer)) {
            classifier.addDocument(identifier, tag);
        }
    }

    fitData() {
        const allData = this.getSampleData();
        const randomN = Math.floor(allData.length * 0.80);
        const randomData = getNRandomElements(randomN, allData);
        randomData.map(({ peer, tag }) => this.addTag(peer, tag));
    }

    adjustForTemperature(data: PeerData[], currentPeer: Peer, totalPeers: number) {
        if (this._currentTemperature < (totalPeers * this.modelOptions.temperature)) {
            this._currentTemperature += 1;
            return this.removeCurrentPeerFromNetwork(currentPeer, data);
        }
        return data;
    }

    getSampleData() {
        const file = readFileSync("seed.json", "utf-8");
        const seedData = JSON.parse(file) as { peer: Peer, tag: string }[];
        return seedData;
    }

    removeCurrentPeerFromNetwork(currentPeer:Peer, peerData: PeerData[]) {
        return peerData.filter(peer => !this.peerManager.isEqual(currentPeer, peer.peer));
    }

    getTestData() {
        const allData = this.getSampleData();
        const testN = Math.floor(allData.length * 0.15);
        const testData = getNRandomElements(testN, allData);
        const trainData = allData.filter(data => !testData.includes(data));
        return testData;
    }

    getTrainData() {
        const allData = this.getSampleData();
        const trainN = allData.length * 0.8;
        const trainData = getNRandomElements(trainN, allData);
        return trainData;
    }

    handleNewPage(peer: Peer, page: Page) {
        page.on('framenavigated', (frame) => this.handleNavigation(peer, frame));
    }

    async handleNavigation(peer: Peer, frame: Frame) {
        const url = frame.url();
        if (url == ':' || url.startsWith("chrome"))
            return console.log("Navigated to internal page, skip tagging");
        await sleep(1500);
        if (url.includes('amazon')) {
            const title = await frame.title();
            const tags = this.nlpService.getTags(title).slice(0, 6);
            console.log("Detetected shop adding to identifier: ", title);
            console.log({ tags });
            const identifier = Object.values(peer).flat();
            tags.map(tag => _classifier.addDocument(identifier, tag.token));
        } else {
            const tags = await this.generateTags(frame, url);
            if (!tags)
                return;
            console.log({ tags });
            peer.interests.concat(tags);
        }
    }

    async initBrowser(peer: Peer) {
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
}