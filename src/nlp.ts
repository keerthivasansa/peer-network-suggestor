import natural from "natural";
import { Service } from "typedi";
import nlp from 'compromise'
import { removeStopwords, eng } from "stopword"
import { normalize } from "natural";
import pos from "pos";

@Service()
export class NLPService {
    private NUM_SIGNIFICANT_TOKENS = 5;
    private nlpTokenizer = new natural.WordTokenizer({
        discardEmpty: true,
        gaps: true,
    });

    getTags(headersContent: string) {
        const tokenizer = nlp(headersContent);

        const n = tokenizer.nouns().toSingular(true).autoFill();
        const tagger = new pos.Tagger();

        const numbers = (tokenizer.numbers().out('array') as string[]).map(num => num.trim().toLowerCase());

        const tokens = (n.map(m => m.text().split(/\s/)) as string[][]).flat(1).map(token => token.trim().toLocaleLowerCase()).filter(token => {
            if (token == '')
                return false;
            const tag = tagger.tag([token])[0][1]
            return tag === 'NN'
        });
        const specialCharactersRegex = /[!@#$^&|*()–\'\\[\]\.,"+=-\d]/

        const normalizedTokens = normalize(tokens).map(token => token.replace(specialCharactersRegex, '')).filter(token => token != '' && !numbers.includes(token));

        const significantTokens = removeStopwords(normalizedTokens);

        // const tokens = filters.map(filter => filter()).flat().map(token => token.text());
        const tokenFreqMap = this.calcFrequencyMap(significantTokens);
        const mostFrequentTokens = this.getMostSignificantTokens(tokenFreqMap, this.NUM_SIGNIFICANT_TOKENS);
        return mostFrequentTokens;
    }

    calcFrequencyMap(tokens: string[]) {
        const tokenFrequencyMap = new Map<string, number>();

        tokens.map(token => {
            const freq = tokenFrequencyMap.get(token)
            let newFreq: number;
            if (freq) {
                newFreq = freq + 1;
            } else {
                newFreq = 1;
            }
            tokenFrequencyMap.set(token, newFreq);
        })

        return tokenFrequencyMap;
    }

    getMostSignificantTokens(tokenFreqMap: Map<string, number>, n: number) {
        const frequencies = Array.from(tokenFreqMap.values());
        const totalTokens = frequencies.length;
        const highestFrequencies = frequencies.sort((frq, freq2) => freq2 - frq).slice(0, n);
        const significantTokens = Array.from(tokenFreqMap.keys()).filter(token => highestFrequencies.includes(tokenFreqMap.get(token))).map(
            token => {
                const freq = tokenFreqMap.get(token);
                return {
                    token,
                    frequency: freq,
                    weight: freq / totalTokens
                }
            }
        );
        return significantTokens;
    }
}