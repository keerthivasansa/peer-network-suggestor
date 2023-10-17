import { randomUUID } from "crypto";
import Container, { Service } from "typedi";
import { Identifier, Point } from "./identifier.js";
import * as tf from '@tensorflow/tfjs-node-gpu';
import * as use from '@tensorflow-models/universal-sentence-encoder';

export interface PeerData {
    peer: Peer,
    tag: string
}

let model: use.UniversalSentenceEncoder;

async function getModel() {
    model = await use.load();
}

getModel();

@Service()
export class PeerManager {
    private network = new Map<string, PeerData>();
    private CLOSEST_PEERS = 5;
    private interests = new Map<string, string>();

    addPeerToNetwork(peerData: PeerData) {
        const peerId = randomUUID();
        this.network.set(peerId, peerData);
        return peerId;
    }

    async getClosestPeers(peer: Peer, data: PeerData[]) {
        const peerFieldFunctions = [
            this.getAgeClosest,
            this.getClosestPeersField,
            this.getInterestsClosest
        ];
        const closestNetwork = new Set<{ peer: Peer, tag: string, score: number }>()
        for (const fieldFn of peerFieldFunctions) {
            const closestPeers = await fieldFn.call(this, peer, data);
            closestPeers.map(info => {
                closestNetwork.add(info);
            })
        }
        return Array.from(closestNetwork);
    }

    isEqual(peer1: Peer, peer2: Peer) {
        return JSON.stringify(peer1) == JSON.stringify(peer2);
    }

    getAgeClosest(currentPeer: Peer, data: PeerData[]) {
        const valuesArray: { peer: Peer, tag: string, score: number }[] = [];
        data.map(info => {
            const { tag, peer } = info;
            const agePoint1 = this.genAgeCoordinate(currentPeer);
            const agePoint2 = this.genAgeCoordinate(peer);
            const score = this.euclideanDistance(agePoint1, agePoint2);
            valuesArray.push({
                peer,
                tag,
                score
            })
        })
        return valuesArray.sort((a, b) => b.score - a.score).slice(0, this.CLOSEST_PEERS);
    }

    getClosestPeersField(currentPeer: Peer, data: PeerData[]) {
        const valuesArray: { peer: Peer, tag: string, score: number }[] = [];
        for (const info of data) {
            const peer = info.peer;
            let score = 0;
            const keys = ['browser', 'device', 'os', 'location']
            keys.map(key => {
                score += this.assignClassValue(currentPeer[key], peer[key]);
            })
            valuesArray.push({
                peer,
                tag: info.tag,
                score
            })
        }
        return valuesArray.sort((a, b) => b.score - a.score).slice(0, this.CLOSEST_PEERS);
    }

    async getInterestsClosest(currentPeer: Peer, data: PeerData[]) {
        const interests = currentPeer.interests;
        const valuesArray: { peer: Peer, tag: string, score: number }[] = [];
        for (const info of data) {
            const peer = info.peer;
            const peerInterests = peer.interests;
            const score = await this.assignArrayValue(interests, peerInterests);
            valuesArray.push({
                peer,
                tag: info.tag,
                score
            })
        }
        return valuesArray.sort((a, b) => b.score - a.score).slice(0, this.CLOSEST_PEERS);
    }

    genAgeCoordinate(peer: Peer) {
        let y = 0;
        if (process.env.NODE_ENV === 'production') {
            y = peer['created_at'] || Date.now() / 1000;
        }
        return { x: peer.age, y };
    }

    assignClassValue(class1: string, class2: string) {
        if (class1 === class2) {
            return 1;
        }
        return 0;
    }

    async assignArrayValue(array1: string[], array2: string[]) {
        let common = [];
        for (const item of array1) {
            if (array2.includes(item))
                common.push(item);
        }
        for (const item of array2) {
            if (array1.includes(item) && !common.includes(item))
                common.push(item);
        }
        return common.length / Math.max(array1.length, array2.length);
    }

    euclideanDistance(point1: Point, point2: Point) {
        return Math.sqrt(Math.abs(Math.pow(point1.x, 2) - Math.pow(point2.x, 2)) + Math.abs(Math.pow(point1.y, 2) - Math.pow(point2.y, 2)))
    }


    async checkSimilarity(token1: string, token2: string) {
        const sentences = [
            token1,
            token2
        ];
        const a = Date.now();
        const embeddings = ((await model.embed(sentences)) as any).unstack();
        const rank = await tf.losses.cosineDistance(embeddings[0], embeddings[1], 0).array();
        console.log({ token1, token2, rank, time: (Date.now() - a).toFixed(2) })
        return rank as number;
    }

    getPeerInterests(peerId: string): string[] {
        const cipher = this.interests.get(peerId);
        const data = Buffer.from(cipher, "base64").toString();
        const unpacked = JSON.parse(data);
        return unpacked;
    }

    addInterest(peerId: string, interest: string) {
        const interests = this.getPeerInterests(peerId);
        const payload = interests.concat(interest)
        const cipher = Buffer.from(JSON.stringify(payload)).toString('base64')
        this.interests.set(peerId, cipher);
        return;
    }
}