import { INetwork, infer, inferences } from 'bayesjs';

class Bayes {

    determine() {
        const network: INetwork = {
            'node1': {
                id: '1',
                states: ['gaming'],
                parents: [],
                cpt: [
                    {
                        when: { 'gaming': 'T', 'football': 'T' },
                        then: { gaming: 1 }
                    }
                ]
            },
            'node2': {
                id: '2',
                states: ['football'],
                parents: [],
                cpt: [
                    {
                        when: { 'football': 'T' },
                        then: { football: 1, gaming: 0.25 }
                    }
                ]
            }
        }
        const num = infer(network, { 'gaming': 'T' }).toFixed(4);
    }
}