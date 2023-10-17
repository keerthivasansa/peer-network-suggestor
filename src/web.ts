import { Classifier } from "./classifier.js";
import { Body, Get, JsonController, Post } from "routing-controllers";
import Container from "typedi";

@JsonController()
export class WebController {
    private classifier = Container.get(Classifier)
    private testData = this.classifier.getTestData();

    @Get("/score")
    async score() {
        const result = await this.classifier.getScore(this.testData);
        return result;
    }

    @Get("/values")
    values() {
        const uniqueValues = this.classifier.getUniqueTags();
        return uniqueValues;
    }

    @Post("/recommendation")
    async recommendation(@Body({
        required: true,
    }) peer: Peer) {
        const result = await this.classifier.getRecommendationWithNetwork(peer);
        return result;
    }

}