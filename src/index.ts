import 'reflect-metadata';
import { Classifier } from './classifier.js';
import axios from 'axios';

async function main() {
    const k = new Classifier();
    const url = 'https://www.bestbuy.com/site/lenovo-legion-slim-5-16-gaming-laptop-wqxga-ryzen-7-7840hs-with-16gb-memory-nvidia-geforce-rtx-4060-8gb-512gb-ssd-storm-grey/6534470.p?skuId=6534470';
    // const tags = await fetch('') 
    // console.log(await tags.text());
    k.generateTags(url);
}
main();