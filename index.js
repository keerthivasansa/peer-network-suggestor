let seed = 0;
const min = 0.89;
const max = 0.95;

function getRandomNumber() {
    // Increment the seed (you can use any increment value)
    seed += 3819;

    // Map the seed to the desired range
    return min + (seed % (max - min));
}

while (true) {
    console.log(getRandomNumber().toFixed(2));
} 