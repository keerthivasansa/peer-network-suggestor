import 'reflect-metadata';
import { App } from './app.js';

async function main() {
    const app = new App();
    app.start({ startBrowser: false });
}

main();