import { Service } from "typedi";

@Service()
export class CacheManager {
    private _cache = new Map<string, string[]>();

    saveUrlTags(url: string, tags: string[]) {
        const baseEncodedId = Buffer.from(url).toString('base64url');
        this._cache.set(baseEncodedId, tags);
    }

    getUrlTags(url: string) {
        const tags = this._cache.get(url);
        return tags;
    }

    save(key: string, value: string) {
        this._cache.set(key, [value]);
    }

    get(key: string) {
        const vals = this._cache.get(key)
        return vals?.length ? vals[0] : null;
    }

}