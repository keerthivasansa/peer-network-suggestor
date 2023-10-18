import { readFileSync, writeFileSync } from "fs";

export class SeedUtils {
    private data: PeerData[];

    constructor() {
        const file = JSON.parse(readFileSync('./sample_peers.json', 'utf-8')) as PeerData[][];
        this.data = file.flat(1);
    }

    removeDuplicates() {
        const peers = new Set();
        this.data.forEach((peer, index) => { peers.add(JSON.stringify(peer.peer)) });
        const peersArray = [];
        const newPeers = new Map();
        this.data.map((peerData, index) => {
            const allowed = this.get1Or2();
            if (!allowed && newPeers.get(JSON.stringify(peerData)) === 1) {
                return;
            }
            peersArray.push(peerData);
            newPeers.set(JSON.stringify(peerData), 1);
            return false;
        })
        writeFileSync("new_seed.json", JSON.stringify(peersArray));
        console.log(peers.size, this.data.length, peersArray.length);
    }

    get1Or2() {
        const randomValue = Math.random();
        // Use a conditional statement to return either 1 or 2
        if (randomValue < 0.08) {
            return true;
        } 
        return false;
    }
}