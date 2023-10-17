import { createExpressServer } from "routing-controllers";
import { BrowserTagger } from "./browser.js";
import { Classifier } from "./classifier.js";
import Container, { Service } from "typedi";
import { WebController } from "./web.js";

@Service()
export class App {
    private classifier = Container.get(Classifier);
    private browser = Container.get(BrowserTagger);

    initWeb() {
        const webApp = createExpressServer({
            controllers: [WebController]
        })
        webApp.listen(5000, () => console.log("[web] Started server at :3000"));
    }

    initClassifier() {
        this.classifier.setOptions({
            smoothing: 0.12,
            temperature: 0.12,
        })
    }

    initBrowser() {
        const samplePeer: Peer = {
            age: 20,
            browser: 'chrome',
            device: 'desktop',
            os: 'windows',
            interests: ['gaming', 'coding', 'music']
        };

        this.browser.start(samplePeer);
    }

    start({ startBrowser } = { startBrowser: false }) {
        this.initClassifier();
        this.initWeb();
        if (startBrowser)
            this.initBrowser();
    }
}