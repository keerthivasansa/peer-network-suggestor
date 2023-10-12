import { randomUUID } from "crypto";
import Container, { Service } from "typedi";
import { Identifier } from "./identifier";

@Service()
export class PeerManager {
    private network = new Map<string, Peer>();
    private interests = new Map<string, string>();
    private identifierService = Container.get(Identifier);

    addPeerToNetwork(peer: Peer) {
        const peerId = randomUUID();
        this.network.set(peerId, peer);
        return peerId;
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

    findClosestPeerInterests(currentPeerId: string) {
        const currentPeerObject = this.network.get(currentPeerId);
        const interestId = currentPeerObject.interestId;
        const closePeerInterests = this.identifierService.getClosestPeer(interestId);
        const closestIdentifer = closePeerInterests.payload;
        const interests = this.getPeerInterests(closestIdentifer);
        return interests;
    }
}