
interface Peer {
    interests: string[]
    age: number;
    browser: string;
    location: string;
    os: string;
    device: string;
}

interface PeerData {
    peer: Peer, 
    tag: string
}