/*
 * Sample manifest for the MNIST-SUM and protein result browsers.
 *
 * Keep media inside this static site (for example, samples/mnist/... and
 * samples/protein/...) and add objects to the matching arrays below. No server,
 * build step, or renderer changes are required.
 *
 * MNIST-SUM schemas
 * -----------------
 * imageToText: { image, target, prediction, split?, correct? }
 * textToImage: { prompt, image, predictedDigits?, correct? }
 * joint:       { image, equation, consistent?, split? }
 *
 * Protein schemas
 * ---------------
 * forwardFolding: { sequence, structureImage, length?, tmScore?, caption? }
 * inverseFolding: { structureImage, targetSequence, prediction, recovery?, length? }
 * joint:          { sequence, structureImage, length, scTM?, scRMSD?, pLDDT? }
 */
window.EXPERIMENT_SAMPLES = {
  mnist: {
    imageToText: [],
    textToImage: [],
    joint: []
  },
  protein: {
    forwardFolding: [],
    inverseFolding: [],
    joint: []
  }
};
