"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateScore = generateScore;
exports.calculateCreditLimit = calculateCreditLimit;
function generateScore() {
    return Math.floor(Math.random() * 101); // 0 – 100
}
function calculateCreditLimit(score) {
    return 100 + (score / 100) * (10000000 - 100);
}
//# sourceMappingURL=score.js.map