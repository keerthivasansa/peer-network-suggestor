import 'reflect-metadata';
import { App } from './app.js';
import { SeedUtils } from './seed.js';

async function main() {
    const app = new App();
    app.start({ startBrowser: false });
    // const seed = new SeedUtils();
    // seed.removeDuplicates();
}

main();