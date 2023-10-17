import Container, { Service } from "typedi";
import { BayesClassifier } from "natural";
import { readFileSync } from "fs";
import combinations from "combinations";
import { getNRandomElements } from "./utils.js";
import { PeerData, PeerManager } from "./peerManager.js";
import { ModelOptions } from "interfaces/model.js";

@Service()
export class Classifier {
    private peerManager = Container.get(PeerManager);
    private modelOptions: ModelOptions;
    private _currentTemperature = 0;

    setOptions(options: ModelOptions) {
        this.modelOptions = options;
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

    initModel() {
        const classifier = new BayesClassifier(null, this.modelOptions.smoothing);
        return classifier;
    }

    generateIdentifiers(peer: Peer) {
        const allKeys = Object.keys(peer);
        const keysWithoutAge = allKeys.filter(key => key !== 'age')
        const tagCombos = combinations(keysWithoutAge).map(keys => ['age', ...keys]);
        return tagCombos.map(keys => {
            const identifier = keys.map(key => `${key}:${peer[key]}`).join(";")
            return identifier;
        });
    }

    addTagNetwork(classifier: BayesClassifier, peer: Peer, tag: string) {
        for (const identifier of this.generateIdentifiers(peer)) {
            classifier.addDocument(identifier, tag);
        }
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

    removeCurrentPeerFromNetwork(currentPeer: Peer, peerData: PeerData[]) {
        return peerData.filter(peer => !this.peerManager.isEqual(currentPeer, peer.peer));
    }

    getTestData(percentage: number = 0.15) {
        const allData = this.getSampleData();
        const testN = Math.floor(allData.length * percentage);
        const testData = getNRandomElements(testN, allData);
        return testData;
    }
}