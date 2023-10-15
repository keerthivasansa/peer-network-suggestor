import { Service } from "typedi";
import { IdentifierPayload } from "./interfaces/identifier";
import { randomUUID } from "crypto";


export interface Point {
    x: number
    y: number
}

@Service()
export class Identifier {
    private MIN_CONFIDENCE_DISTANCE = 100;
    private _identifierRepository = new Map<string, string>();

    euclideanDistance(point1: Point, point2: Point) {
        return Math.sqrt(Math.abs(Math.pow(point1.x, 2) - Math.pow(point2.x, 2)) + Math.abs(Math.pow(point1.y, 2) - Math.pow(point2.y, 2)))
    }

    getClosestPeer(id1: string) {
        const person1 = this.getIdentifier(id1);
        const allPeerIterator = this.getAllPeers();
        let leastDistance = this.MIN_CONFIDENCE_DISTANCE;
        let chosenPerson: IdentifierPayload;
        for (let peerId in allPeerIterator) {
            const personN = this.getIdentifier(peerId);
            const distance = this.euclideanDistance(person1, personN);
            if (distance < leastDistance) {
                leastDistance = distance;
                chosenPerson = personN;
            }
        }
        return chosenPerson;
    }

    getAllPeers() {
        return this._identifierRepository.keys();
    }

    getIdentifier(id: string) {
        const cipher = this._identifierRepository.get(id);
        if (!cipher)
            throw new Error('Payload associated with given id does not exist.');
        const data = Buffer.from(cipher, 'base64').toString();
        const payload = JSON.parse(data) as IdentifierPayload;
        return payload;
    }

    createIdentifier(payload: IdentifierPayload) {
        const data = JSON.stringify(payload)
        const cipher = Buffer.from(data).toString('base64');
        const id = randomUUID();
        this._identifierRepository.set(id, cipher);
        return id;
    }

}