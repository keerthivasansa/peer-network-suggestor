export function getRandomIndex<T>(arr: T[]) {
    return Math.floor(Math.random() * arr.length);
}

export function getNRandomElements<T>(n: number, arr: T[]): T[] {
    const elements = [];

    while (elements.length < n) {
        const index = getRandomIndex(arr);
        const element = arr[index];
        if (!elements.includes(element)) {
            elements.push(element);
        }
    }

    return elements;
}

export function sleep(ms: number) {
    return new Promise((res, rej) => setTimeout(res, ms));
}